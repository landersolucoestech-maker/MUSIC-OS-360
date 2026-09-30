/**
 * client-profile-vocabulary.ts -- canonical (English) vocabulary of clients.profile
 * (CRM contact profile) and the only place on the API that knows the
 * pre-PV1 Portuguese slugs.
 *
 * Persisted values are English snake_case machine ids; PT-BR labels live in the
 * web catalog (apps/web/src/modules/crm-relationships/constants/contact-classification.ts,
 * the single writer of values, which mirrors this file; a web test keeps the
 * two in sync). A web build released before PV1 still sends the Portuguese
 * slugs: they are mapped here before validation/persistence (canonical wins) and
 * never stored again. The map mirrors migration
 * 20260930000012_BackfillClientProfileToEnglish.
 * Proper nouns and already-English loanwords keep their id.
 */
export const CLIENT_PROFILES = [
  'a_and_r',
  'abramus',
  'accountant',
  'advertising_agency',
  'agency',
  'ai_company',
  'artist_manager',
  'artist_or_band',
  'audiovisual_production_company',
  'auto_repair_shop',
  'bank',
  'beatmaker',
  'booking_agency',
  'brand',
  'business_partner',
  'camera_operator',
  'city_hall',
  'cloud_provider',
  'company',
  'composer',
  'construction_company',
  'designer',
  'developer',
  'digital_distributor',
  'digital_platform',
  'director',
  'ecad',
  'event_producer',
  'executive_producer',
  'hosting',
  'influencer',
  'inpi',
  'internet_company',
  'investment_fund',
  'investor',
  'journalist',
  'lawyer',
  'manager',
  'mastering_engineer',
  'mix_engineer',
  'model_agency',
  'motion_designer',
  'music_curator',
  'music_producer',
  'notary_office',
  'other',
  'partner',
  'payment_gateway',
  'photographer',
  'psychologist',
  'record_label',
  'rehearsal_room',
  'show_booker',
  'sound_company',
  'sound_engineer',
  'sponsor',
  'studio',
  'video_director',
  'video_editor',
  'vocal_coach',
] as const;

export type ClientProfile = (typeof CLIENT_PROFILES)[number];

/** Profile of a contact created without one (was 'outros'; NOT NULL column). */
export const DEFAULT_CLIENT_PROFILE: ClientProfile = 'other';

/** Deprecated Portuguese slug -> canonical profile (audit persisted-vocabulary-audit.md section 1; cartorio/empresa_de_som/parceiros are medium-confidence, label-only risk). */
export const LEGACY_CLIENT_PROFILES: Readonly<Record<string, ClientProfile>> = {
  a_e_r: 'a_and_r',
  advogado: 'lawyer',
  agencia: 'agency',
  agencia_de_booking: 'booking_agency',
  agencia_de_modelos: 'model_agency',
  agencia_de_publicidade: 'advertising_agency',
  artista_banda: 'artist_or_band',
  banco: 'bank',
  cartorio: 'notary_office',
  coach_vocal: 'vocal_coach',
  compositor: 'composer',
  construtora: 'construction_company',
  contador: 'accountant',
  contratante_show: 'show_booker',
  curador_musical: 'music_curator',
  diretor: 'director',
  diretor_de_video: 'video_director',
  distribuidora_digital: 'digital_distributor',
  editor_de_video: 'video_editor',
  empresa: 'company',
  empresa_de_ia: 'ai_company',
  empresa_de_internet: 'internet_company',
  empresa_de_som: 'sound_company',
  empresario_artistico: 'artist_manager',
  engenheiro_de_som: 'sound_engineer',
  estudio: 'studio',
  fotografo: 'photographer',
  fundo_de_investimento: 'investment_fund',
  gateway_de_pagamento: 'payment_gateway',
  gravadora_selo: 'record_label',
  influenciador: 'influencer',
  investidor: 'investor',
  jornalista: 'journalist',
  marca: 'brand',
  masterizador: 'mastering_engineer',
  oficina_mecanica: 'auto_repair_shop',
  operador_de_camera: 'camera_operator',
  outros: 'other',
  parceiro_comercial: 'business_partner',
  parceiros: 'partner',
  patrocinador: 'sponsor',
  plataforma_digital: 'digital_platform',
  prefeitura: 'city_hall',
  produtor_executivo: 'executive_producer',
  produtor_musical: 'music_producer',
  produtora_audiovisual: 'audiovisual_production_company',
  produtora_de_eventos: 'event_producer',
  programador: 'developer',
  psicologo: 'psychologist',
  sala_de_ensaio: 'rehearsal_room',
};

/** Canonical profile of a raw value (deprecated slugs mapped, case/space-insensitive; unknown values are returned unchanged, never guessed). */
export function canonicalClientProfile(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  if ((CLIENT_PROFILES as readonly string[]).includes(key)) return key;
  if (Object.prototype.hasOwnProperty.call(LEGACY_CLIENT_PROFILES, key)) return LEGACY_CLIENT_PROFILES[key];
  return value;
}

/** class-transformer adapter. */
export const transformClientProfile = ({ value }: { value: unknown }): unknown => canonicalClientProfile(value);
