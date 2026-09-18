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
import { ACCOUNTING_SUMMARY_TABLE_NAME } from '../report-module-registry';

const ARTISTS_DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'nome_artistico', displayColumn: 'nome_artistico', dateColumn: 'created_at',
  exportableColumns: ['nome_artistico', 'email', 'status'], importableColumns: ['nome_artistico'],
  filterableColumns: ['status'], sortableColumns: ['nome_artistico', 'created_at'],
  searchableColumns: ['nome_artistico'], sensitiveColumns: ['cpf_encrypted'],
  requiredImportColumns: ['nome_artistico'], supportsExport: true, supportsImport: true,
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
  const ds = { query: options.query ?? jest.fn().mockResolvedValue([{ nome_artistico: 'A', email: 'a@x.com', status: 'ativo' }]) } as any;
  const audit = { record: jest.fn() } as any;
  const tableGuard = { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as any;
  const encryption = { decryptNullable: jest.fn((value: string | null) => value) } as any;
  return {
    engine: new ExportEngineService(ds, metadata, definitions, new ExportQueryBuilderService(), new ExportFormatService(), audit, tableGuard, encryption),
    ds, audit,
  };
}

describe('ExportEngineService', () => {
  it('exporta XLSX tenant-scoped e audita', async () => {
    const { engine, ds, audit } = makeEngine();
    const result = await engine.export('artists', params(), 'tenant-1', 'user-1');
    expect(result.format).toBe('xlsx');
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(ds.query.mock.calls[0][1][0]).toBe('tenant-1');
    expect(ds.query.mock.calls[0][1].at(-1)).toBe(EXPORT_DETECTION_LIMIT);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: 'artists', tenantId: 'tenant-1', status: 'success' }));
  });

  it('rejeita formato não suportado', async () => {
    const { engine } = makeEngine();
    await expect(engine.export('artists', params({ format: 'other' as any }), 't', 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa cabeçalhos pt-BR', async () => {
    const { engine } = makeEngine();
    const result = await engine.export('artists', params(), 't', 'u');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toContain('Nome artístico');
    expect(rows[0]).not.toContain('nome_artistico');
  });

  it('falha explicitamente e audita quando o conjunto excede o limite; nunca gera arquivo parcial', async () => {
    const rows = Array.from({ length: EXPORT_DETECTION_LIMIT }, (_, index) => ({
      nome_artistico: `Artista ${index}`,
      email: `artista${index}@example.com`,
      status: 'ativo',
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

  it('rejeita entidade indisponível, contrato sem export e tenant ausente', async () => {
    await expect(makeEngine({ hasEntity: false }).engine.export('nope', params(), 't', 'u')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(makeEngine({ reportable: false }).engine.export('artists', params(), 't', 'u')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(makeEngine({ definition: { ...ARTISTS_DEF, supportsExport: false } }).engine.export('artists', params(), 't', 'u')).rejects.toBeInstanceOf(BadRequestException);
    await expect(makeEngine().engine.export('artists', params(), undefined, 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Regressão: ordem final do XLSX = ordem canônica (definition.exportableColumns)
  // filtrada pela seleção — nunca a ordem em que o chamador enviou `columns`.
  it('seleção fora da ordem canônica é reordenada pela config canônica (headers e valores seguem a mesma sequência)', async () => {
    const query = jest.fn().mockResolvedValue([{ nome_artistico: 'A', status: 'ativo' }]);
    const { engine } = makeEngine({ query });
    // Canônico: nome_artistico, email, status. Chamador seleciona status antes de nome_artistico.
    const result = await engine.export('artists', params({ columns: ['status', 'nome_artistico'] }), 'tenant-1', 'user-1');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['Nome artístico', 'Situação']);
    expect(rows[1]).toEqual(['A', 'ativo']);
  });
});

describe('ExportEngineService — relatório computado (Contabilidade): ordem canônica também se aplica', () => {
  const ACCOUNTING_DEF: ReportEntityDefinition = {
    entityName: 'AccountingSummary', tableName: ACCOUNTING_SUMMARY_TABLE_NAME, category: EntityCategory.REPORTABLE,
    identityColumn: 'artista', displayColumn: 'artista', dateColumn: 'created_at',
    exportableColumns: ['artista', 'receitas', 'despesas', 'resultado', 'margem'],
    importableColumns: [], filterableColumns: [], sortableColumns: [], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['artista'], supportsExport: true, supportsImport: false,
  };

  it('seleção fora de ordem no relatório computado também é reordenada pela config canônica', async () => {
    const query = jest.fn().mockResolvedValue([{ artista: 'Artista X', receitas: '1000', despesas: '400' }]);
    const { engine } = makeEngine({
      tableName: ACCOUNTING_SUMMARY_TABLE_NAME, label: 'Contabilidade', definition: ACCOUNTING_DEF, query,
    });
    // Canônico: artista, receitas, despesas, resultado, margem. Chamador seleciona fora de ordem.
    const result = await engine.export(
      ACCOUNTING_SUMMARY_TABLE_NAME,
      params({ columns: ['margem', 'artista', 'receitas'] }),
      'tenant-1', 'user-1',
    );
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['Artista', 'Receitas', 'Margem (%)']);
  });
});

describe('Projetos — workbook fiel ao modal e com uma única aba', () => {
  const PROJECTS_DEF: ReportEntityDefinition = {
    entityName: 'ProjectEntity', tableName: 'projects', category: EntityCategory.REPORTABLE,
    identityColumn: 'nome_ep_album', displayColumn: 'nome_ep_album', dateColumn: 'created_at',
    exportableColumns: [
      'tipo_lancamento', 'nome_ep_album', 'observacoes', 'status_projeto',
      'nome_musica', 'soloFeat', 'originalRemix', 'instrumental',
      'duracaoMinutos', 'duracaoSegundos', 'generoMusical', 'idiomaMusica',
      'compositores', 'interpretes', 'produtores', 'letra', 'arquivosAudio', 'sort_order',
    ],
    importableColumns: [], filterableColumns: [], sortableColumns: ['created_at'], searchableColumns: [],
    sensitiveColumns: [], requiredImportColumns: ['nome_ep_album'], supportsExport: true, supportsImport: true,
  };

  it('repete dados gerais por música, sem IDs técnicos nem segunda aba', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{
        __internal_id: '00000000-0000-0000-0000-000000000001',
        tipo_lancamento: 'ep', nome_ep_album: 'Meu EP', observacoes: 'Obs', status_projeto: 'em_andamento',
      }])
      .mockResolvedValueOnce([
        { id: 'track-1', project_id: '00000000-0000-0000-0000-000000000001', nome: 'Faixa 1', solo_feat: 'solo', original_remix: 'original', instrumental: 'nao', duracao_min: '3', duracao_seg: '5', genero: 'pop', idioma: 'portugues', letra: 'Letra 1', audio_url: 'audio-1.wav', sort_order: 0 },
        { id: 'track-2', project_id: '00000000-0000-0000-0000-000000000001', nome: 'Faixa 2', solo_feat: 'feat', original_remix: 'remix', instrumental: 'sim', duracao_min: '4', duracao_seg: '10', genero: 'rap', idioma: 'portugues', letra: 'Letra 2', audio_url: 'audio-2.wav', sort_order: 1 },
      ])
      .mockResolvedValueOnce([
        { project_track_id: 'track-1', nome: 'Compositor A', role: 'compositor' },
        { project_track_id: 'track-1', nome: 'Intérprete A', role: 'interprete' },
        { project_track_id: 'track-1', nome: 'Produtor A', role: 'produtor' },
      ]);

    const { engine } = makeEngine({ tableName: 'projects', label: 'Projetos', definition: PROJECTS_DEF, query });
    const result = await engine.export('projects', params(), 'tenant-1', 'user-1');
    const workbook = XLSX.read(result.body as Buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['Projetos']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Projetos, { header: 1 });
    expect(rows[0]).toEqual([
      'Tipo de Lançamento', 'Nome do EP/Álbum', 'Observações', 'Status',
      'Nome da música', 'Solo/Feat', 'Original/Remix', 'Instrumental',
      'Duração — Minutos', 'Duração — Segundos', 'Gênero musical', 'Idioma da Música',
      'Compositores', 'Intérpretes', 'Produtores', 'Letra', 'Arquivos de Áudio (MP3/WAV)', 'Ordem',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      'ep', 'Meu EP', 'Obs', 'em_andamento', 'Faixa 1', 'solo', 'original', 'nao',
      '3', '5', 'pop', 'portugues', 'Compositor A', 'Intérprete A', 'Produtor A', 'Letra 1', 'audio-1.wav', '0',
    ]);
    expect(rows[2]?.[0]).toBe('ep');
    expect(rows[2]?.[4]).toBe('Faixa 2');
    expect(JSON.stringify(rows)).not.toContain('Projeto ID de referência');
    expect(JSON.stringify(rows)).not.toContain('Músicas do Projeto');
  });
});
