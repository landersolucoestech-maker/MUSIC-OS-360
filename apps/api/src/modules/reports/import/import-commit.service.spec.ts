import { ForbiddenException } from '@nestjs/common';
import { ImportCommitService } from './import-commit.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import type { ImportValidationResult } from './import.types';

const DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'nome_artistico', displayColumn: 'nome_artistico', dateColumn: 'created_at',
  exportableColumns: ['nome_artistico'], importableColumns: ['nome_artistico'],
  filterableColumns: [], sortableColumns: ['nome_artistico'], searchableColumns: ['nome_artistico'],
  sensitiveColumns: ['cpf_encrypted'], requiredImportColumns: ['nome_artistico'],
  supportsExport: true, supportsImport: true,
};

function validResult(rows = 2): ImportValidationResult {
  return {
    entity: 'artists', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
    totalRows: rows, validRows: rows, invalidRows: 0,
    rows: Array.from({ length: rows }, (_, i) => ({ index: i, data: { nome_artistico: `A${i}` }, valid: true, errors: [], warnings: [] })),
    errors: [], warnings: [],
  };
}

function makeQR(queryImpl: (sql: string, params: unknown[]) => unknown) {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn((sql: string, params: unknown[]) => Promise.resolve(queryImpl(sql, params))),
    isTransactionActive: true,
  };
}

function makeSvc(opts: { validation?: ImportValidationResult; def?: ReportEntityDefinition; queryImpl?: (sql: string, p: unknown[]) => unknown } = {}) {
  const qr = makeQR(opts.queryImpl ?? (() => []));
  const ds = { createQueryRunner: () => qr } as any;
  const engine = { validateFile: jest.fn().mockReturnValue(opts.validation ?? validResult()) } as any;
  const definitions = { getDefinition: () => (opts.def ?? DEF) } as any;
  const audit = { record: jest.fn() } as any;
  const encryption = { encryptNullable: jest.fn((v: string | null) => (v == null ? null : `enc:${v}`)) } as any;
  const svc = new ImportCommitService(ds, engine, definitions, audit, encryption, undefined as any);
  return { svc, qr, engine, audit };
}

const file = { filename: 'artists.xlsx', content: Buffer.from('xlsx') };

