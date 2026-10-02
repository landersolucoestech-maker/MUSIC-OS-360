import { MARKETING_TASK_KIND_LABELS_PT_BR, exportValueLabel, valueFromExportLabel } from './value-labels.pt-br';
import { sanitizeExcelCellValue } from '../export/export-format.service';
import { canonicalImportJsonColumn, canonicalImportValue } from '../import/import-value-canonicalizers';

describe('report enum values — PT-BR in the spreadsheet, canonical in the database (round-trip)', () => {
  it('export writes the PT-BR label, never the raw technical value', () => {
    expect(sanitizeExcelCellValue('revenue', { entity: 'transactions', column: 'transaction_type' })).toBe('Receita');
    expect(sanitizeExcelCellValue('credit_card', { entity: 'transactions', column: 'payment_method' })).toBe('Cartão de Crédito');
    expect(sanitizeExcelCellValue('own_account', { entity: 'transactions', column: 'counterparty_type' })).toBe('Conta Própria');
    expect(sanitizeExcelCellValue('pending', { entity: 'transactions', column: 'status' })).not.toBe('pending');
    expect(sanitizeExcelCellValue('reference', { entity: 'works', column: 'work_origin' })).toBe('Referência');
    expect(sanitizeExcelCellValue('physical', { entity: 'phonograms', column: 'media_type' })).toBe('Física');
  });

  it("labels the projects status under its logical export column (`projectStatus`) and maps the label back on import", () => {
    expect(sanitizeExcelCellValue('in_progress', { entity: 'projects', column: 'projectStatus' })).toBe('Em andamento');
    expect(sanitizeExcelCellValue('in_progress', { entity: 'projects', column: 'status' })).toBe('Em andamento');
    expect(valueFromExportLabel('projects', 'projectStatus', 'Em andamento')).toBe('in_progress');
    // another table's `projectStatus`-named column is not a status
    expect(exportValueLabel('contracts', 'projectStatus', 'in_progress')).toBeNull();
  });

  it('free text is never relabelled', () => {
    expect(exportValueLabel('transactions', 'description', 'revenue')).toBeNull();
    expect(sanitizeExcelCellValue('revenue', { entity: 'transactions', column: 'description' })).toBe('revenue');
  });

  it('import maps every exported label back to its canonical value (trimmed, case-insensitive)', () => {
    expect(canonicalImportValue('transactions', 'type', 'Receita')).toBe('revenue');
    expect(canonicalImportValue('transactions', 'payment_method', ' cartão de crédito ')).toBe('credit_card');
    expect(canonicalImportValue('works', 'work_origin', 'Referência')).toBe('reference');
    expect(valueFromExportLabel('phonograms', 'media_type', 'Física')).toBe('physical');
    expect(valueFromExportLabel('transactions', 'type', 'Algo')).toBeNull();
  });

  it('clients and artists enum columns export PT-BR labels, never raw English (CT-D2)', () => {
    const cases: Array<[string, string, unknown, string]> = [
      ['clients', 'person_type', 'individual', 'Pessoa física'],
      ['clients', 'person_type', 'company', 'Pessoa jurídica'],
      ['clients', 'priority', 'strategic', 'Estratégica'],
      ['clients', 'status', 'prospect', 'Prospecto'],
      ['artists', 'profile_type', 'managed', 'Com empresário'],
      ['artists', 'gender', 'female', 'Feminino'],
      ['artists', 'registration_status', 'active', 'Ativo'],
      ['artists', 'specialties', ['dj', 'songwriter'], 'DJ | Compositor/Autor'],
    ];
    for (const [entity, column, value, label] of cases) {
      expect(sanitizeExcelCellValue(value, { entity, column })).toBe(label);
    }
    // Non-enum lists are still skipped (never a raw JSON dump).
    expect(sanitizeExcelCellValue(['https://cdn/x.png'], { entity: 'artists', column: 'gallery_urls' })).toBe('');
  });

  it('every clients/artists label round-trips through import back to the same canonical value', () => {
    const columns: Array<[string, string, string[]]> = [
      ['clients', 'person_type', ['individual', 'company']],
      ['clients', 'priority', ['low', 'medium', 'high', 'strategic']],
      ['artists', 'profile_type', ['independent', 'managed', 'record_label', 'publisher']],
      ['artists', 'registration_status', ['active', 'inactive', 'suspended']],
    ];
    for (const [table, column, values] of columns) {
      for (const value of values) {
        const label = exportValueLabel(table, column, value)!;
        expect(label).not.toBe(value);
        expect(canonicalImportValue(table, column, label)).toBe(value);
        expect(canonicalImportValue(table, column, value)).toBe(value); // raw value still accepted
      }
    }
    const specialties = ['dj', 'dj_producer', 'songwriter', 'performer', 'producer'];
    const cell = exportValueLabel('artists', 'specialties', specialties)!;
    expect(JSON.parse(canonicalImportValue('artists', 'specialties', cell) as string)).toEqual(specialties);
    for (const gender of ['male', 'female']) {
      const label = exportValueLabel('artists', 'gender', gender)!;
      expect(canonicalImportJsonColumn('artists', 'metadata', { gender: label })).toEqual({ gender });
    }
  });

  it('marketing task kind and target export PT-BR labels and import maps them back (MK2)', () => {
    expect(sanitizeExcelCellValue('cover', { entity: 'marketing_tasks', column: 'kind' })).toBe('Capa');
    expect(sanitizeExcelCellValue('behind_the_scenes_shot', { entity: 'marketing_tasks', column: 'kind' })).toBe('Bastidor');
    expect(sanitizeExcelCellValue('music_project', { entity: 'marketing_tasks', column: 'targetType' })).toBe('Projeto Musical');
    expect(sanitizeExcelCellValue('cover_art', { entity: 'marketing_tasks', column: 'kind' })).toBe('cover_art'); // kind outside the catalog is never invented
    expect(valueFromExportLabel('marketing_tasks', 'kind', 'Material Promocional')).toBe('promotional_material');
    expect(valueFromExportLabel('marketing_tasks', 'targetType', 'Empresa')).toBe('company');
  });

  it('marketing task kind labels are unique, so the import round-trip is unambiguous', () => {
    const labels = Object.values(MARKETING_TASK_KIND_LABELS_PT_BR).map((label) => label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('share_type exports its PT-BR label, maps it back, and leaves NULL/unknown untouched', () => {
    expect(exportValueLabel('shares', 'share_type', 'internal_release')).toBe('Lançamento interno');
    expect(exportValueLabel('shares', 'share_type', 'external_receivable')).toBe('Share externo a receber');
    expect(exportValueLabel('shares', 'share_type', null)).toBeNull();
    expect(exportValueLabel('shares', 'share_type', 'registry')).toBeNull();
    expect(valueFromExportLabel('shares', 'share_type', 'Lançamento interno')).toBe('internal_release');
    expect(valueFromExportLabel('shares', 'share_type', 'Share externo a receber')).toBe('external_receivable');
  });
});
