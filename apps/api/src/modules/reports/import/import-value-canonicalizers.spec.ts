import { canonicalImportJsonColumn, canonicalImportValue } from './import-value-canonicalizers';

/**
 * The reports import writes rows with its own INSERT (import-commit.service),
 * so a spreadsheet exported before CZ-032..CZ-038 must still land with the
 * canonical persisted values (CZ-037 review, finding M3).
 */
describe('canonicalImportValue', () => {
  it.each([
    ['shares', 'status', 'enviado', 'sent'],
    ['shares', 'direction', 'a_receber', 'receivable'],
    ['shares', 'type', 'compositor', 'composer'],
    ['releases', 'type', 'compilacao', 'compilation'],
    ['releases', 'type', 'Álbum', 'album'],
    ['releases', 'type', 'videoclipe', 'video'],
    ['takedowns', 'type', 'recebido', 'received'],
    ['takedowns', 'priority', 'alta', 'high'],
    ['licenses', 'status', 'ativa', 'active'],
    ['licenses', 'territory', 'mundial', 'worldwide'],
    ['inventory_items', 'status', 'disponivel', 'available'],
    ['works', 'language', 'Português', 'pt'],
    ['works', 'work_origin', 'autoral', 'original'],
    ['works', 'ai_usage_level', 'totalmente', 'full'],
    ['works', 'type', 'composicao', 'composition'],
    ['phonograms', 'media_type', 'físico', 'physical'],
    ['phonograms', 'country_of_recording', 'brazil', 'BR'],
    ['phonograms', 'publication_country', 'outro', 'ZZ'],
  ])('%s.%s: %s -> %s', (table, column, legacy, canonical) => {
    expect(canonicalImportValue(table, column, legacy)).toBe(canonical);
  });

  it('maps the legacy sim/nao instrumental flag to a boolean', () => {
    expect(canonicalImportValue('works', 'is_instrumental', 'sim')).toBe(true);
    expect(canonicalImportValue('works', 'is_instrumental', 'nao')).toBe(false);
  });

  it('maps pre-CZ-041 transaction values (type, counterparty, payment) to canonical', () => {
    expect(canonicalImportValue('transactions', 'type', 'despesa')).toBe('expense');
    expect(canonicalImportValue('transactions', 'type', 'receita')).toBe('revenue');
    expect(canonicalImportValue('transactions', 'counterparty_type', 'empresa')).toBe('company');
    expect(canonicalImportValue('transactions', 'payment_method', 'cartao-credito')).toBe('credit_card');
    expect(canonicalImportValue('transactions', 'payment_method', 'pix')).toBe('pix');
    expect(canonicalImportValue('transactions', 'payment_type', 'parcelado')).toBe('installments');
    expect(canonicalImportValue('transactions', 'installment_interval', 'mensal')).toBe('monthly');
  });

  it('leaves canonical values, other columns, other tables and non-strings untouched', () => {
    expect(canonicalImportValue('shares', 'status', 'sent')).toBe('sent');
    expect(canonicalImportValue('shares', 'holder', 'autor')).toBe('autor');
    expect(canonicalImportValue('clients', 'type', 'compilacao')).toBe('compilacao');
    expect(canonicalImportValue('shares', 'status', null)).toBeNull();
  });

  it('canonicalizes legacy keys/values inside jsonb contract columns (leads CRM data)', () => {
    const out = canonicalImportJsonColumn('leads', 'crm_internal_data', { prioridade: 'alta' }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/prioridade|alta/);
    // Pre-CZ-033 export: English contract key, legacy value.
    expect(canonicalImportJsonColumn('leads', 'crm_internal_data', { priority: 'alta', temperature: 'quente' }))
      .toEqual({ priority: 'high', temperature: 'hot' });
    expect(canonicalImportJsonColumn('works', 'metadata', { a: 1 })).toEqual({ a: 1 });
  });
});
