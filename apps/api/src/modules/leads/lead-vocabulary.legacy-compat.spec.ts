import 'reflect-metadata';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import {
  LEAD_DEPRECATED_FIELDS,
  canonicalCrmInternalData,
  canonicalLeadServiceType,
  canonicalServicePayload,
} from './lead-vocabulary';

/**
 * lead-vocabulary.legacy-compat.spec.ts: every pre-CZ-033 lead name and value (request field, service_type, CRM jsonb
 * key/value, service payload key/value, interaction key/type) is pinned one by one. The tables below are EXPLICIT static
 * copies of the legacy vocabulary (the migration 20260928000011 mirror), not derived from the module under test, so a renamed
 * or dropped legacy entry, a wrong canonical target or an override of the canonical value by the legacy one fails here.
 */
type Row2 = ReadonlyArray<readonly [string, string]>;
type Row3 = ReadonlyArray<readonly [string, string, string]>;

const DEPRECATED_FIELDS: Row2 = [
  ['nomeArtistico', 'stageName'],
  ['empresa', 'company'],
  ['payloadServico', 'servicePayload'],
  ['dadosInternosCRM', 'crmInternalData'],
];

const SERVICE_TYPES: Row2 = [
  ['producaoMusical', 'musicProduction'],
  ['mixagem', 'mixing'],
  ['masterizacao', 'mastering'],
  ['distribuicaoDigital', 'digitalDistribution'],
  ['marketingMusical', 'musicMarketing'],
  ['videoclipe', 'musicVideo'],
  ['fotografia', 'photography'],
  ['producaoEvento', 'eventProduction'],
  ['gestaoArtistica', 'artistManagement'],
  ['registroAutoral', 'copyrightRegistration'],
  ['licenciamento', 'licensing'],
  ['designGrafico', 'graphicDesign'],
  ['desenvolvimentoSite', 'websiteDevelopment'],
  ['trafegoPago', 'paidTraffic'],
  ['consultoria', 'consulting'],
];

const CRM_KEYS: Row2 = [
  ['prioridade', 'priority'],
  ['origemLead', 'leadSource'],
  ['responsavel', 'responsiblePerson'],
  ['campanha_marketing', 'marketingCampaign'],
  ['proximoFollowUp', 'nextFollowUpAt'],
  ['valorEstimado', 'estimatedValue'],
  ['temperatura', 'temperature'],
  ['probabilidadeFechamento', 'closeProbability'],
  ['observacoesInternas', 'internalNotes'],
];

/** [canonical key, legacy value, canonical value] */
const CRM_VALUES: Row3 = [
  ['priority', 'alta', 'high'],
  ['priority', 'media', 'medium'],
  ['priority', 'baixa', 'low'],
  ['temperature', 'frio', 'cold'],
  ['temperature', 'morno', 'warm'],
  ['temperature', 'quente', 'hot'],
  ['leadSource', 'indicacao', 'referral'],
  ['leadSource', 'evento', 'event'],
  ['leadSource', 'parceria', 'partnership'],
  ['leadSource', 'prospeccao_ativa', 'active_prospecting'],
  ['leadSource', 'telefone', 'phone'],
  ['leadSource', 'outro', 'other'],
];

const PAYLOAD_KEYS: Row2 = [
  ['tipo_lead', 'leadType'],
  ['servico', 'service'],
  ['nome_artista_servico', 'serviceArtistName'],
  ['descricao', 'description'],
  ['cargo', 'jobTitle'],
  ['endereco', 'address'],
  ['data_entrada', 'entryDate'],
  ['responsavel', 'responsiblePerson'],
  ['interacoes', 'interactions'],
  ['nome_evento', 'eventName'],
  ['tipo_evento', 'eventType'],
  ['data_evento', 'eventDate'],
  ['local_evento', 'eventVenue'],
  ['cidade', 'city'],
  ['estado', 'state'],
  ['capacidade_publico', 'audienceCapacity'],
  ['nome_artista_banda', 'artistName'],
  ['necessidades_adicionais', 'additionalNeeds'],
  ['nome_campanha', 'campaignName'],
  ['tipo_campanha', 'campaignType'],
  ['local_campanha', 'campaignLocation'],
  ['data', 'date'],
];

/** [canonical key, legacy value, canonical value] */
const PAYLOAD_VALUES: Row3 = [
  ['leadType', 'artista_banda', 'artist_or_band'],
  ['leadType', 'contratante_show', 'show_booker'],
  ['leadType', 'empresario_artistico', 'artist_manager'],
  ['leadType', 'gravadora_selo', 'record_label'],
  ['leadType', 'marca_empresa', 'brand_or_company'],
  ['leadType', 'produtora_eventos', 'event_producer'],
  ['leadType', 'influenciador', 'influencer'],
  ['leadType', 'outros', 'other'],
  ['leadType', 'editora_musical', 'music_publisher'],
  ['leadType', 'agencia', 'agency'],
  ['service', 'agenciamento_gestao', 'artist_management'],
  ['service', 'contratacao_artistas', 'artist_booking'],
  ['service', 'distribuicao_digital', 'digital_distribution'],
  ['service', 'producao_musical', 'music_production'],
  ['service', 'edicao_musical', 'music_editing'],
  ['service', 'producao_audiovisual', 'audiovisual_production'],
  ['service', 'marketing_digital', 'digital_marketing'],
  ['service', 'marketing_influencia', 'influencer_marketing'],
  ['service', 'licenciamento_musical', 'music_licensing'],
  ['service', 'sincronizacao', 'sync_licensing'],
  ['service', 'gestao_catalogo', 'catalog_management'],
  ['service', 'estrategia_carreira', 'career_strategy'],
  ['service', 'gestao_imagem', 'image_management'],
  ['service', 'producao_eventos', 'event_production'],
  ['service', 'divulgacao_eventos', 'event_promotion'],
  ['service', 'parcerias_comerciais', 'commercial_partnerships'],
  ['service', 'influenciadores', 'influencers'],
  ['service', 'criacao_sites', 'website_creation'],
  ['service', 'consultoria', 'consulting'],
  ['service', 'eventos_corporativos', 'corporate_events'],
  ['service', 'campanhas_artistas', 'artist_campaigns'],
  ['service', 'administracao_editorial', 'publishing_administration'],
  ['service', 'registro_obras', 'work_registration'],
  ['service', 'arrecadacao_autoral', 'royalty_collection'],
  ['service', 'parcerias', 'partnerships'],
  ['service', 'projetos_especiais', 'special_projects'],
  ['service', 'atendimento_personalizado', 'personalized_service'],
  ['eventType', 'aniversario', 'birthday'],
  ['eventType', 'casamento', 'wedding'],
  ['eventType', 'casa_noturna', 'nightclub'],
  ['eventType', 'show_publico', 'public_show'],
  ['eventType', 'corporativo', 'corporate'],
];

