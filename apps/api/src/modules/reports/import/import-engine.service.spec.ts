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
  identityColumn: 'stage_name', displayColumn: 'stage_name', dateColumn: 'created_at',
  exportableColumns: ['stage_name', 'email', 'status', 'categoria'],
  importableColumns: ['stage_name', 'email', 'status', 'categoria'],
  filterableColumns: ['status'], sortableColumns: ['stage_name'], searchableColumns: ['stage_name'],
  sensitiveColumns: ['cpf_encrypted'], requiredImportColumns: ['stage_name'],
  supportsExport: true, supportsImport: true,
};

const REPORT = {
  tableName: 'artists', label: 'Artistas', reportable: true, hasSoftDelete: true,
  columns: [
    { name: 'stage_name', type: 'String', isEnum: false, nullable: false, hasDefault: false },
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

describe('ImportEngineService — single-sheet XLSX', () => {
  it('maps pt-BR headers and validates', async () => {
    const result = await makeEngine().validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'E-mail', 'Situação', 'Categoria'], ['João', 'joao@x.com', 'ativo', 'solo']]), 'tenant-1',
    );
    expect(result.validRows).toBe(1);
    expect(result.rows[0].data).toMatchObject({ stage_name: 'João', email: 'joao@x.com', status: 'ativo', categoria: 'solo' });
  });

  it('rejects missing or empty required column', async () => {
    const defWithRequiredCategory = { ...DEF, requiredImportColumns: ['stage_name', 'categoria'] };
    const absent = await makeEngine({ def: defWithRequiredCategory }).validateFile(
      'artists', workbook('Artistas', [['Nome artístico'], ['Ana']]), 't',
    );
    expect(absent.errors).toContain('Coluna obrigatória ausente no arquivo: "Categoria".');
    expect(absent.errors.join(' ')).not.toContain('"categoria"');
    const empty = await makeEngine({ def: defWithRequiredCategory }).validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'Categoria'], ['Ana', '']]), 't',
    );
    expect(empty.rows[0].valid).toBe(false);
  });

  it('rejects invalid enum, sensitive column and non-XLSX extension', async () => {
    const enumResult = await makeEngine().validateFile('artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'Situação'], ['Ana', 'solo', 'explodido']]), 't');
    expect(enumResult.rows[0].valid).toBe(false);
    const sensitive = await makeEngine().validateFile('artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'cpf_encrypted'], ['Ana', 'solo', '123']]), 't');
    expect(sensitive.errors.some((e) => /sensível/i.test(e))).toBe(true);
    await expect(
      makeEngine().validateFile('artists', { filename: 'artists.txt', content: Buffer.from('x') }, 't'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores tenant_id and warns about unknown column', async () => {
    const result = await makeEngine().validateFile(
      'artists', workbook('Artistas', [['Nome artístico', 'Categoria', 'tenant_id', 'Campo Maluco'], ['Ana', 'solo', 'outro', 'x']]), 't',
    );
    expect(result.ignoredColumns).toContain('tenant_id');
    expect(result.unknownColumns).toContain('Campo Maluco');
    expect(result.rows[0].data).not.toHaveProperty('tenant_id');
  });

  it('template contains exactly one sheet', async () => {
    const result = await makeEngine().buildTemplate('artists', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Artistas']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Artistas!, { header: 1 });
    expect(rows[0]).toHaveLength(DEF.importableColumns.length);
  });

  it('template generates headers in the canonical order of def.importableColumns (not Object.keys, not alphabetical)', async () => {
    const result = await makeEngine().buildTemplate('artists', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Artistas!, { header: 1 });
    expect(rows[0]).toEqual(['Nome artístico', 'E-mail', 'Situação', 'Categoria']);
  });

  it('maps by HEADER, not physical position: out-of-order columns resolve to the same canonical key', async () => {
    // The physical order of the file is the reverse of the contract's canonical order — the
    // mapper resolves by label/name, never by column index.
    const result = await makeEngine().validateFile(
      'artists',
      workbook('Artistas', [
        ['Categoria', 'Situação', 'E-mail', 'Nome artístico'],
        ['solo', 'ativo', 'joao@x.com', 'João'],
      ]),
      't',
    );
    expect(result.rows[0].data).toEqual({
      categoria: 'solo', status: 'ativo', email: 'joao@x.com', stage_name: 'João',
    });
  });

  it('export and import agree: exported template is accepted back by the importer without unknown columns', async () => {
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
      stage_name: expect.any(String),
      email: expect.any(String),
      categoria: expect.any(String),
    }));
  });

  it('keeps tenant, entity and import-support guards', async () => {
    const file = workbook('Artistas', [['Nome artístico', 'Categoria'], ['A', 'solo']]);
    await expect(makeEngine().validateFile('artists', file, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(makeEngine({ hasEntity: false }).validateFile('nope', file, 't')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeEngine({ def: { ...DEF, supportsImport: false } }).validateFile('artists', file, 't')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ImportEngineService — projects on a single sheet', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'nome_ep_album', displayColumn: 'nome_ep_album', dateColumn: 'created_at',
    exportableColumns: ['tipo_lancamento', 'nome_ep_album', 'notes', 'status_projeto', 'trackName', 'soloFeat', 'originalRemix', 'instrumental', 'trackDurationMinutes', 'trackDurationSeconds', 'musicGenre', 'trackLanguage', 'composers', 'performers', 'producers', 'lyrics', 'audioFiles', 'sort_order'],
    importableColumns: ['tipo_lancamento', 'nome_ep_album', 'notes', 'status_projeto', 'trackName', 'soloFeat', 'originalRemix', 'instrumental', 'trackDurationMinutes', 'trackDurationSeconds', 'musicGenre', 'trackLanguage', 'composers', 'performers', 'producers', 'lyrics', 'audioFiles', 'sort_order'],
    filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
    requiredImportColumns: ['nome_ep_album'], supportsExport: true, supportsImport: true,
  };
  const projectsReport = {
    tableName: 'projects', label: 'Projetos', reportable: true, hasSoftDelete: false,
    columns: [
      { name: 'type', type: 'String', isEnum: false, nullable: false, hasDefault: false },
      { name: 'title', type: 'String', isEnum: false, nullable: false, hasDefault: false },
      { name: 'notes', type: 'String', isEnum: false, nullable: true, hasDefault: false },
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

  it('keeps one preview row per track; the commit groups consecutive rows by project', async () => {
    const file = workbook('Projetos', [
      ['Tipo de Lançamento', 'Nome do EP/Álbum', 'Status', 'Nome da música', 'Compositores'],
      ['ep', 'Meu EP', 'planejamento', 'Faixa 1', 'Fulano | Ciclano'],
      ['ep', 'Meu EP', 'planejamento', 'Faixa 2', 'Beltrano'],
    ]);
    const result = await makeProjectsEngine().validateFile('projects', file, 't');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data).toMatchObject({
      nome_ep_album: 'Meu EP',
      trackName: 'Faixa 1',
      composers: 'Fulano | Ciclano',
    });
    expect(result.rows[1].data).toMatchObject({
      nome_ep_album: 'Meu EP',
      trackName: 'Faixa 2',
      composers: 'Beltrano',
    });
  });

  it('projects template contains a single sheet and all columns', async () => {
    const result = await makeProjectsEngine().buildTemplate('projects', 't');
    const wb = XLSX.read(result.body, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Projetos']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Projetos!, { header: 1 });
    expect(rows[0]).toContain('Nome da música');
    expect(rows[0]).toContain('Arquivos de Áudio (MP3/WAV)');
  });
});
