import { ForbiddenException } from '@nestjs/common';
import { ImportCommitService } from './import-commit.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import type { ImportValidationResult } from './import.types';

const DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'stage_name', displayColumn: 'stage_name', dateColumn: 'created_at',
  exportableColumns: ['stage_name'], importableColumns: ['stage_name'],
  filterableColumns: [], sortableColumns: ['stage_name'], searchableColumns: ['stage_name'],
  sensitiveColumns: ['cpf_encrypted'], requiredImportColumns: ['stage_name'],
  supportsExport: true, supportsImport: true,
};

function validResult(rows = 2): ImportValidationResult {
  return {
    entity: 'artists', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
    totalRows: rows, validRows: rows, invalidRows: 0,
    rows: Array.from({ length: rows }, (_, i) => ({ index: i, data: { stage_name: `A${i}` }, valid: true, errors: [], warnings: [] })),
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

describe('ImportCommitService — transactional commit', () => {
  it('valid import commits atomically and forces tenant', async () => {
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

  it('arrays bound to a jsonb column are sent as JSON text (node-pg would send an invalid Postgres array literal)', async () => {
    const withArray = validResult(1);
    withArray.rows[0].data = { stage_name: 'A0', gallery_urls: ['https://cdn/a.png'] };
    const { svc, qr } = makeSvc({
      validation: withArray,
      queryImpl: (sql) => (String(sql).includes('information_schema.columns') ? [{ column_name: 'gallery_urls' }] : []),
    });
    await svc.commit('artists', file, 'tenant-1', 'user-1');
    const insert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT'));
    const cols = String(insert?.[0]).match(/\(([^)]*)\) VALUES/)![1].split(', ');
    const value = (insert?.[1] as unknown[])[cols.indexOf('"gallery_urls"')];
    expect(value).toBe('["https://cdn/a.png"]');
  });

  it('invalid validation does not open a transaction', async () => {
    const bad = validResult(1);
    bad.invalidRows = 1;
    bad.validRows = 0;
    bad.rows[0].valid = false;
    bad.rows[0].errors = [{ column: 'stage_name', message: 'campo obrigatório vazio' }];
    const { svc, qr } = makeSvc({ validation: bad });
    const result = await svc.commit('artists', file, 't', 'u');
    expect(qr.startTransaction).not.toHaveBeenCalled();
    expect(result.importedRows).toBe(0);
  });

  it('duplicate or invalid relationship causes full rollback', async () => {
    const duplicated = makeSvc({ queryImpl: (sql) => (sql.startsWith('SELECT 1') ? [{}] : []) });
    const duplicateResult = await duplicated.svc.commit('artists', file, 't', 'u');
    expect(duplicated.qr.rollbackTransaction).toHaveBeenCalled();
    expect(duplicateResult.errors.some((e) => /já existe/i.test(e))).toBe(true);
    expect(duplicateResult.errors.join(' ')).not.toMatch(/stage_name|create-only/);

    const def = { ...DEF, importableColumns: ['stage_name', 'client_id'] };
    const validation = validResult(1);
    validation.rows[0].data = { stage_name: 'A', client_id: 'c-x' };
    const invalidRelation = makeSvc({ def, validation, queryImpl: () => [] });
    const relationResult = await invalidRelation.svc.commit('artists', file, 't', 'u');
    expect(relationResult.errors.some((e) => /relacionamento inválido/i.test(e))).toBe(true);
    expect(relationResult.errors.join(' ')).not.toMatch(/client_id|="/);
  });

  it('database exception causes rollback and propagates', async () => {
    const { svc, qr } = makeSvc({ queryImpl: (sql) => { if (sql.startsWith('INSERT')) throw new Error('db boom'); return []; } });
    await expect(svc.commit('artists', file, 't', 'u')).rejects.toThrow('db boom');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('returns 403 without tenant', async () => {
    const { svc } = makeSvc();
    await expect(svc.commit('artists', file, undefined, 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ImportCommitService — ISRC normalization/validation (find-fb2cfb1b)', () => {
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

  it('normalizes hyphenated/lowercase ISRC to canonical form before INSERT', async () => {
    const { svc, qr } = makeSvc({ def: PHONOGRAMS_DEF, validation: phonogramsValidation('br-abc-26-00001') });
    const result = await svc.commit('phonograms', file, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const insert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT'));
    expect(insert?.[1]).toContain('BRABC2600001');
  });

  it('rejects malformed ISRC with full rollback and per-row error', async () => {
    const { svc, qr } = makeSvc({ def: PHONOGRAMS_DEF, validation: phonogramsValidation('not-an-isrc') });
    const result = await svc.commit('phonograms', file, 'tenant-1', 'user-1');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(result.importedRows).toBe(0);
    expect(result.errors.some((e) => /ISRC inválido/i.test(e))).toBe(true);
  });
});

describe('ImportCommitService — repeating group on the same sheet', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'nome_ep_album', displayColumn: 'nome_ep_album', dateColumn: 'created_at',
    exportableColumns: ['tipo_lancamento', 'nome_ep_album', 'trackName'],
    importableColumns: ['tipo_lancamento', 'nome_ep_album', 'trackName'],
    filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
    requiredImportColumns: ['nome_ep_album'], supportsExport: true, supportsImport: true,
  };

  function projectsValidation(trackRows?: unknown[]): ImportValidationResult {
    return {
      entity: 'projects', supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
      totalRows: 1, validRows: 1, invalidRows: 0,
      rows: [{
        index: 0,
        data: { tipo_lancamento: 'ep', nome_ep_album: 'Meu EP' },
        valid: true, errors: [], warnings: [],
        repeatingGroups: trackRows ? { tracks: trackRows } : undefined,
      }],
      errors: [], warnings: [],
    };
  }

  it('returns parent record id and writes repeating items', async () => {
    const queryImpl = (sql: string) => sql.startsWith('INSERT INTO "projects"') ? [{ id: 'proj-gerado' }] : [];
    const { svc, qr } = makeSvc({
      def: PROJECTS_DEF,
      validation: projectsValidation([{ trackName: 'Faixa 1', composers: ['Fulano'] }]),
      queryImpl,
    });
    const result = await svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const parentInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT INTO "projects"'));
    expect(parentInsert?.[0]).toContain('RETURNING "id"');
    const trackInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).includes('"project_tracks"'));
    expect(trackInsert).toBeDefined();
  });

  it('performs a simple insert when there are no repeating items', async () => {
    const { svc, qr } = makeSvc({ def: PROJECTS_DEF, validation: projectsValidation(), queryImpl: () => [] });
    await svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1');
    const parentInsert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT INTO "projects"'));
    expect(parentInsert?.[0]).not.toContain('RETURNING');
  });

  it('fails explicitly if the parent insert does not return an id', async () => {
    const { svc } = makeSvc({ def: PROJECTS_DEF, validation: projectsValidation([{ trackName: 'Faixa' }]), queryImpl: () => [] });
    await expect(svc.commit('projects', { filename: 'projects.xlsx', content: Buffer.from('xlsx') }, 'tenant-1', 'user-1')).rejects.toThrow(/returned no id/);
  });
});

describe('ImportCommitService — transactions: physical columns and category (Task X)', () => {
  const TRANSACTIONS_DEF: ReportEntityDefinition = {
    entityName: 'TransactionEntity', tableName: 'transactions', category: EntityCategory.REPORTABLE,
    identityColumn: 'description', displayColumn: 'description', dateColumn: 'created_at',
    exportableColumns: ['transaction_type', 'category', 'description', 'amount', 'transaction_date', 'status'],
    importableColumns: ['transaction_type', 'category', 'description', 'amount', 'transaction_date', 'status'],
    filterableColumns: ['status', 'transaction_type', 'category'], sortableColumns: [], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['description'], supportsExport: true, supportsImport: true,
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
        ? jest.fn().mockRejectedValue(new Error('matcher unavailable'))
        : jest.fn().mockResolvedValue(opts.suggestion ?? null),
    } as any;
    const svc = new ImportCommitService(ds, engine, definitions, audit, encryption, financeCategoryRules);
    return { svc, qr, financeCategoryRules };
  }

  function insertCall(qr: ReturnType<typeof makeQR>) {
    const call = qr.query.mock.calls.find((c: any[]) => String(c[0]).startsWith('INSERT'));
    return { sql: String(call?.[0]), params: call?.[1] as unknown[] };
  }

  it('writes the logical transaction_type to the physical type column and canonicalizes a legacy value (despesa → expense)', async () => {
    const { svc, qr } = makeTxSvc({ row: { transaction_type: 'despesa', category: 'aluguel', description: 'Aluguel sala', transaction_date: '2026-01-05' } });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    const { sql, params } = insertCall(qr);
    expect(sql).toContain('"type"');
    expect(sql).not.toContain('"transaction_type"');
    expect(sql).toContain('"transaction_date"');
    expect(params).toContain('expense');
    expect(params).not.toContain('despesa');
  });

  it('explicit category (not "outros") is preserved and the matcher is not consulted', async () => {
    const { svc, qr, financeCategoryRules } = makeTxSvc({ row: { transaction_type: 'expense', category: 'aluguel', description: 'Aluguel sala' } });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(financeCategoryRules.suggestCategoryForTransaction).not.toHaveBeenCalled();
    const { params } = insertCall(qr);
    expect(params).toContain('aluguel');
  });

  it('empty category in the spreadsheet triggers the matcher and applies the suggestion (same service as manual creation)', async () => {
    const { svc, qr, financeCategoryRules } = makeTxSvc({
      row: { transaction_type: 'despesa', category: '', description: 'Compra de cabos' },
      suggestion: { categoryId: 'cat-1', categoryName: 'equipamentos', ruleId: 'rule-1' },
    });
    await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(financeCategoryRules.suggestCategoryForTransaction).toHaveBeenCalledWith('tenant-1', 'EXPENSE', 'Compra de cabos');
    const { params } = insertCall(qr);
    expect(params).toContain('equipamentos');
  });

  it('empty category with no match falls back to "outros" and the INSERT still satisfies the NOT NULL column', async () => {
    const { svc, qr } = makeTxSvc({ row: { transaction_type: 'expense', category: '', description: 'Item desconhecido' }, suggestion: null });
    const result = await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const { sql, params } = insertCall(qr);
    expect(sql).toContain('"category"');
    expect(params).toContain('outros');
  });

  it('unavailable matcher (exception) does not break the import — falls back to "outros"', async () => {
    const { svc, qr } = makeTxSvc({ row: { transaction_type: 'expense', category: '', description: 'Item X' }, suggestThrows: true });
    const result = await svc.commit('transactions', { filename: 'tx.xlsx', content: Buffer.from('x') }, 'tenant-1', 'user-1');
    expect(result.importedRows).toBe(1);
    const { params } = insertCall(qr);
    expect(params).toContain('outros');
  });
});