const INTERACTION_KEYS: Row2 = [
  ['data', 'date'],
  ['horario', 'time'],
  ['descricao', 'description'],
];

const INTERACTION_TYPES: Row2 = [
  ['ligacao', 'call'],
  ['reuniao', 'meeting'],
  ['proposta', 'proposal'],
  ['observacao', 'note'],
];

describe('LEAD_DEPRECATED_FIELDS (request field names)', () => {
  it('declares exactly the expected legacy -> canonical pairs', () => {
    expect({ ...LEAD_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(DEPRECATED_FIELDS));
  });

  it.each(DEPRECATED_FIELDS)('%s -> %s: legacy-only moves, canonical wins when both are sent', (legacy, canonical) => {
    const only = applyDeprecatedFieldAliases({ [legacy]: 'legacy-value' }, LEAD_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(only[canonical]).toBe('legacy-value');
    expect(only).not.toHaveProperty(legacy);
    const both = applyDeprecatedFieldAliases({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }, LEAD_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(both[canonical]).toBe('canonical-value');
    expect(both).not.toHaveProperty(legacy);
  });
});

describe('canonicalLeadServiceType (service_type values)', () => {
  it.each(SERVICE_TYPES)('%s -> %s', (legacy, canonical) => {
    expect(canonicalLeadServiceType(legacy)).toBe(canonical);
  });

  it('keeps a canonical value and a non-string unchanged', () => {
    expect(canonicalLeadServiceType('musicProduction')).toBe('musicProduction');
    expect(canonicalLeadServiceType(null)).toBeNull();
  });
});

describe.each([
  ['canonicalCrmInternalData', canonicalCrmInternalData, CRM_KEYS, CRM_VALUES],
  ['canonicalServicePayload', canonicalServicePayload, PAYLOAD_KEYS, PAYLOAD_VALUES],
] as const)('%s (jsonb keys and values)', (_name, canonicalize, keys, values) => {
  it.each(keys)('key %s -> %s: legacy-only moves, the legacy key is removed', (legacy, canonical) => {
    const out = canonicalize({ [legacy]: 'legacy-value' }) as Record<string, unknown>;
    expect(out[canonical]).toBe('legacy-value');
    expect(out).not.toHaveProperty(legacy);
  });

  it.each(keys)('key %s -> %s: the CANONICAL value wins when both are present', (legacy, canonical) => {
    const out = canonicalize({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }) as Record<string, unknown>;
    expect(out[canonical]).toBe('canonical-value');
    expect(out).not.toHaveProperty(legacy);
  });

  it.each(values)('value of %s: %s -> %s', (key, legacyValue, canonicalValue) => {
    expect((canonicalize({ [key]: legacyValue }) as Record<string, unknown>)[key]).toBe(canonicalValue);
  });

  it('keeps a canonical value, an unknown value and a non-object input unchanged', () => {
    expect(canonicalize({ [values[0][0]]: values[0][2] })).toEqual({ [values[0][0]]: values[0][2] });
    expect(canonicalize({ [values[0][0]]: 'free-text' })).toEqual({ [values[0][0]]: 'free-text' });
    expect(canonicalize(null)).toBeNull();
    expect(canonicalize('x')).toBe('x');
  });
});

describe('canonicalServicePayload interactions (nested keys and types)', () => {
  it.each(INTERACTION_KEYS)('interaction key %s -> %s: legacy-only moves, canonical wins when both are present', (legacy, canonical) => {
    const only = canonicalServicePayload({ interactions: [{ [legacy]: 'legacy-value' }] }) as { interactions: Record<string, unknown>[] };
    expect(only.interactions[0][canonical]).toBe('legacy-value');
    expect(only.interactions[0]).not.toHaveProperty(legacy);
    const both = canonicalServicePayload({ interactions: [{ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }] }) as { interactions: Record<string, unknown>[] };
    expect(both.interactions[0][canonical]).toBe('canonical-value');
    expect(both.interactions[0]).not.toHaveProperty(legacy);
  });

  it.each(INTERACTION_TYPES)('interaction type %s -> %s', (legacy, canonical) => {
    const out = canonicalServicePayload({ interactions: [{ type: legacy }] }) as { interactions: Record<string, unknown>[] };
    expect(out.interactions[0]['type']).toBe(canonical);
  });

  it('leaves non-object interaction items untouched', () => {
    const out = canonicalServicePayload({ interactions: ['x', null] }) as { interactions: unknown[] };
    expect(out.interactions).toEqual(['x', null]);
  });
});
