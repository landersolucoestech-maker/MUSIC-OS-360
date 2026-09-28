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
    // Spreadsheet cells are free text: trimmed and case-insensitive (a NOT VALID check rejects anything else).
    expect(canonicalImportValue('transactions', 'type', ' Receita ')).toBe('revenue');
    expect(canonicalImportValue('transactions', 'type', 'DESPESA')).toBe('expense');
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

describe('canonicalImportValue — artists (CZ-042)', () => {
  it('maps pre-CZ-042 profile_type values (case-insensitive)', () => {
    expect(canonicalImportValue('artists', 'profile_type', 'com_empresario')).toBe('managed');
    expect(canonicalImportValue('artists', 'profile_type', 'Independente')).toBe('independent');
    expect(canonicalImportValue('artists', 'profile_type', 'publisher')).toBe('publisher');
  });

  it('maps legacy specialties and sends jsonb columns as JSON text (never a Postgres array literal)', () => {
    expect(canonicalImportValue('artists', 'specialties', ['dj', 'dj_produtor', 'interprete']))
      .toBe(JSON.stringify(['dj', 'dj_producer', 'performer']));
    expect(canonicalImportValue('artists', 'music_tags', ['mpb'])).toBe('["mpb"]');
    expect(canonicalImportValue('artists', 'gallery_urls', null)).toBeNull();
  });

  it('renames nested keys and relationship types of pre-CZ-042 jsonb cells', () => {
    const out = JSON.parse(canonicalImportValue('artists', 'relationships', [
      { type: 'empresario', nome: 'Ana', telefone: '1', responsaveis: [{ nome: 'B' }], distribuidoras: [{ nomeCustom: 'X' }] },
    ]) as string);
    expect(out).toEqual([{ type: 'agent', name: 'Ana', phone: '1', responsibles: [{ name: 'B' }], distributors: [{ customName: 'X' }] }]);
    expect(JSON.parse(canonicalImportValue('artists', 'documents', [{ nome: 'RG', url: 'u' }]) as string))
      .toEqual([{ name: 'RG', url: 'u' }]);
  });

  it('canonicalizes the metadata-only keys/values (gender)', () => {
    expect(canonicalImportJsonColumn('artists', 'metadata', { gender: 'Feminino', spotify_listeners: 3 }))
      .toEqual({ gender: 'female', spotify_listeners: 3 });
    expect(canonicalImportJsonColumn('artists', 'metadata', { genero: 'Masculino' })).toEqual({ gender: 'male' });
  });
});

describe('canonicalImportValue — clients (CZ-043, CT-B1)', () => {
  it.each([
    ['pessoa_fisica', 'individual'],
    ['pessoa_juridica', 'company'],
    [' PESSOA_FISICA ', 'individual'],
    ['person', 'individual'],
    ['Pessoa física', 'individual'],
    ['pessoa JURÍDICA', 'company'],
    ['individual', 'individual'],
    ['company', 'company'],
  ])('person_type %j -> %s (an imported contact stays editable: IsIn individual|company)', (cell, canonical) => {
    expect(canonicalImportValue('clients', 'person_type', cell)).toBe(canonical);
  });

  it.each([
    ['alta', 'high'], ['Média', 'medium'], ['media', 'medium'], ['BAIXA', 'low'], ['Estratégica', 'strategic'],
    ['strategic', 'strategic'],
  ])('priority %j -> %s', (cell, canonical) => {
    expect(canonicalImportValue('clients', 'priority', cell)).toBe(canonical);
  });

  it('an unknown value is left as-is (never silently turned into a valid enum)', () => {
    expect(canonicalImportValue('clients', 'person_type', 'alien')).toBe('alien');
  });
});

describe('canonicalImportValue — artists labels round-trip (CT-D2)', () => {
  it('specialties: PT-BR labels joined by " | " (export format), raw values and legacy values', () => {
    expect(canonicalImportValue('artists', 'specialties', 'DJ | Compositor/Autor | intérprete'))
      .toBe(JSON.stringify(['dj', 'songwriter', 'performer']));
    expect(canonicalImportValue('artists', 'specialties', 'dj_producer|produtor')).toBe(JSON.stringify(['dj_producer', 'producer']));
    expect(canonicalImportValue('artists', 'specialties', 'DJ')).toBe(JSON.stringify(['dj']));
  });

  it('profile_type / registration_status labels map back to the canonical value', () => {
    expect(canonicalImportValue('artists', 'profile_type', 'Com gravadora')).toBe('record_label');
    expect(canonicalImportValue('artists', 'registration_status', 'Suspenso')).toBe('suspended');
    expect(canonicalImportValue('artists', 'registration_status', 'inactive')).toBe('inactive');
  });
});
