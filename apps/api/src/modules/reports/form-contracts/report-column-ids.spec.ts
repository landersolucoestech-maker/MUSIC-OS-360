import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import { getFieldLabelPtBr, tryGetFieldLabelPtBr } from '../i18n/field-labels.pt-br';
import { canonicalizeExportParams } from '../reports.controller';
import {
  REPORT_FORM_CONTRACTS,
  canonicalizeDeprecatedColumnId,
  contractExportableColumns,
  contractImportableColumns,
} from './report-form-contracts';

const metadata = new EntityMetadataService();
const definitions = new ReportEntityDefinitionService(metadata).getDefinitions();
const def = (table: string) => definitions.find((d) => d.tableName === table)!;

describe('reports contracts — English logical ids with unchanged pt-BR headers', () => {
  it('projects: XLSX header text is identical to the pre-rename headers', () => {
    expect(def('projects').exportableColumns.map(getFieldLabelPtBr)).toEqual([
      'Tipo de Lançamento', 'Nome do EP/Álbum', 'Observações', 'Status',
      'Nome da música', 'Solo/Feat', 'Original/Remix', 'Instrumental',
      'Duração — Minutos', 'Duração — Segundos', 'Gênero musical', 'Idioma da Música',
      'Compositores', 'Intérpretes', 'Produtores', 'Letra', 'Arquivos de Áudio (MP3/WAV)', 'Ordem',
    ]);
  });

  it('events: XLSX header text is identical, the start column keeps the "Data" header', () => {
    expect(def('events').exportableColumns.map(getFieldLabelPtBr)).toEqual([
      'Título', 'Tipo', 'Data', 'Data de fim', 'Local', 'Contato do local', 'Endereço',
      'Valor do cachê', 'Público esperado', 'Descrição', 'Observações', 'Situação',
      'Origem', 'Nome', 'E-mail', 'Telefone', 'Categoria',
    ]);
  });

  it('projects contract exposes no Portuguese logical id and maps to the same physical columns', () => {
    const c = REPORT_FORM_CONTRACTS.projects;
    expect(c.identityColumn).toBe('projectTitle');
    expect(c.fields.map((f) => [f.key, f.physical ?? f.key])).toEqual([
      ['projectType', 'type'], ['projectTitle', 'title'], ['notes', 'notes'], ['projectStatus', 'status'],
    ]);
    for (const legacy of ['tipo_lancamento', 'nome_ep_album', 'status_projeto']) {
      expect(contractExportableColumns(c)).not.toContain(legacy);
      expect(contractImportableColumns(c)).not.toContain(legacy);
    }
  });

  it('events contract reads/writes the canonical starts_at, not the legacy data column', () => {
    const c = REPORT_FORM_CONTRACTS.events;
    const start = c.fields.find((f) => f.key === 'eventDate');
    expect(start).toMatchObject({ storage: 'column', physical: 'starts_at' });
    expect(c.fields.some((f) => (f.physical ?? f.key) === 'data')).toBe(false);
    expect(def('events').importableColumns).toContain('eventDate');
  });

  it('events: date sort/filter that worked on the legacy `data` id keeps working on the canonical id', () => {
    expect(def('events').sortableColumns).toContain('eventDate');
    expect(def('events').filterableColumns).toContain('eventDate');
  });
});

describe('deprecated logical column ids (deploy-skew window)', () => {
  it('every alias targets an existing contract key and never shadows a canonical key', () => {
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      const keys = new Set(contractExportableColumns(contract));
      for (const [legacy, canonical] of Object.entries(contract.deprecatedColumnAliases ?? {})) {
        expect(keys.has(canonical)).toBe(true);
        expect(keys.has(legacy)).toBe(false);
        expect(`${table}.${legacy}`).toBeTruthy();
      }
    }
  });

  it('canonicalizeDeprecatedColumnId maps old ids, leaves canonical/unknown ids and other tables untouched', () => {
    expect(canonicalizeDeprecatedColumnId('projects', 'tipo_lancamento')).toBe('projectType');
    expect(canonicalizeDeprecatedColumnId('projects', 'nome_ep_album')).toBe('projectTitle');
    expect(canonicalizeDeprecatedColumnId('projects', 'status_projeto')).toBe('projectStatus');
    expect(canonicalizeDeprecatedColumnId('events', 'data')).toBe('eventDate');
    expect(canonicalizeDeprecatedColumnId('events', 'starts_at')).toBe('eventDate');
    expect(canonicalizeDeprecatedColumnId('projects', 'projectType')).toBe('projectType');
    expect(canonicalizeDeprecatedColumnId('projects', 'unknown_col')).toBe('unknown_col');
    expect(canonicalizeDeprecatedColumnId('artists', 'data')).toBe('data');
    expect(canonicalizeDeprecatedColumnId('projects', 'constructor')).toBe('constructor');
    expect(canonicalizeDeprecatedColumnId('nope', 'data')).toBe('data');
  });

  it('canonicalizeExportParams: old columns/sort/filter ids resolve; canonical wins; duplicates collapse', () => {
    const out = canonicalizeExportParams('projects', {
      format: 'xlsx',
      order: 'ASC',
      columns: ['nome_ep_album', 'projectTitle', 'tipo_lancamento', 'notes'],
      sort: 'nome_ep_album',
      filters: { status_projeto: 'old', projectType: 'ep', tipo_lancamento: 'single' },
    });
    expect(out.columns).toEqual(['projectTitle', 'projectType', 'notes']);
    expect(out.sort).toBe('projectTitle');
    expect(out.filters).toEqual({ projectStatus: 'old', projectType: 'ep' });
  });

  it('canonicalizeExportParams keeps undefined selections undefined and does not touch other entities', () => {
    const plain = canonicalizeExportParams('projects', { format: 'xlsx', order: 'ASC' });
    expect(plain.columns).toBeUndefined();
    expect(plain.filters).toBeUndefined();
    expect(plain.sort).toBeUndefined();
    const other = canonicalizeExportParams('artists', { format: 'xlsx', order: 'ASC', columns: ['data'], sort: 'data' });
    expect(other.columns).toEqual(['data']);
    expect(other.sort).toBe('data');
  });
});

describe('field-labels coverage — every reachable contract column has a pt-BR label', () => {
  it('every id of every report definition (export/import/identity/required/sort/filter/search) resolves a label', () => {
    const missing: string[] = [];
    for (const d of definitions) {
      const ids = new Set([
        d.identityColumn, d.displayColumn, ...d.exportableColumns, ...d.importableColumns,
        ...d.requiredImportColumns,
      ]);
      for (const id of ids) {
        if (tryGetFieldLabelPtBr(id) === null) missing.push(`${d.tableName}.${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every contract field and repeating-group key of every contract resolves a label', () => {
    const missing: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      for (const id of [...contractExportableColumns(contract), contract.identityColumn]) {
        if (tryGetFieldLabelPtBr(id) === null) missing.push(`${table}.${id}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
