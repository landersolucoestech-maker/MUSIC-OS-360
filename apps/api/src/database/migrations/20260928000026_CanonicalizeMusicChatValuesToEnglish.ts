import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000026_CanonicalizeMusicChatValuesToEnglish (CZ-045)
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the MusicChat
 * triage vocabulary was stored in Portuguese inside jsonb documents:
 *   - conversations.metadata: service_status, priority, selected_menu_option;
 *   - musicchat_automation_settings.menu_options[]: id, responseTemplateId,
 *     priority; musicchat_automation_settings.templates[]: id.
 * The PT-BR text the customer and agents read (labels, titles, bodies, queue
 * and sector names) is display data and is left untouched.
 *
 * Only exact legacy values are remapped (custom option ids such as
 * `opcao-<timestamp>` are opaque and kept), so up() is idempotent. A default
 * option/template id is renamed only when the tenant does not already use the
 * target id (no duplicate ids; down() restores exactly). down()
 * maps the canonical values back, which is what the pre-CZ-045 build reads,
 * including values the new build wrote after up(). Historical automation
 * event payloads (musicchat_automation_events.payload) are an audit trail
 * and are not rewritten.
 */
const SERVICE_STATUSES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['nova', 'new'],
  ['aguardando_atendimento', 'waiting_agent'],
  ['em_atendimento', 'in_progress'],
  ['aguardando_cliente', 'waiting_customer'],
  ['resolvida', 'resolved'],
  ['arquivada', 'archived'],
];
const PRIORITIES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['baixa', 'low'],
  ['media', 'medium'],
  ['alta', 'high'],
  ['critica', 'critical'],
];
const MENU_OPTION_IDS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['producao', 'music_production'],
  ['editora', 'publishing_distribution'],
  ['financeiro', 'finance'],
  ['conteudo', 'content'],
  ['outros', 'other'],
  ['engano', 'wrong_contact'],
];

function toMap(pairs: ReadonlyArray<readonly [string, string]>, reverse: boolean): string {
  return JSON.stringify(Object.fromEntries(pairs.map(([legacy, canonical]) => (reverse ? [canonical, legacy] : [legacy, canonical]))));
}

async function apply(queryRunner: QueryRunner, reverse: boolean): Promise<void> {
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
  const statuses = toMap(SERVICE_STATUSES, reverse);
  const priorities = toMap(PRIORITIES, reverse);
  const optionIds = toMap(MENU_OPTION_IDS, reverse);

  // Rewrites one string key of a jsonb object through a {from: to} map; any
  // other value (missing key, non-string, unmapped string) is kept as is.
  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION pg_temp.musicchat_remap_key(doc jsonb, key text, pairs jsonb)
    RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
      SELECT CASE
        WHEN jsonb_typeof(doc) = 'object' AND jsonb_typeof(doc -> key) = 'string' AND pairs ? (doc ->> key)
          THEN jsonb_set(doc, ARRAY[key], pairs -> (doc ->> key))
        ELSE doc
      END
    $$`);

  await queryRunner.query(
    `UPDATE "conversations" c
        SET "metadata" = pg_temp.musicchat_remap_key(
              pg_temp.musicchat_remap_key(
                pg_temp.musicchat_remap_key(c."metadata", 'service_status', $1::jsonb),
                'priority', $2::jsonb),
              'selected_menu_option', $3::jsonb)
      WHERE jsonb_typeof(c."metadata") = 'object'
        AND (   $1::jsonb ? (c."metadata" ->> 'service_status')
             OR $2::jsonb ? (c."metadata" ->> 'priority')
             OR $3::jsonb ? (c."metadata" ->> 'selected_menu_option'))`,
    [statuses, priorities, optionIds],
  );

  await queryRunner.query(
    `WITH row_ids AS (
       -- Every option/template id already used by the tenant's settings.
       SELECT s."id",
              COALESCE((SELECT jsonb_agg(DISTINCT x.id)
                          FROM (SELECT e ->> 'id' AS id FROM jsonb_array_elements(s."menu_options") e
                                UNION SELECT e ->> 'id' FROM jsonb_array_elements(s."templates") e) x
                         WHERE x.id IS NOT NULL), '[]'::jsonb) AS ids
         FROM "musicchat_automation_settings" s
        WHERE jsonb_typeof(s."menu_options") = 'array' AND jsonb_typeof(s."templates") = 'array'
     ), row_maps AS (
       -- A default id is renamed only when its target is not already used by this tenant
       -- (a tenant holding both 'outros' and its own 'other' keeps both untouched, so the
       -- ids stay unique and down() restores exactly).
       SELECT r."id",
              COALESCE((SELECT jsonb_object_agg(m.key, m.value)
                          FROM jsonb_each($1::jsonb) m
                         WHERE NOT r.ids ? (m.value #>> '{}')), '{}'::jsonb) AS id_map
         FROM row_ids r
     ), remapped AS (
       SELECT s."id",
              (SELECT jsonb_agg(
                        pg_temp.musicchat_remap_key(
                          pg_temp.musicchat_remap_key(
                            pg_temp.musicchat_remap_key(e.opt, 'id', rm.id_map),
                            'responseTemplateId', rm.id_map),
                          'priority', $2::jsonb)
                        ORDER BY e.ord)
                 FROM jsonb_array_elements(s."menu_options") WITH ORDINALITY AS e(opt, ord)) AS menu_options,
              (SELECT jsonb_agg(pg_temp.musicchat_remap_key(e.tpl, 'id', rm.id_map) ORDER BY e.ord)
                 FROM jsonb_array_elements(s."templates") WITH ORDINALITY AS e(tpl, ord)) AS templates
         FROM "musicchat_automation_settings" s
         JOIN row_maps rm ON rm."id" = s."id"
     )
     UPDATE "musicchat_automation_settings" s
        SET "menu_options" = COALESCE(r.menu_options, s."menu_options"),
            "templates"    = COALESCE(r.templates, s."templates")
       FROM remapped r
      WHERE s."id" = r."id"
        AND (COALESCE(r.menu_options, s."menu_options") IS DISTINCT FROM s."menu_options"
          OR COALESCE(r.templates, s."templates") IS DISTINCT FROM s."templates")`,
    [optionIds, priorities],
  );

  await queryRunner.query(`DROP FUNCTION pg_temp.musicchat_remap_key(jsonb, text, jsonb)`);
}

export class CanonicalizeMusicChatValuesToEnglish20260928000026 implements MigrationInterface {
  name = 'CanonicalizeMusicChatValuesToEnglish20260928000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await apply(queryRunner, false);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await apply(queryRunner, true);
  }
}
