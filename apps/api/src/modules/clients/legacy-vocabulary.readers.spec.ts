import {
  CLIENT_PROFILES,
  DEFAULT_CLIENT_PROFILE,
  LEGACY_CLIENT_PROFILES,
  canonicalClientProfile,
  transformClientProfile,
} from './client-profile-vocabulary';
import {
  LEGACY_ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRIES,
  canonicalOrganizationIndustry,
  transformOrganizationIndustry,
} from '../auth/organization-industry';

/**
 * Compatibility reader contract: every deprecated Portuguese slug of
 * clients.profile / organizations.industry must resolve to its canonical
 * English value (a web build released before PV1 still sends them), canonical
 * values win, and unknown values are never guessed.
 */
const EXPECTED_PROFILES: Array<[string, string]> = [
  ['a_e_r', 'a_and_r'], ['advogado', 'lawyer'], ['agencia', 'agency'], ['agencia_de_booking', 'booking_agency'],
  ['agencia_de_modelos', 'model_agency'], ['agencia_de_publicidade', 'advertising_agency'],
  ['artista_banda', 'artist_or_band'], ['banco', 'bank'], ['cartorio', 'notary_office'], ['coach_vocal', 'vocal_coach'],
  ['compositor', 'composer'], ['construtora', 'construction_company'], ['contador', 'accountant'],
  ['contratante_show', 'show_booker'], ['curador_musical', 'music_curator'], ['diretor', 'director'],
  ['diretor_de_video', 'video_director'], ['distribuidora_digital', 'digital_distributor'],
  ['editor_de_video', 'video_editor'], ['empresa', 'company'], ['empresa_de_ia', 'ai_company'],
  ['empresa_de_internet', 'internet_company'], ['empresa_de_som', 'sound_company'],
  ['empresario_artistico', 'artist_manager'], ['engenheiro_de_som', 'sound_engineer'], ['estudio', 'studio'],
  ['fotografo', 'photographer'], ['fundo_de_investimento', 'investment_fund'],
  ['gateway_de_pagamento', 'payment_gateway'], ['gravadora_selo', 'record_label'], ['influenciador', 'influencer'],
  ['investidor', 'investor'], ['jornalista', 'journalist'], ['marca', 'brand'], ['masterizador', 'mastering_engineer'],
  ['oficina_mecanica', 'auto_repair_shop'], ['operador_de_camera', 'camera_operator'], ['outros', 'other'],
  ['parceiro_comercial', 'business_partner'], ['parceiros', 'partner'], ['patrocinador', 'sponsor'],
  ['plataforma_digital', 'digital_platform'], ['prefeitura', 'city_hall'],
  ['produtor_executivo', 'executive_producer'], ['produtor_musical', 'music_producer'],
  ['produtora_audiovisual', 'audiovisual_production_company'], ['produtora_de_eventos', 'event_producer'],
  ['programador', 'developer'], ['psicologo', 'psychologist'], ['sala_de_ensaio', 'rehearsal_room'],
];

const EXPECTED_INDUSTRIES: Array<[string, string]> = [
  ['gravadora', 'record_label'], ['editora', 'music_publisher'], ['distribuidora', 'distributor'],
  ['agencia', 'artist_agency'], ['outro', 'other'], ['produtora', 'music_production_company'],
  ['escritorio', 'artist_management'],
];

describe('clients.profile legacy slug reader', () => {
  it('the legacy map has exactly the expected entries (no silent additions/removals)', () => {
    expect(Object.entries(LEGACY_CLIENT_PROFILES).sort()).toEqual([...EXPECTED_PROFILES].sort());
  });

  it.each(EXPECTED_PROFILES)('maps legacy %s -> %s (also via the class-transformer adapter)', (legacy, canonical) => {
    expect(canonicalClientProfile(legacy)).toBe(canonical);
    expect(transformClientProfile({ value: legacy })).toBe(canonical);
    expect((CLIENT_PROFILES as readonly string[]).includes(canonical)).toBe(true);
  });

  it('is case/space-insensitive for legacy and canonical values', () => {
    expect(canonicalClientProfile('  ADVOGADO ')).toBe('lawyer');
    expect(canonicalClientProfile(' Lawyer')).toBe('lawyer');
  });

  it('never guesses: unknown values and non-strings pass through unchanged', () => {
    expect(canonicalClientProfile('banana')).toBe('banana');
    expect(canonicalClientProfile('constructor')).toBe('constructor');
    expect(canonicalClientProfile(null)).toBeNull();
    expect(canonicalClientProfile(7)).toBe(7);
  });

  it('a value that is both canonical and Portuguese-looking keeps its canonical id (proper nouns)', () => {
    for (const keep of ['ecad', 'abramus', 'inpi', 'studio', 'brand']) expect(canonicalClientProfile(keep)).toBe(keep);
  });

  it('never persists a legacy slug as canonical: legacy keys and canonical list are disjoint, default is canonical', () => {
    for (const legacy of Object.keys(LEGACY_CLIENT_PROFILES)) {
      expect((CLIENT_PROFILES as readonly string[]).includes(legacy)).toBe(false);
    }
    expect((CLIENT_PROFILES as readonly string[]).includes(DEFAULT_CLIENT_PROFILE)).toBe(true);
  });
});

describe('organizations.industry legacy value reader', () => {
  it('the legacy map has exactly the expected entries', () => {
    expect(Object.entries(LEGACY_ORGANIZATION_INDUSTRIES).sort()).toEqual([...EXPECTED_INDUSTRIES].sort());
  });

  it.each(EXPECTED_INDUSTRIES)('maps legacy %s -> %s (also via the adapter)', (legacy, canonical) => {
    expect(canonicalOrganizationIndustry(legacy)).toBe(canonical);
    expect(transformOrganizationIndustry({ value: ` ${legacy.toUpperCase()} ` })).toBe(canonical);
    expect((ORGANIZATION_INDUSTRIES as readonly string[]).includes(canonical)).toBe(true);
  });

  it('canonical values win and stay distinct (publisher, indie)', () => {
    expect(canonicalOrganizationIndustry('publisher')).toBe('publisher');
    expect(canonicalOrganizationIndustry('indie')).toBe('indie');
  });

  it('unknown values pass through so the DTO validator rejects them', () => {
    expect(canonicalOrganizationIndustry('xyz')).toBe('xyz');
    expect(canonicalOrganizationIndustry(undefined)).toBeUndefined();
  });
});
