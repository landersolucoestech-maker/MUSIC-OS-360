import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportEngineService } from './import-engine.service';
import { ImportParserService } from './import-parser.service';
import { ImportMapperService } from './import-mapper.service';
import { ImportValidationService } from './import-validation.service';
import { ExportFormatService } from '../export/export-format.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';

const DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'nome_artistico', displayColumn: 'nome_artistico', dateColumn: 'created_at',
  exportableColumns: ['nome_artistico', 'email', 'status', 'categoria'],
  importableColumns: ['nome_artistico', 'email', 'status', 'categoria'],
  filterableColumns: ['status'], sortableColumns: ['nome_artistico'], searchableColumns: ['nome_artistico'],
  sensitiveColumns: ['cpf_encrypted'], requiredImportColumns: ['nome_artistico'],
  supportsExport: true, supportsImport: true,
};

const REPORT = {
  tableName: 'artists', label: 'Artistas', reportable: true, hasSoftDelete: true,
  columns: [
    { name: 'nome_artistico', type: 'String', isEnum: false, nullable: false, hasDefault: false },
    { name: 'email', type: 'String', isEnum: false, nullable: true, hasDefault: false },
    { name: 'status', type: 'String', isEnum: true, enumValues: ['ativo', 'inativo'], nullable: true, hasDefault: false },
    { name: 'cpf_encrypted', type: 'String', isEnum: false, nullable: true, hasDefault: false },
    { name: 'tenant_id', type: 'String', isEnum: false, nullable: false, hasDefault: false },
    { name: 'categoria', type: 'String', isEnum: false, nullable: false, hasDefault: false },
  ],
};

function workbook(name: string, rows: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return { filename: `${name}.xlsx`, content: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer };
}

