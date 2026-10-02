import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ExportEngineService } from './export-engine.service';
import { ExportQueryBuilderService } from './export-query-builder.service';
import { ExportFormatService } from './export-format.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import { EXPORT_DETECTION_LIMIT } from './export.types';
import { ImportParserService } from '../import/import-parser.service';
import { ImportMapperService } from '../import/import-mapper.service';
import { canonicalImportValue } from '../import/import-value-canonicalizers';
import { canonicalProjectTrackImportRows } from '../../projects/project-track-vocabulary';
import { ACCOUNTING_SUMMARY_TABLE_NAME } from '../report-module-registry';

const ARTISTS_DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'stage_name', displayColumn: 'stage_name', dateColumn: 'created_at',
  exportableColumns: ['stage_name', 'email', 'status'], importableColumns: ['stage_name'],
  filterableColumns: ['status'], sortableColumns: ['stage_name', 'created_at'],
  searchableColumns: ['stage_name'], sensitiveColumns: ['cpf_encrypted'],
  requiredImportColumns: ['stage_name'], supportsExport: true, supportsImport: true,
};

const params = (extra: Record<string, unknown> = {}) => ({ format: 'xlsx' as const, ...extra });

function makeEngine(options: {
  tableName?: string; label?: string; reportable?: boolean; hasEntity?: boolean;
  definition?: ReportEntityDefinition | null; query?: jest.Mock;
} = {}) {
  const tableName = options.tableName ?? 'artists';
  const report = options.hasEntity === false ? undefined : {
    tableName, label: options.label ?? 'Artistas', reportable: options.reportable ?? true,
    hasSoftDelete: false, columns: [],
  };
  const metadata = { scan: () => ({ entities: report ? [report] : [] }) } as any;
  const definitions = { getDefinition: () => options.definition === undefined ? ARTISTS_DEF : options.definition } as any;
  const ds = { query: options.query ?? jest.fn().mockResolvedValue([{ stage_name: 'A', email: 'a@x.com', status: 'active' }]) } as any;
  const audit = { record: jest.fn() } as any;
  const tableGuard = { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as any;
  const encryption = { decryptNullable: jest.fn((value: string | null) => value) } as any;
  return {
    engine: new ExportEngineService(ds, metadata, definitions, new ExportQueryBuilderService(), new ExportFormatService(), audit, tableGuard, encryption),
    ds, audit,
  };
}

describe('ExportEngineService', () => {
  it('exports tenant-scoped XLSX and audits', async () => {
    const { engine, ds, audit } = makeEngine();
    const result = await engine.export('artists', params(), 'tenant-1', 'user-1');
    expect(result.format).toBe('xlsx');
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(ds.query.mock.calls[0][1][0]).toBe('tenant-1');
    expect(ds.query.mock.calls[0][1].at(-1)).toBe(EXPORT_DETECTION_LIMIT);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: 'artists', tenantId: 'tenant-1', status: 'success' }));
  });

  it('rejects unsupported format', async () => {
    const { engine } = makeEngine();
    await expect(engine.export('artists', params({ format: 'other' as any }), 't', 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses pt-BR headers', async () => {
    const { engine } = makeEngine();
    const result = await engine.export('artists', params(), 't', 'u');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toContain('Nome artístico');
    expect(rows[0]).not.toContain('stage_name');
  });

  it('fails explicitly and audits when the result set exceeds the limit; never generates a partial file', async () => {
    const rows = Array.from({ length: EXPORT_DETECTION_LIMIT }, (_, index) => ({
      stage_name: `Artista ${index}`,
      email: `artista${index}@example.com`,
      status: 'active',
    }));
    const { engine, audit } = makeEngine({ query: jest.fn().mockResolvedValue(rows) });

    await expect(engine.export('artists', params(), 'tenant-1', 'user-1'))
      .rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'artists',
      tenantId: 'tenant-1',
      status: 'failed',
      recordCount: 0,
    }));
  });

  it('rejects unavailable entity, contract without export and missing tenant', async () => {
    await expect(makeEngine({ hasEntity: false }).engine.export('nope', params(), 't', 'u')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(makeEngine({ reportable: false }).engine.export('artists', params(), 't', 'u')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(makeEngine({ definition: { ...ARTISTS_DEF, supportsExport: false } }).engine.export('artists', params(), 't', 'u')).rejects.toBeInstanceOf(BadRequestException);
    await expect(makeEngine().engine.export('artists', params(), undefined, 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Regression: final XLSX order = canonical order (definition.exportableColumns)
  // filtered by the selection — never the order the caller sent in `columns`.
  it('selection out of canonical order is reordered by the canonical config (headers and values follow the same sequence)', async () => {
    const query = jest.fn().mockResolvedValue([{ stage_name: 'A', status: 'active' }]);
    const { engine } = makeEngine({ query });
    // Canonical: stage_name, email, status. Caller selects status before stage_name.
    const result = await engine.export('artists', params({ columns: ['status', 'stage_name'] }), 'tenant-1', 'user-1');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['Nome artístico', 'Situação']);
    expect(rows[1]).toEqual(['A', 'Ativo']);
  });
});

describe('ExportEngineService — computed report (Contabilidade): canonical order also applies', () => {
  const ACCOUNTING_DEF: ReportEntityDefinition = {
    entityName: 'AccountingSummary', tableName: ACCOUNTING_SUMMARY_TABLE_NAME, category: EntityCategory.REPORTABLE,
    identityColumn: 'artist', displayColumn: 'artist', dateColumn: 'created_at',
    exportableColumns: ['artist', 'revenue', 'expenses', 'result', 'margin'],
    importableColumns: [], filterableColumns: [], sortableColumns: [], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['artist'], supportsExport: true, supportsImport: false,
  };

  it('selection out of order in the computed report is also reordered by the canonical config', async () => {
    const query = jest.fn().mockResolvedValue([{ artist: 'Artista X', revenue: '1000', expenses: '400' }]);
    const { engine } = makeEngine({
      tableName: ACCOUNTING_SUMMARY_TABLE_NAME, label: 'Contabilidade', definition: ACCOUNTING_DEF, query,
    });
    // Canonical: artist, revenue, expenses, result, margin. Caller selects out of order.
    const result = await engine.export(
      ACCOUNTING_SUMMARY_TABLE_NAME,
      params({ columns: ['margin', 'artist', 'revenue'] }),
      'tenant-1', 'user-1',
    );
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['Artista', 'Receitas', 'Margem (%)']);
  });
});

describe('Projetos — workbook faithful to the modal and with a single sheet', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'projectTitle', displayColumn: 'projectTitle', dateColumn: 'created_at',
    exportableColumns: [
      'projectType', 'projectTitle', 'notes', 'projectStatus',
      'trackName', 'soloFeat', 'originalRemix', 'instrumental',
      'trackDurationMinutes', 'trackDurationSeconds', 'musicGenre', 'trackLanguage',
      'composers', 'performers', 'producers', 'lyrics', 'audioFiles', 'sort_order',
    ],
    importableColumns: [], filterableColumns: [], sortableColumns: ['created_at'], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['projectTitle'], supportsExport: true, supportsImport: true,
  };

  it('repeats general data per track, without technical IDs or a second sheet', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{
        __internal_id: '00000000-0000-0000-0000-000000000001',
        projectType: 'ep', projectTitle: 'Meu EP', notes: 'Obs', projectStatus: 'in_progress',
      }])
      .mockResolvedValueOnce([
        { id: 'track-1', project_id: '00000000-0000-0000-0000-000000000001', name: 'Faixa 1', solo_feat: 'solo', original_remix: 'original', instrumental: 'no', duration_minutes: '3', duration_seconds: '5', music_genre: 'pop', language: 'pt', lyrics: 'Letra 1', audio_url: 'audio-1.wav', sort_order: 0 },
        { id: 'track-2', project_id: '00000000-0000-0000-0000-000000000001', name: 'Faixa 2', solo_feat: 'feat', original_remix: 'remix', instrumental: 'sim', duration_minutes: '4', duration_seconds: '10', music_genre: 'rap', language: 'portugues', lyrics: 'Letra 2', audio_url: 'audio-2.wav', sort_order: 1 },
      ])
      .mockResolvedValueOnce([
        { project_track_id: 'track-1', name: 'Compositor A', role: 'composer' },
        { project_track_id: 'track-1', name: 'Intérprete A', role: 'performer' },
        { project_track_id: 'track-1', name: 'Produtor A', role: 'producer' },
      ]);

    const { engine } = makeEngine({ tableName: 'projects', label: 'Projetos', definition: PROJECTS_DEF, query });
    const result = await engine.export('projects', params(), 'tenant-1', 'user-1');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['Projetos']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Projetos, { header: 1 });
    expect(rows[0]).toEqual([
      'Tipo de Lançamento', 'Nome do EP/Álbum', 'Observações', 'Status',
      'Nome da música', 'Solo/Feat', 'Original/Remix', 'Instrumental',
      'Duração (minutos)', 'Duração (segundos)', 'Gênero musical', 'Idioma da Música',
      'Compositores', 'Intérpretes', 'Produtores', 'Letra', 'Arquivos de Áudio (MP3/WAV)', 'Ordem',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      'EP', 'Meu EP', 'Obs', 'Em andamento', 'Faixa 1', 'Solo', 'Original', 'Não',
      '3', '5', 'pop', 'Português', 'Compositor A', 'Intérprete A', 'Produtor A', 'Letra 1', 'audio-1.wav', '0',
    ]);
    expect(rows[2]?.[0]).toBe('EP');
    expect(rows[2]?.[5]).toBe('Feat');
    expect(rows[2]?.[6]).toBe('Remix');
    expect(rows[2]?.[4]).toBe('Faixa 2');
    // a row not yet backfilled (sim / portugues) exports the same PT-BR labels
    expect(rows[2]?.[7]).toBe('Sim');
    expect(rows[2]?.[11]).toBe('Português');
    expect(JSON.stringify(rows)).not.toContain('Projeto ID de referência');
    expect(JSON.stringify(rows)).not.toContain('Músicas do Projeto');
  });

  it('round-trips: the exported projects workbook passes the importer parser and maps every header and enum cell back', async () => {
    const projectId = '00000000-0000-0000-0000-000000000001';
    const query = jest.fn()
      .mockResolvedValueOnce([{ __internal_id: projectId, projectType: 'album', projectTitle: 'Meu Album', notes: 'Obs', projectStatus: 'in_progress' }])
      .mockResolvedValueOnce([
        { id: 'track-1', project_id: projectId, name: 'Faixa 1', solo_feat: 'feat', original_remix: 'remix', instrumental: 'yes', duration_minutes: '3', duration_seconds: '5', music_genre: 'pop', language: 'pt', lyrics: 'x', audio_url: 'a.wav', sort_order: 0 },
      ])
      .mockResolvedValueOnce([]);
    const def = { ...PROJECTS_DEF, importableColumns: PROJECTS_DEF.exportableColumns };
    const { engine } = makeEngine({ tableName: 'projects', label: 'Projetos', definition: def, query });
    const result = await engine.export('projects', params(), 'tenant-1', 'user-1');

    const parsed = await new ImportParserService().parse('projetos.xlsx', result.body as Buffer, 'Projetos');
    const mapped = new ImportMapperService().build(def, parsed.headers);
    expect(mapped.unknownColumns).toEqual([]);
    expect(mapped.ignoredColumns).toEqual([]);
    expect(Object.values(mapped.mapping)).toEqual(def.exportableColumns);

    const row = parsed.rows[0]!;
    expect(row['Tipo de Lançamento']).toBe('Álbum');
    expect(canonicalImportValue('projects', 'type', row['Tipo de Lançamento'])).toBe('album');
    const [track] = canonicalProjectTrackImportRows([{ soloFeat: row['Solo/Feat'], originalRemix: row['Original/Remix'], instrumental: row['Instrumental'] }]) as Array<Record<string, unknown>>;
    expect(track).toEqual({ soloFeat: 'feat', originalRemix: 'remix', instrumental: 'yes' });
  });

  it('a workbook exported before the rename (em dash duration headers) is still accepted and maps to the same columns', async () => {
    const def = { ...PROJECTS_DEF, importableColumns: PROJECTS_DEF.exportableColumns };
    const ws = XLSX.utils.aoa_to_sheet([['Nome do EP/Álbum', 'Duração — Minutos', 'Duração — Segundos'], ['Meu EP', '3', '5']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projetos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const parsed = await new ImportParserService().parse('projetos.xlsx', buffer, 'Projetos');
    const mapped = new ImportMapperService().build(def, parsed.headers);
    expect(mapped.unknownColumns).toEqual([]);
    expect(Object.values(mapped.mapping)).toEqual(['projectTitle', 'trackDurationMinutes', 'trackDurationSeconds']);
    expect(parsed.rows[0]!['Duração (minutos)']).toBe('3');
  });
});
