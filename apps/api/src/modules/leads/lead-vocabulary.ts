/**
 * lead-vocabulary.ts — CZ-033: the canonical (English) lead vocabulary and the
 * only place that knows the pre-CZ-033 Portuguese one.
 *
 * Persisted technical names/values are English; PT-BR labels live in the web
 * UI. A web build released before CZ-033 still sends the Portuguese request
 * field names, `service_type` values and jsonb keys/values; they are mapped
 * here before persistence and never stored again. Responses are canonical.
 * The maps mirror migration 20260928000011_CanonicalizeLeadsToEnglish.
 */
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const LEAD_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  nomeArtistico: 'stageName',
  empresa: 'company',
  payloadServico: 'servicePayload',
  dadosInternosCRM: 'crmInternalData',
};

export const LEAD_SERVICE_TYPES = [
  'musicProduction', 'mixing', 'mastering', 'digitalDistribution', 'musicMarketing', 'musicVideo',
  'photography', 'show', 'eventProduction', 'artistManagement', 'copyrightRegistration', 'licensing',
  'graphicDesign', 'websiteDevelopment', 'paidTraffic', 'consulting',
] as const;

export const LEGACY_LEAD_SERVICE_TYPES: Readonly<Record<string, (typeof LEAD_SERVICE_TYPES)[number]>> = {
  producaoMusical: 'musicProduction',
  mixagem: 'mixing',
  masterizacao: 'mastering',
  distribuicaoDigital: 'digitalDistribution',
  marketingMusical: 'musicMarketing',
  videoclipe: 'musicVideo',
  fotografia: 'photography',
  producaoEvento: 'eventProduction',
  gestaoArtistica: 'artistManagement',
  registroAutoral: 'copyrightRegistration',
  licenciamento: 'licensing',
  designGrafico: 'graphicDesign',
  desenvolvimentoSite: 'websiteDevelopment',
  trafegoPago: 'paidTraffic',
  consultoria: 'consulting',
};

const CRM_KEYS: Readonly<Record<string, string>> = {
  prioridade: 'priority',
  origemLead: 'leadSource',
  responsavel: 'responsiblePerson',
  campanha_marketing: 'marketingCampaign',
  proximoFollowUp: 'nextFollowUpAt',
  valorEstimado: 'estimatedValue',
  temperatura: 'temperature',
  probabilidadeFechamento: 'closeProbability',
  observacoesInternas: 'internalNotes',
};

const CRM_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  priority: { alta: 'high', media: 'medium', baixa: 'low' },
  temperature: { frio: 'cold', morno: 'warm', quente: 'hot' },
  leadSource: {
    indicacao: 'referral', evento: 'event', parceria: 'partnership',
    prospeccao_ativa: 'active_prospecting', telefone: 'phone', outro: 'other',
  },
};

const PAYLOAD_KEYS: Readonly<Record<string, string>> = {
  tipo_lead: 'leadType',
  servico: 'service',
  nome_artista_servico: 'serviceArtistName',
  descricao: 'description',
  cargo: 'jobTitle',
  endereco: 'address',
  data_entrada: 'entryDate',
  responsavel: 'responsiblePerson',
  interacoes: 'interactions',
  nome_evento: 'eventName',
  tipo_evento: 'eventType',
  data_evento: 'eventDate',
  local_evento: 'eventVenue',
  cidade: 'city',
  estado: 'state',
  capacidade_publico: 'audienceCapacity',
  nome_artista_banda: 'artistName',
  necessidades_adicionais: 'additionalNeeds',
  nome_campanha: 'campaignName',
  tipo_campanha: 'campaignType',
  local_campanha: 'campaignLocation',
  data: 'date',
};

const PAYLOAD_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  leadType: {
    artista_banda: 'artist_or_band', contratante_show: 'show_booker', empresario_artistico: 'artist_manager',
    gravadora_selo: 'record_label', marca_empresa: 'brand_or_company', produtora_eventos: 'event_producer',
    influenciador: 'influencer', outros: 'other', editora_musical: 'music_publisher', agencia: 'agency',
  },
  service: {
    agenciamento_gestao: 'artist_management', contratacao_artistas: 'artist_booking',
    distribuicao_digital: 'digital_distribution', producao_musical: 'music_production',
    edicao_musical: 'music_editing', producao_audiovisual: 'audiovisual_production',
    marketing_digital: 'digital_marketing', marketing_influencia: 'influencer_marketing',
    licenciamento_musical: 'music_licensing', sincronizacao: 'sync_licensing',
    gestao_catalogo: 'catalog_management', estrategia_carreira: 'career_strategy',
    gestao_imagem: 'image_management', producao_eventos: 'event_production',
    divulgacao_eventos: 'event_promotion', parcerias_comerciais: 'commercial_partnerships',
    influenciadores: 'influencers', criacao_sites: 'website_creation', consultoria: 'consulting',
    eventos_corporativos: 'corporate_events', campanhas_artistas: 'artist_campaigns',
    administracao_editorial: 'publishing_administration', registro_obras: 'work_registration',
    arrecadacao_autoral: 'royalty_collection', parcerias: 'partnerships',
    projetos_especiais: 'special_projects', atendimento_personalizado: 'personalized_service',
  },
  eventType: {
    aniversario: 'birthday', casamento: 'wedding', casa_noturna: 'nightclub',
    show_publico: 'public_show', corporativo: 'corporate',
  },
};

export const INTERACTION_KEYS: Readonly<Record<string, string>> = { data: 'date', horario: 'time', descricao: 'description' };
export const INTERACTION_TYPES: Readonly<Record<string, string>> = {
  ligacao: 'call', reuniao: 'meeting', proposta: 'proposal', observacao: 'note',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Moves legacy keys to canonical ones (canonical wins) and remaps legacy values. */
function canonicalObject(
  input: Record<string, unknown>,
  keys: Readonly<Record<string, string>>,
  values: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const [legacy, canonical] of Object.entries(keys)) {
    if (!Object.prototype.hasOwnProperty.call(out, legacy)) continue;
    if (out[canonical] === undefined) out[canonical] = out[legacy];
    delete out[legacy];
  }
  for (const [key, map] of Object.entries(values)) {
    const current = out[key];
    if (typeof current === 'string' && Object.prototype.hasOwnProperty.call(map, current)) out[key] = map[current];
  }
  return out;
}

export function canonicalLeadServiceType<T>(value: T): T | string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_LEAD_SERVICE_TYPES, value) ? LEGACY_LEAD_SERVICE_TYPES[value] : value;
}

export function canonicalCrmInternalData(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const out = canonicalObject(input, CRM_KEYS, CRM_VALUES);
  // `statusLead` duplicated the `status` column; `status` is the only source.
  delete out['statusLead'];
  return out;
}

export function canonicalServicePayload(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const out = canonicalObject(input, PAYLOAD_KEYS, PAYLOAD_VALUES);
  if (Array.isArray(out['interactions'])) {
    out['interactions'] = out['interactions'].map((item) =>
      isRecord(item) ? canonicalObject(item, INTERACTION_KEYS, { type: INTERACTION_TYPES }) : item,
    );
  }
  return out;
}
