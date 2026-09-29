/**
 * verify-cz045-musicchat-migration.ts
 *
 * Real-database regression for 20260928000026_CanonicalizeMusicChatValuesToEnglish
 * (CZ-045): conversations.metadata service_status/priority/selected_menu_option
 * and musicchat_automation_settings menu_options[]/templates[] are remapped to
 * English on up(), back to the legacy values on down(), and nothing else in
 * those documents changes (PT-BR labels, custom option ids, array order,
 * non-string values, empty arrays).
 *
 * DESTRUCTIVE on the target database (rolls back and re-applies a migration):
 * refuses to run unless the database name ends with `_mig` (disposable copy).
 * Probe rows are removed at the end.
 *
 *   DB_SSL=false DATABASE_URL=postgresql://…/musicos360_mig npx tsx scripts/verify-cz045-musicchat-migration.ts
 */
import { execFileSync } from 'child_process';
import * as path from 'path';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? '';
const dbName = (() => {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
if (!dbName.endsWith('_mig')) {
  console.error(`[verify-cz045] refusing to run: database "${dbName || '(none)'}" is not a disposable *_mig copy.`);
  process.exit(2);
}

const API_DIR = path.resolve(__dirname, '..');
const TARGET = 'RenameOrgStructureSlugsToEnglish20260928000025';
const TENANT_EMPTY = '45000000-0000-0000-0000-0000000000e1';
const CONV_LEGACY = '45000000-0000-0000-0000-0000000000c1';
const CONV_OTHER = '45000000-0000-0000-0000-0000000000c2';
const CONV_NEW_BUILD = '45000000-0000-0000-0000-0000000000c3';

let failures = 0;
// jsonb does not keep object key order — compare with keys sorted (array order still matters).
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v);
}
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = stable(actual) === stable(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

function dbOps(command: 'migrate' | 'rollback'): void {
  execFileSync('npx', ['tsx', 'scripts/db-ops.ts', command], { cwd: API_DIR, stdio: 'ignore', env: process.env });
}

async function lastMigration(db: Client): Promise<string> {
  const { rows } = await db.query(`SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 1`);
  return rows[0]?.name ?? '';
}

async function rollbackTo(db: Client, name: string): Promise<void> {
  for (let i = 0; i < 5 && (await lastMigration(db)) !== name; i += 1) dbOps('rollback');
  if ((await lastMigration(db)) !== name) throw new Error(`could not roll back to ${name}`);
}

const LEGACY_OPTIONS = [
  { id: 'shows', order: 1, label: 'Contratação de Shows', responseTemplateId: 'shows', queue: 'Comercial', sector: 'Shows', tags: ['Show'], priority: 'alta', active: true },
  { id: 'engano', order: 8, label: 'Contato por Engano', responseTemplateId: 'engano', queue: 'Atendimento', sector: 'Triagem', tags: ['Contato por Engano'], priority: 'baixa', active: true },
  { id: 'opcao-1700000000000', order: 9, label: 'Nova opção', responseTemplateId: 'outros', queue: 'Atendimento', sector: 'Triagem', tags: [], active: true },
  { id: 'questionario-1700000000001', order: 10, label: 'Questionário', responseTemplateId: 'questionario-1700000000001', queue: 'A', sector: 'T', priority: 'critica', active: false },
  'not-an-object',
];
const LEGACY_TEMPLATES = [
  { id: 'engano', title: 'Contato por Engano', body: 'Sem problemas.' },
  { id: 'outros', title: 'Outros Assuntos', body: 'Certo.' },
  { id: 'questionario-1700000000001', title: 'Questionário', body: '' },
];
const LEGACY_CONVERSATION = {
  external_contact_id: '5511999999999', automation_state: 'routed', service_status: 'aguardando_atendimento',
  priority: 'alta', selected_menu_option: 'engano', queue: 'Atendimento', sector: 'Triagem', tags: ['Contato por Engano'],
};
const OTHER_CONVERSATION = { service_status: 'status_desconhecido', priority: 5, selected_menu_option: 'opcao-1700000000000' };

async function main(): Promise<void> {
  const db = new Client({ connectionString: url, ssl: process.env.DB_SSL === 'false' ? false : undefined });
  await db.connect();
  let tenant = '';
  let savedSettings: Record<string, unknown> | undefined;
  const cleanup = async (): Promise<void> => {
    await db.query(`DELETE FROM conversations WHERE id = ANY($1::uuid[])`, [[CONV_LEGACY, CONV_OTHER, CONV_NEW_BUILD]]);
    await db.query(`DELETE FROM musicchat_automation_settings WHERE tenant_id = ANY($1::uuid[])`, [[tenant, TENANT_EMPTY].filter(Boolean)]);
    await db.query(`DELETE FROM tenants WHERE id = $1`, [TENANT_EMPTY]);
    if (savedSettings) {
      const columns = Object.keys(savedSettings);
      await db.query(
        `INSERT INTO musicchat_automation_settings (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        columns.map((c) => {
          const value = savedSettings![c];
          return value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value;
        }),
      );
      savedSettings = undefined;
    }
  };
  try {
    dbOps('migrate');
    const demo = (await db.query(`SELECT id, org_id FROM tenants WHERE id <> $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`, [TENANT_EMPTY])).rows[0];
    if (!demo) throw new Error('no tenant found in the disposable database (seed it first)');
    tenant = demo.id as string;
    savedSettings = (await db.query(`SELECT * FROM musicchat_automation_settings WHERE tenant_id = $1`, [tenant])).rows[0];
    await cleanup();
    await db.query(
      `INSERT INTO tenants (id, org_id, name, slug) VALUES ($1, $2, 'CZ-045 probe', 'cz045-probe')`,
      [TENANT_EMPTY, demo.org_id],
    );
    await rollbackTo(db, TARGET);

    // ── legacy (pre-CZ-045) shape ─────────────────────────────────────────────
    const settingsColumns = `tenant_id, welcome_message, main_menu_message, invalid_option_message, absence_message, out_of_hours_message, closing_message, menu_options, templates`;
    await db.query(
      `INSERT INTO musicchat_automation_settings (${settingsColumns}) VALUES ($1, 'Olá', '1. Shows', 'x', 'x', 'x', 'x', $2, $3), ($4, 'Olá', '', 'x', 'x', 'x', 'x', '[]', '[]')`,
      [tenant, JSON.stringify(LEGACY_OPTIONS), JSON.stringify(LEGACY_TEMPLATES), TENANT_EMPTY],
    );
    await db.query(
      `INSERT INTO conversations (id, tenant_id, subject, metadata) VALUES ($1, $3, 'Probe legacy', $4), ($2, $3, 'Probe other', $5)`,
      [CONV_LEGACY, CONV_OTHER, tenant, JSON.stringify(LEGACY_CONVERSATION), JSON.stringify(OTHER_CONVERSATION)],
    );
    const settings = async (id: string) => (await db.query(`SELECT menu_options, templates FROM musicchat_automation_settings WHERE tenant_id = $1`, [id])).rows[0];
    const metadata = async (id: string) => (await db.query(`SELECT metadata FROM conversations WHERE id = $1`, [id])).rows[0]?.metadata;

    // ── up ────────────────────────────────────────────────────────────────────
    dbOps('migrate');
    check('up: 026 applied', await lastMigration(db), 'CanonicalizeMusicChatValuesToEnglish20260928000026');
    check('up: conversation service_status/priority/selected_menu_option remapped, other keys untouched', await metadata(CONV_LEGACY), {
      ...LEGACY_CONVERSATION, service_status: 'waiting_agent', priority: 'high', selected_menu_option: 'wrong_contact',
    });
    check('up: unknown status, non-string priority and custom option id kept', await metadata(CONV_OTHER), OTHER_CONVERSATION);
    const up = await settings(tenant);
    check('up: menu options remapped in order, labels/custom ids/non-objects kept', up.menu_options, [
      { ...(LEGACY_OPTIONS[0] as object), priority: 'high' },
      { ...(LEGACY_OPTIONS[1] as object), id: 'wrong_contact', responseTemplateId: 'wrong_contact', priority: 'low' },
      { ...(LEGACY_OPTIONS[2] as object), responseTemplateId: 'other' },
      { ...(LEGACY_OPTIONS[3] as object), priority: 'critical' },
      'not-an-object',
    ]);
    check('up: template ids remapped, titles/bodies kept', up.templates, [
      { ...LEGACY_TEMPLATES[0], id: 'wrong_contact' }, { ...LEGACY_TEMPLATES[1], id: 'other' }, LEGACY_TEMPLATES[2],
    ]);
    check('up: empty arrays stay empty', await settings(TENANT_EMPTY), { menu_options: [], templates: [] });

    // ── a conversation written by the new build, then rollback ─────────────────
    await db.query(
      `INSERT INTO conversations (id, tenant_id, subject, metadata) VALUES ($1, $2, 'Probe new build', $3)`,
      [CONV_NEW_BUILD, tenant, JSON.stringify({ service_status: 'waiting_customer', priority: 'medium', selected_menu_option: 'music_production' })],
    );
    await rollbackTo(db, TARGET);
    check('down: legacy conversation restored exactly', await metadata(CONV_LEGACY), LEGACY_CONVERSATION);
    check('down: other conversation unchanged', await metadata(CONV_OTHER), OTHER_CONVERSATION);
    check('down: new-build values mapped to what the old build reads', await metadata(CONV_NEW_BUILD), {
      service_status: 'aguardando_cliente', priority: 'media', selected_menu_option: 'producao',
    });
    const down = await settings(tenant);
    check('down: settings restored exactly', [down.menu_options, down.templates], [LEGACY_OPTIONS, LEGACY_TEMPLATES]);
    check('down: empty arrays stay empty', await settings(TENANT_EMPTY), { menu_options: [], templates: [] });

    // ── re-apply ────────────────────────────────────────────────────────────────
    dbOps('migrate');
    const again = await settings(tenant);
    check('re-up: same result as the first up()', [await metadata(CONV_LEGACY), again.menu_options, again.templates], [
      { ...LEGACY_CONVERSATION, service_status: 'waiting_agent', priority: 'high', selected_menu_option: 'wrong_contact' },
      up.menu_options, up.templates,
    ]);
  } finally {
    await cleanup().catch((error: unknown) => console.error('[verify-cz045] cleanup failed:', error));
    await db.end();
  }
  if (failures > 0) {
    console.error(`\n[verify-cz045] ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n[verify-cz045] all checks passed');
}

main().catch((error: unknown) => {
  console.error('[verify-cz045] error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