describe('ImportCommitService — commit transacional', () => {
  it('import válido faz commit atômico e força tenant', async () => {
    const { svc, qr, audit } = makeSvc();
    const result = await svc.commit('artists', file, 'tenant-1', 'user-1');
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    expect(result.importedRows).toBe(2);
    const insert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT'));
    expect(insert?.[0]).toContain('"tenant_id"');
    expect(insert?.[1]).toContain('tenant-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'committed', successCount: 2 }));
  });

  it('validação inválida não abre transação', async () => {
    const bad = validResult(1);
    bad.invalidRows = 1;
    bad.validRows = 0;
    bad.rows[0].valid = false;
    bad.rows[0].errors = [{ column: 'nome_artistico', message: 'campo obrigatório vazio' }];
    const { svc, qr } = makeSvc({ validation: bad });
    const result = await svc.commit('artists', file, 't', 'u');
    expect(qr.startTransaction).not.toHaveBeenCalled();
    expect(result.importedRows).toBe(0);
  });

  it('duplicado ou relacionamento inválido causa rollback total', async () => {
    const duplicated = makeSvc({ queryImpl: (sql) => (sql.startsWith('SELECT 1') ? [{}] : []) });
    const duplicateResult = await duplicated.svc.commit('artists', file, 't', 'u');
    expect(duplicated.qr.rollbackTransaction).toHaveBeenCalled();
    expect(duplicateResult.errors.some((e) => /já existe/i.test(e))).toBe(true);

    const def = { ...DEF, importableColumns: ['nome_artistico', 'client_id'] };
    const validation = validResult(1);
    validation.rows[0].data = { nome_artistico: 'A', client_id: 'c-x' };
    const invalidRelation = makeSvc({ def, validation, queryImpl: () => [] });
    const relationResult = await invalidRelation.svc.commit('artists', file, 't', 'u');
    expect(relationResult.errors.some((e) => /relacionamento inválido/i.test(e))).toBe(true);
  });

  it('exceção de banco causa rollback e propaga', async () => {
    const { svc, qr } = makeSvc({ queryImpl: (sql) => { if (sql.startsWith('INSERT')) throw new Error('db boom'); return []; } });
    await expect(svc.commit('artists', file, 't', 'u')).rejects.toThrow('db boom');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('sem tenant retorna 403', async () => {
    const { svc } = makeSvc();
    await expect(svc.commit('artists', file, undefined, 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ImportCommitService — normalização/validação de ISRC (find-fb2cfb1b)', () => {
  const PHONOGRAMS_DEF: ReportEntityDefinition = {
    entityName: 'PhonogramEntity', tableName: 'phonograms', category: EntityCategory.REPORTABLE,
    identityColumn: 'title', displayColumn: 'title', dateColumn: 'created_at',
    exportableColumns: ['title', 'isrc'], importableColumns: ['title', 'isrc'],
    filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
    requiredImportColumns: ['title'], supportsExport: true, supportsImport: true,
  };

  function phonogramsValidation(isrc: string): ImportValidationResult {
    return {
      entity: 'phonograms', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
      totalRows: 1, validRows: 1, invalidRows: 0,
      rows: [{ index: 0, data: { title: 'Faixa 1', isrc }, valid: true, errors: [], warnings: [] }],
      errors: [], warnings: [],
    };
  }

  it('normaliza ISRC hifenizado/minúsculo para a forma canônica antes do INSERT', async () => {
    const { svc, qr } = makeSvc({ def: PHONOGRAMS_DEF, validation: phonogramsValidation('br-abc-26-00001') });
    const result = await svc.commit('phonograms', file, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const insert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT'));
    expect(insert?.[1]).toContain('BRABC2600001');
  });

  it('rejeita ISRC malformado com rollback total e erro por linha', async () => {
    const { svc, qr } = makeSvc({ def: PHONOGRAMS_DEF, validation: phonogramsValidation('not-an-isrc') });
    const result = await svc.commit('phonograms', file, 'tenant-1', 'user-1');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(result.importedRows).toBe(0);
    expect(result.errors.some((e) => /ISRC inválido/i.test(e))).toBe(true);
  });
});

describe('ImportCommitService — grupo repetível na mesma aba', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'nome_ep_album', displayColumn: 'nome_ep_album', dateColumn: 'created_at',
    exportableColumns: ['tipo_lancamento', 'nome_ep_album', 'nome_musica'],
    importableColumns: ['tipo_lancamento', 'nome_ep_album', 'nome_musica'],
    filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
    requiredImportColumns: ['nome_ep_album'], supportsExport: true, supportsImport: true,
  };

  function projectsValidation(musicas?: unknown[]): ImportValidationResult {
    return {
      entity: 'projects', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
      totalRows: 1, validRows: 1, invalidRows: 0,
      rows: [{
        index: 0,
        data: { tipo_lancamento: 'ep', nome_ep_album: 'Meu EP' },
        valid: true, errors: [], warnings: [],
        repeatingGroups: musicas ? { musicas } : undefined,
      }],
      errors: [], warnings: [],
    };
  }

  it('retorna id do registro pai e grava itens repetíveis', async () => {
    const queryImpl = (sql: string) => sql.startsWith('INSERT INTO "projects"') ? [{ id: 'proj-gerado' }] : [];
    const { svc, qr } = makeSvc({
      def: PROJECTS_DEF,
      validation: projectsValidation([{ nome_musica: 'Faixa 1', compositores: ['Fulano'] }]),
      queryImpl,
    });
    const result = await svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const parentInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT INTO "projects"'));
    expect(parentInsert?.[0]).toContain('RETURNING "id"');
    const trackInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).includes('"project_tracks"'));
    expect(trackInsert).toBeDefined();
  });

  it('sem itens repetíveis faz insert simples', async () => {
    const { svc, qr } = makeSvc({ def: PROJECTS_DEF, validation: projectsValidation(), queryImpl: () => [] });
    await svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1');
    const parentInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT INTO "projects"'));
    expect(parentInsert?.[0]).not.toContain('RETURNING');
  });

  it('falha explicitamente se o insert pai não retornar id', async () => {
    const { svc } = makeSvc({ def: PROJECTS_DEF, validation: projectsValidation([{ nome_musica: 'Faixa' }]), queryImpl: () => [] });
    await expect(svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1')).rejects.toThrow(/sem id retornado/);
  });
});

describe('ImportCommitService — transações: colunas físicas e categoria (Task X)', () => {
  const TRANSACTIONS_DEF: ReportEntityDefinition = {
    entityName: 'TransactionEntity', tableName: 'transactions', category: EntityCategory.REPORTABLE,
    identityColumn: 'descricao', displayColumn: 'descricao', dateColumn: 'created_at',
    exportableColumns: ['tipo_transacao', 'categoria', 'descricao', 'valor', 'data_transacao', 'status'],
    importableColumns: ['tipo_transacao', 'categoria', 'descricao', 'valor', 'data_transacao', 'status'],
    filterableColumns: ['status', 'tipo_transacao', 'categoria'], sortableColumns: [], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['descricao'], supportsExport: true, supportsImport: true,
  };

  function txValidation(row: Record<string, unknown>): ImportValidationResult {
    return {
      entity: 'transactions', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
      totalRows: 1, validRows: 1, invalidRows: 0,
      rows: [{ index: 0, data: row, valid: true, errors: [], warnings: [] }],
      errors: [], warnings: [],
    };
  }

  function makeTxSvc(opts: {
    row: Record<string, unknown>;
    suggestion?: { categoryId: string; categoryName: string; ruleId: string } | null;
    suggestThrows?: boolean;
  }) {
    const qr = makeQR(() => []);
    const ds = { createQueryRunner: () => qr } as any;
    const engine = { validateFile: jest.fn().mockReturnValue(txValidation(opts.row)) } as any;
    const definitions = { getDefinition: () => TRANSACTIONS_DEF } as any;
    const audit = { record: jest.fn() } as any;
    const encryption = { encryptNullable: jest.fn() } as any;
    const financeCategoryRules = {
      suggestCategoryForTransaction: opts.suggestThrows
        ? jest.fn().mockRejectedValue(new Error('matcher indisponível'))
        : jest.fn().mockResolvedValue(opts.suggestion ?? null),
    } as any;
    const svc = new ImportCommitService(ds, engine, definitions, audit, encryption, financeCategoryRules);
    return { svc, qr, financeCategoryRules };
  }

  function insertCall(qr: ReturnType<typeof makeQR>) {
    const call = qr.query.mock.calls.find((c: any[]) => String(c[0]).startsWith('INSERT'));
    return { sql: String(call?.[0]), params: call?.[1] as unknown[] };
  }

  it('grava tipo_transacao/data_transacao nas colunas físicas reais (type/data), não nas colunas de formulário', async () => {
    const { svc, qr } = makeTxSvc({ row: { tipo_transacao: 'despesa', categoria: 'aluguel', descricao: 'Aluguel sala', data_transacao: '2026-01-05' } });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    const { sql, params } = insertCall(qr);
    expect(sql).toContain('"type"');
    expect(sql).not.toContain('"tipo_transacao"');
    expect(sql).toContain('"data"');
    expect(sql).not.toContain('"data_transacao"');
    expect(params).toContain('despesa');
  });

  it('categoria explícita (não "outros") é preservada e o matcher não é consultado', async () => {
    const { svc, qr, financeCategoryRules } = makeTxSvc({ row: { tipo_transacao: 'despesa', categoria: 'aluguel', descricao: 'Aluguel sala' } });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(financeCategoryRules.suggestCategoryForTransaction).not.toHaveBeenCalled();
    const { params } = insertCall(qr);
    expect(params).toContain('aluguel');
  });

  it('categoria vazia na planilha aciona o matcher e aplica a sugestão (mesmo serviço da criação manual)', async () => {
    const { svc, qr, financeCategoryRules } = makeTxSvc({
      row: { tipo_transacao: 'despesa', categoria: '', descricao: 'Compra de cabos' },
      suggestion: { categoryId: 'cat-1', categoryName: 'equipamentos', ruleId: 'rule-1' },
    });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(financeCategoryRules.suggestCategoryForTransaction).toHaveBeenCalledWith('tenant-1', 'DESPESA', 'Compra de cabos');
    const { params } = insertCall(qr);
    expect(params).toContain('equipamentos');
  });

  it('categoria vazia sem match cai em "outros" e o INSERT ainda satisfaz a coluna NOT NULL', async () => {
    const { svc, qr } = makeTxSvc({ row: { tipo_transacao: 'despesa', categoria: '', descricao: 'Item desconhecido' }, suggestion: null });
    const result = await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const { sql, params } = insertCall(qr);
    expect(sql).toContain('"categoria"');
    expect(params).toContain('outros');
  });

  it('matcher indisponível (exceção) não derruba a importação — cai em "outros"', async () => {
    const { svc, qr } = makeTxSvc({ row: { tipo_transacao: 'despesa', categoria: '', descricao: 'Item X' }, suggestThrows: true });
    const result = await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const { params } = insertCall(qr);
    expect(params).toContain('outros');
  });
});
