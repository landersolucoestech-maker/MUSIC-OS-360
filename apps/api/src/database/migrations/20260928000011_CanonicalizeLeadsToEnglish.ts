import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000011_CanonicalizeLeadsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `leads`
 * (CZ-033). PT-BR labels live in the web UI; persisted names and values are
 * technical English from here on.
 *
 * Columns: nome -> name, telefone_encrypted -> phone_encrypted,
 *   empresa -> company, fonte -> source, nome_completo -> full_name,
 *   nome_artistico -> stage_name, payload_servico -> service_payload,
 *   dados_internos_crm -> crm_internal_data.
 *
 * service_type values: see SERVICE_TYPES (producaoMusical -> musicProduction, ...;
 *   camelCase like the existing English client_type values).
 *
 * crm_internal_data keys/values: see CRM_KEYS / CRM_VALUES.
 * service_payload keys/values (the lead form stores its fields and the
 *   conditional event/campaign/influencer/manager blocks flat in this object):
 *   see PAYLOAD_KEYS / PAYLOAD_VALUES; the interaction history array
 *   (`interacoes` -> `interactions`) has its element keys and type values
 *   renamed too.
 *
 * crm_internal_data.statusLead is NOT renamed: it is a stale copy of the
 * `status` column that no reader uses (the web always overrides it with
 * `status`); it is left in place and no longer written (canonical map finding).
 *
 * Index idx_leads_payload_servico (GIN) -> idx_leads_service_payload (the
 * rename carries it to the new column name). No other index, view, function
 * or policy references the renamed columns (checked against a freshly
 * migrated catalog). Every step is guarded (a key is only
 * renamed when the canonical key is absent), so the migration is idempotent;
 * down() reverses every step.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['nome', 'name'],
  ['telefone_encrypted', 'phone_encrypted'],
  ['empresa', 'company'],
  ['fonte', 'source'],
  ['nome_completo', 'full_name'],
  ['nome_artistico', 'stage_name'],
  ['payload_servico', 'service_payload'],
  ['dados_internos_crm', 'crm_internal_data'],
];

const SERVICE_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
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

const CRM_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
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

const CRM_VALUES: ReadonlyArray<[key: string, legacy: string, canonical: string]> = [
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

const PAYLOAD_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
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

const PAYLOAD_VALUES: ReadonlyArray<[key: string, legacy: string, canonical: string]> = [
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

/** Keys of each element of service_payload.interactions. */
const INTERACTION_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['data', 'date'],
  ['horario', 'time'],
  ['descricao', 'description'],
];

const INTERACTION_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['ligacao', 'call'],
  ['reuniao', 'meeting'],
  ['proposta', 'proposal'],
  ['observacao', 'note'],
];

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "leads" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

async function renameKey(q: QueryRunner, column: string, from: string, to: string): Promise<void> {
  await q.query(
    `UPDATE "leads"
        SET "${column}" = ("${column}" - $1::text) || jsonb_build_object($2::text, "${column}" -> $1::text)
      WHERE jsonb_typeof("${column}") = 'object' AND "${column}" ? $1::text AND NOT "${column}" ? $2::text`,
    [from, to],
  );
}

async function remapValue(q: QueryRunner, column: string, key: string, from: string, to: string): Promise<void> {
  await q.query(
    `UPDATE "leads"
        SET "${column}" = jsonb_set("${column}", ARRAY[$1::text], to_jsonb($3::text))
      WHERE jsonb_typeof("${column}") = 'object' AND "${column}" ->> $1::text = $2::text`,
    [key, from, to],
  );
}

/**
 * Rewrites every element of service_payload.<arrayKey>: element keys renamed
 * (only when the target key is absent) and `type` values remapped.
 */
async function rewriteInteractions(
  q: QueryRunner,
  arrayKey: string,
  keys: ReadonlyArray<[string, string]>,
  types: ReadonlyArray<[string, string]>,
): Promise<void> {
  let element = 'elem';
  for (const [from, to] of keys) {
    element = `(CASE WHEN ${element} ? '${from}' AND NOT ${element} ? '${to}'
                     THEN (${element} - '${from}') || jsonb_build_object('${to}', ${element} -> '${from}')
                     ELSE ${element} END)`;
  }
  let typed = element;
  for (const [from, to] of types) {
    typed = `(CASE WHEN ${typed} ->> 'type' = '${from}' THEN jsonb_set(${typed}, '{type}', '"${to}"') ELSE ${typed} END)`;
  }
  await q.query(
    `UPDATE "leads"
        SET "service_payload" = jsonb_set(
              "service_payload",
              ARRAY[$1::text],
              COALESCE((
                SELECT jsonb_agg(CASE WHEN jsonb_typeof(elem) = 'object' THEN ${typed} ELSE elem END ORDER BY ord)
                  FROM jsonb_array_elements("service_payload" -> $1::text) WITH ORDINALITY AS t(elem, ord)
              ), '[]'::jsonb))
      WHERE jsonb_typeof("service_payload") = 'object'
        AND jsonb_typeof("service_payload" -> $1::text) = 'array'`,
    [arrayKey],
  );
}

const reverse = (pairs: ReadonlyArray<[string, string]>): Array<[string, string]> =>
  pairs.map(([a, b]) => [b, a] as [string, string]);

export class CanonicalizeLeadsToEnglish20260928000011 implements MigrationInterface {
  name = 'CanonicalizeLeadsToEnglish20260928000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(renameIndex('idx_leads_payload_servico', 'idx_leads_service_payload'));

    for (const [legacy, canonical] of SERVICE_TYPES) {
      await queryRunner.query(`UPDATE "leads" SET "service_type" = $1 WHERE "service_type" = $2`, [canonical, legacy]);
    }

    for (const [from, to] of CRM_KEYS) await renameKey(queryRunner, 'crm_internal_data', from, to);
    for (const [key, from, to] of CRM_VALUES) await remapValue(queryRunner, 'crm_internal_data', key, from, to);

    for (const [from, to] of PAYLOAD_KEYS) await renameKey(queryRunner, 'service_payload', from, to);
    for (const [key, from, to] of PAYLOAD_VALUES) await remapValue(queryRunner, 'service_payload', key, from, to);
    await rewriteInteractions(queryRunner, 'interactions', INTERACTION_KEYS, INTERACTION_TYPES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await rewriteInteractions(queryRunner, 'interactions', reverse(INTERACTION_KEYS), reverse(INTERACTION_TYPES));
    for (const [key, from, to] of PAYLOAD_VALUES) await remapValue(queryRunner, 'service_payload', key, to, from);
    for (const [from, to] of [...PAYLOAD_KEYS].reverse()) await renameKey(queryRunner, 'service_payload', to, from);

    for (const [key, from, to] of CRM_VALUES) await remapValue(queryRunner, 'crm_internal_data', key, to, from);
    for (const [from, to] of [...CRM_KEYS].reverse()) await renameKey(queryRunner, 'crm_internal_data', to, from);

    for (const [legacy, canonical] of SERVICE_TYPES) {
      await queryRunner.query(`UPDATE "leads" SET "service_type" = $1 WHERE "service_type" = $2`, [legacy, canonical]);
    }

    await queryRunner.query(renameIndex('idx_leads_service_payload', 'idx_leads_payload_servico'));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