function makeEngine(opts: { reportable?: boolean; hasEntity?: boolean; def?: ReportEntityDefinition | null } = {}) {
  const report = opts.hasEntity === false ? undefined : { ...REPORT, reportable: opts.reportable ?? true };
  const metadata = { scan: () => ({ entities: report ? [report] : [] }) } as any;
  const definitions = { getDefinition: () => (opts.def === undefined ? DEF : opts.def) } as any;
  const tableGuard = { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as any;
  return new ImportEngineService(metadata, definitions, new ImportParserService(), new ImportMapperService(), new ImportValidationService(), tableGuard, new ExportFormatService());
}

describe('ImportEngineService — XLSX de aba única', () => {
  it('mapeia cabeçalhos pt-BR e valida', async () => {
    const result = await makeEngine().validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'E-mail', 'Situação', 'Categoria'], ['João', 'joao@x.com', 'ativo', 'solo']]), 'tenant-1',
    );
    expect(result.validRows).toBe(1);
    expect(result.rows[0].data).toMatchObject({ nome_artistico: 'João', email: 'joao@x.com', status: 'ativo', categoria: 'solo' });
  });

  it('rejeita coluna obrigatória ausente ou vazia', async () => {
    const defWithRequiredCategory = { ...DEF, requiredImportColumns: ['nome_artistico', 'categoria'] };
    const absent = await makeEngine({ def: defWithRequiredCategory }).validateFile(
      'artists', workbook('Artistas', [['Nome artístico'], ['Ana']]), 't',
    );
    expect(absent.errors.some((e) => e.includes('categoria'))).toBe(true);
    const empty = await makeEngine({ def: defWithRequiredCategory }).validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'Categoria'], ['Ana', '']]), 't',
    );
    expect(empty.rows[0].valid).toBe(false);
  });

  it('rejeita enum inválido, coluna sensível e extensão não-XLSX', async () => {
    const enumResult = await makeEngine().validateFile('artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'Situação'], ['Ana', 'solo', 'explodido']]), 't');
    expect(enumResult.rows[0].valid).toBe(false);
    const sensitive = await makeEngine().validateFile('artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'cpf_encrypted'], ['Ana', 'solo', '123']]), 't');
    expect(sensitive.errors.some((e) => /sensível/i.test(e))).toBe(true);
    await expect(
      makeEngine().validateFile('artists', { filename: 'artists.txt', content: Buffer.from('x') }, 't'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignora tenant_id e avisa sobre coluna desconhecida', async () => {
    const result = await makeEngine().validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'tenant_id', 'Campo Maluco'], ['Ana', 'solo', 'outro', 'x']]), 't',
    );
    expect(result.ignoredColumns).toContain('tenant_id');
    expect(result.unknownColumns).toContain('Campo Maluco');
    expect(result.rows[0].data).not.toHaveProperty('tenant_id');
  });

  it('template contém exatamente uma aba', async () => {
    const result = await makeEngine().buildTemplate('artists', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Artistas']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Artistas!, { header: 1 });
    expect(rows[0]).toHaveLength(DEF.importableColumns.length);
  });

  it('template gera headers na ordem canônica de def.importableColumns (não Object.keys, não alfabética)', async () => {
    const result = await makeEngine().buildTemplate('artists', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Artistas!, { header: 1 });
    expect(rows[0]).toEqual(['Nome artístico', 'E-mail', 'Situação', 'Categoria']);
  });

  it('mapeia por HEADER, não por posição física: colunas fora de ordem resolvem para a mesma key canônica', async () => {
    // Ordem física do arquivo é a inversa da ordem canônica do contrato — o
    // mapper resolve por rótulo/nome, nunca por índice de coluna.
    const result = await makeEngine().validateFile(
      'artists',
      workbook('Artistas', [
        ['Categoria', 'Situação', 'E-mail', 'Nome artístico'],
        ['solo', 'ativo', 'joao@x.com', 'João'],
      ]),
      't',
    );
    expect(result.rows[0].data).toEqual({
      categoria: 'solo', status: 'ativo', email: 'joao@x.com', nome_artistico: 'João',
    });
  });

  it('exportação e importação concordam: template exportado é aceito de volta pelo importador sem colunas desconhecidas', async () => {
    const engine = makeEngine();
    const template = await engine.buildTemplate('artists', 't');
    const wb = XLSX.read(template.body, { type: 'buffer' });
    const templateRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Artistas!, { header: 1 });

    const result = await engine.validateFile(
      'artists',
      workbook('Artistas', templateRows as unknown[][]),
      't',
    );
    expect(result.unknownColumns).toEqual([]);
    expect(result.rows[0].data).toEqual(expect.objectContaining({
      nome_artistico: expect.any(String),
      email: expect.any(String),
      categoria: expect.any(String),
    }));
  });

  it('mantém guardas de tenant, entidade e suporte de importação', async () => {
    const file = workbook('Artistas', [['Nome artístico', 'Categoria'], ['A', 'solo']]);
    await expect(makeEngine().validateFile('artists', file, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(makeEngine({ hasEntity: false }).validateFile('nope', file, 't')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeEngine({ def: { ...DEF, supportsImport: false } }).validateFile('artists', file, 't')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ImportEngineService — projetos em uma única aba', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'nome_ep_album', displayColumn: 'nome_ep_album', dateColumn: 'created_at',
    exportableColumns: ['tipo_lancamento', 'nome_ep_album', 'observacoes', 'status_projeto', 'nome_musica', 'soloFeat', 'originalRemix', 'instrumental', 'duracaoMinutos', 'duracaoSegundos', 'generoMusical', 'idiomaMusica', 'compositores', 'interpretes', 'produtores', 'letra', 'arquivosAudio', 'sort_order'],
    importableColumns: ['tipo_lancamento', 'nome_ep_album', 'observacoes', 'status_projeto', 'nome_musica', 'soloFeat', 'originalRemix', 'instrumental', 'duracaoMinutos', 'duracaoSegundos', 'generoMusical', 'idiomaMusica', 'compositores', 'interpretes', 'produtores', 'letra', 'arquivosAudio', 'sort_order'],
    filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
    requiredImportColumns: ['nome_ep_album'], supportsExport: true, supportsImport: true,
  };
  const projectsReport = {
    tableName: 'projects', label: 'Projetos', reportable: true, hasSoftDelete: false,
    columns: [
      { name: 'type', type: 'String', isEnum: false, nullable: false, hasDefault: false },
      { name: 'title', type: 'String', isEnum: false, nullable: false, hasDefault: false },
      { name: 'observacoes', type: 'String', isEnum: false, nullable: true, hasDefault: false },
      { name: 'status', type: 'String', isEnum: false, nullable: false, hasDefault: true },
    ],
  };
  const makeProjectsEngine = () => new ImportEngineService(
    { scan: () => ({ entities: [projectsReport] }) } as any,
    { getDefinition: () => PROJECTS_DEF } as any,
    new ImportParserService(), new ImportMapperService(), new ImportValidationService(),
    { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as any,
    new ExportFormatService(),
  );

  it('mantém uma linha de preview por música; o commit agrupa linhas consecutivas pelo projeto', async () => {
    const file = workbook('Projetos', [
      ['Tipo de Lançamento', 'Nome do EP/Álbum', 'Status', 'Nome da música', 'Compositores'],
      ['ep', 'Meu EP', 'planejamento', 'Faixa 1', 'Fulano | Ciclano'],
      ['ep', 'Meu EP', 'planejamento', 'Faixa 2', 'Beltrano'],
    ]);
    const result = await makeProjectsEngine().validateFile('projects', file, 't');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data).toMatchObject({
      nome_ep_album: 'Meu EP',
      nome_musica: 'Faixa 1',
      compositores: 'Fulano | Ciclano',
    });
    expect(result.rows[1].data).toMatchObject({
      nome_ep_album: 'Meu EP',
      nome_musica: 'Faixa 2',
      compositores: 'Beltrano',
    });
  });

  it('template de projetos contém uma única aba e todas as colunas', async () => {
    const result = await makeProjectsEngine().buildTemplate('projects', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Projetos']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Projetos!, { header: 1 });
    expect(rows[0]).toContain('Nome da música');
    expect(rows[0]).toContain('Arquivos de Áudio (MP3/WAV)');
  });
});
