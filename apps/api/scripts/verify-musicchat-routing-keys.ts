/**
 * verify-musicchat-routing-keys.ts
 *
 * Real-database regression for 20261005100001_BackfillMusicChatRoutingKeys:
 * musicchat_automation_settings.menu_options[] gets queueKey/sectorKey ONLY by exact legacy label match on up(),
 * is restored exactly on down(), is idempotent on a re-up(), and nothing else changes (edited labels, existing
 * keys, other jsonb keys, non-object elements, updated_at).
 *
 * DESTRUCTIVE on the target database (rolls back and re-applies a migration): refuses to run unless the database
 * name ends with `_mig` (disposable copy). Probe rows are removed at the end.
 *
 *   DB_SSL=false DATABASE_URL=postgresql://…/musicos360_mig npx tsx scripts/verify-musicchat-routing-keys.ts
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
  console.error(`[verify-musicchat-routing-keys] refusing to run: database "${dbName || '(none)'}" is not a disposable *_mig copy.`);
  process.exit(2);
}

const API_DIR = path.resolve(__dirname, '..');
const TARGET = 'BackfillMusicChatRoutingKeys20261005100001';
const T_PROBE = '45000000-0000-0000-0000-0000000000f1';
const T_EMPTY = '45000000-0000-0000-0000-0000000000f2';
const T_CANON = '45000000-0000-0000-0000-0000000000f3';
const PROBE_TENANTS = [T_PROBE, T_EMPTY, T_CANON];

const OPTIONS_PROBE = [
  { id: 'shows', order: 1, label: 'Contratação de Shows', responseTemplateId: 'shows', queue: 'Comercial', sector: 'Shows', tags: ['Show'], priority: 'high', active: true, extra: { a: 1 } },
  { id: 'custom', order: 2, label: 'Vendas', responseTemplateId: 'custom', queue: 'Vendas', sector: 'Triagem', tags: [] },
  { id: 'edited', order: 3, label: 'X', responseTemplateId: 'x', queue: 'comercial ', sector: 'Suporte ' },
  { id: 'keyed', order: 4, label: 'K', responseTemplateId: 'k', queue: 'Atendimento', queueKey: 'my_queue', sector: 'Suporte', sectorKey: null },
  'not-an-object',
];
const OPTIONS_CANON = [{ id: 'a', order: 1, label: 'A', responseTemplateId: 'a', queue: 'Comercial', queueKey: 'commercial', sector: 'Shows', sectorKey: 'shows' }];
const OPTIONS_UP = [
  { ...(OPTIONS_PROBE[0] as object), queueKey: 'commercial', sectorKey: 'shows' },
  { ...(OPTIONS_PROBE[1] as object), sectorKey: 'triage' },
  OPTIONS_PROBE[2],
  { ...(OPTIONS_PROBE[3] as object), sectorKey: 'support' },
  'not-an-object',
];

let failures = 0;
// jsonb does not keep object key order: compare with keys sorted (array order still matters).
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v);
}
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = stable(actual) === stable(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

function dbOps(command: 'migrate' | 'rollback'): void {
  execFileSync('npx', ['tsx', 'scripts/db-ops.ts', command], { cwd: API_DIR, stdio: 'ignore', env: process.env });
}

async function lastMigration(db: Client): Promise<string> {
  const { rows } = await db.query(`SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 1`);
  return rows[0]?.name ?? '';
}

/** Rolls back until the migration BEFORE `name` is the last one (i.e. `name` itself is reverted). */
async function rollbackThrough(db: Client, name: string): Promise<void> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM musicos360_migrations WHERE id >= (SELECT id FROM musicos360_migrations WHERE name = $1)`,
    [name],
  );
  const steps: number = rows[0]?.n ?? 0;
  for (let i = 0; i < steps; i += 1) dbOps('rollback');
  const { rowCount } = await db.query(`SELECT 1 FROM musicos360_migrations WHERE name = $1`, [name]);
  if (rowCount !== 0) throw new Error(`could not roll back ${name} (last is ${await lastMigration(db)})`);
}

async function main(): Promise<void> {
  const db = new Client({ connectionString: url, ssl: process.env.DB_SSL === 'false' ? false : undefined });
  await db.connect();
  // Only the verifier's own probe tenants/rows are ever deleted.
  const cleanup = async (): Promise<void> => {
    await db.query(`DELETE FROM musicchat_automation_settings WHERE tenant_id = ANY($1::uuid[])`, [PROBE_TENANTS]);
    await db.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [PROBE_TENANTS]);
  };
  try {
    dbOps('migrate');
    // tenants.org_id has no foreign key: reuse an existing org when the copy has tenants, else a fixed probe org id.
    const demo = (await db.query(`SELECT org_id FROM tenants WHERE id <> ALL($1::uuid[]) AND deleted_at IS NULL ORDER BY created_at LIMIT 1`, [PROBE_TENANTS])).rows[0]
      ?? { org_id: '45000000-0000-0000-0000-0000000000a1' };
    await cleanup();
    await db.query(
      `INSERT INTO tenants (id, org_id, name, slug) VALUES ($1, $4, 'RK probe', 'rk-probe'), ($2, $4, 'RK empty', 'rk-empty'), ($3, $4, 'RK canonical', 'rk-canonical')`,
      [T_PROBE, T_EMPTY, T_CANON, demo.org_id],
    );
    // Reverted state: the migration is not applied, so the probe rows are the legacy (key-less) shape.
    await rollbackThrough(db, TARGET);
    const cols = `tenant_id, welcome_message, main_menu_message, invalid_option_message, absence_message, out_of_hours_message, closing_message, menu_options, templates`;
    await db.query(
      `INSERT INTO musicchat_automation_settings (${cols}) VALUES
         ($1, 'Olá', '1. Shows', 'x', 'x', 'x', 'x', $2, '[]'),
         ($3, 'Olá', '', 'x', 'x', 'x', 'x', '[]', '[]'),
         ($4, 'Olá', '', 'x', 'x', 'x', 'x', $5, '[]')`,
      [T_PROBE, JSON.stringify(OPTIONS_PROBE), T_EMPTY, T_CANON, JSON.stringify(OPTIONS_CANON)],
    );
    const row = async (tenant: string) =>
      (await db.query(`SELECT menu_options, welcome_message, updated_at::text AS updated_at FROM musicchat_automation_settings WHERE tenant_id = $1`, [tenant])).rows[0];
    const initial = { probe: await row(T_PROBE), empty: await row(T_EMPTY), canon: await row(T_CANON) };

    dbOps('migrate');
    check('up: migration applied', (await db.query(`SELECT 1 FROM musicos360_migrations WHERE name = $1`, [TARGET])).rowCount, 1);
    const up = await row(T_PROBE);
    check('up: keys added by exact legacy label only; edited labels, existing keys, other jsonb keys, non-objects untouched', up.menu_options, OPTIONS_UP);
    check('up: other columns and updated_at untouched', [up.welcome_message, up.updated_at], [initial.probe.welcome_message, initial.probe.updated_at]);
    check('up: empty array and already keyed tenant unchanged', [(await row(T_EMPTY)).menu_options, (await row(T_CANON)).menu_options], [[], OPTIONS_CANON]);
    const logged = (await db.query(`SELECT count(*)::int AS n FROM musicchat_routing_keys_backfill_20261005 WHERE tenant_id = ANY($1::uuid[])`, [PROBE_TENANTS])).rows[0].n;
    check('up: only the rewritten row is recorded in the side table', logged, 1);

    dbOps('rollback');
    dbOps('migrate');
    check('re-up (rollback + migrate): same result', (await row(T_PROBE)).menu_options, OPTIONS_UP);

    // Idempotency of the data step itself: run up() again through a no-op re-apply is covered by the unit spec; here a
    // row edited by a user after up() must survive down().
    await db.query(`UPDATE musicchat_automation_settings SET menu_options = $2::jsonb WHERE tenant_id = $1`, [T_CANON, JSON.stringify([{ id: 'edited-by-user' }])]);
    await rollbackThrough(db, TARGET);
    const down = await row(T_PROBE);
    check('down: BEFORE restored exactly (no key left behind)', [down.menu_options, down.updated_at], [OPTIONS_PROBE, initial.probe.updated_at]);
    check('down: a row edited after up() is not reverted', (await row(T_CANON)).menu_options, [{ id: 'edited-by-user' }]);

    dbOps('migrate');
    check('final up: same result as the first up()', (await row(T_PROBE)).menu_options, OPTIONS_UP);
  } finally {
    await cleanup().catch((error: unknown) => console.error('[verify-musicchat-routing-keys] cleanup failed:', error));
    await db.end();
  }
  if (failures > 0) {
    console.error(`\n[verify-musicchat-routing-keys] ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n[verify-musicchat-routing-keys] all checks passed');
}

main().catch((error: unknown) => {
  console.error('[verify-musicchat-routing-keys] error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
