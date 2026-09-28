/**
 * verify-cz042-cz043-migrations.ts
 *
 * Real-database regression for the data-safety guarantees of migrations
 * 20260928000019 (release statuses), 20260928000022 (artists, CZ-042) and
 * 20260928000023 (clients, CZ-043) — database review of bc40b76:
 *   - a metadata key PRESENT with null/'' wins over the stale column copy
 *     (a cleared bank account / PIX key never comes back);
 *   - invalid dates / over-long text become NULL and stay in metadata;
 *   - value maps are case/space-insensitive; a JSON-text jsonb value is parsed;
 *   - copied keys leave metadata (no stale plaintext duplicate);
 *   - down() writes the columns back to the legacy metadata keys, so edits made
 *     after up() survive rollback + re-apply;
 *   - release down() never reverts a status changed after up() nor applies a
 *     legacy_status planted through the API.
 *
 * DESTRUCTIVE on the target database (rolls back and re-applies migrations):
 * refuses to run unless the database name ends with `_mig` (disposable copy).
 * Probe rows are removed at the end.
 *
 *   DB_SSL=false DATABASE_URL=postgresql://…/musicos360_mig npx tsx scripts/verify-cz042-cz043-migrations.ts
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
  console.error(`[verify-cz042-cz043] refusing to run: database "${dbName || '(none)'}" is not a disposable *_mig copy.`);
  process.exit(2);
}

const API_DIR = path.resolve(__dirname, '..');
const TARGET = 'CanonicalizeWorksToEnglish20260928000018';
const ARTIST = '40000000-0000-0000-0000-0000000000f1';
const CLIENT = '40000000-0000-0000-0000-0000000000f2';
const RELEASE_CHANGED = '40000000-0000-0000-0000-0000000000f3';
const RELEASE_PLANTED = '40000000-0000-0000-0000-0000000000f4';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
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
  for (let i = 0; i < 20 && (await lastMigration(db)) !== name; i += 1) dbOps('rollback');
  if ((await lastMigration(db)) !== name) throw new Error(`could not roll back to ${name}`);
}

async function one<T = Record<string, unknown>>(db: Client, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, params);
  return rows[0] as T;
}

async function cleanup(db: Client): Promise<void> {
  await db.query(`DELETE FROM artists WHERE id = $1`, [ARTIST]);
  await db.query(`DELETE FROM clients WHERE id = $1`, [CLIENT]);
  await db.query(`DELETE FROM releases WHERE id = ANY($1::uuid[])`, [[RELEASE_CHANGED, RELEASE_PLANTED]]);
}

async function main(): Promise<void> {
  const db = new Client({ connectionString: url, ssl: process.env.DB_SSL === 'false' ? false : undefined });
  await db.connect();
  try {
    dbOps('migrate');
    const tenant = (await one<{ tenant_id: string }>(db, `SELECT tenant_id FROM clients LIMIT 1`))?.tenant_id
      ?? (await one<{ id: string }>(db, `SELECT id FROM tenants LIMIT 1`))?.id;
    if (!tenant) throw new Error('no tenant found in the disposable database (seed it first)');
    await cleanup(db);
    await rollbackTo(db, TARGET);

    // ── legacy (pre-CZ-042/043, pre-019) shape ────────────────────────────────
    await db.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico, banco, chave_pix, conta, especialidades, tipo_perfil, metadata)
       VALUES ($1, $2, 'Probe', 'Banco Antigo', 'pix-antigo', '999', '["Produtor","dj_produtor"]', ' Independente ', $3)`,
      [ARTIST, tenant, JSON.stringify({
        banco: null, chave_pix: '', conta: '123', data_nascimento: '31/12/1990', genero: 'masculino',
        relacionamentos: JSON.stringify([{ type: 'Empresario', nome: 'Z' }]), endereco: 'x'.repeat(310),
      })],
    );
    await db.query(
      `INSERT INTO clients (id, tenant_id, nome, categoria, perfil, metadata) VALUES ($1, $2, 'Probe Cliente', 'PARTNER', 'outros', $3)`,
      [CLIENT, tenant, JSON.stringify({
        responsavel_email: 'a@x.com', cargo_responsavel: 'Diretora',
        interacoes: [{}, { type: 'ligacao', data: '2026-01-01' }],
      })],
    );
    await db.query(
      `INSERT INTO releases (id, tenant_id, title, status, type) VALUES ($1, $3, 'Probe R1', 'Rascunho ', 'single'), ($2, $3, 'Probe R2', 'em_producao', ' LP')`,
      [RELEASE_CHANGED, RELEASE_PLANTED, tenant],
    );

    // ── up ────────────────────────────────────────────────────────────────────
    dbOps('migrate');
    const a = await one(db, `SELECT bank_name, pix_key, bank_account, birth_date, profile_type, specialties, relationships, address, metadata FROM artists WHERE id = $1`, [ARTIST]);
    const am = a['metadata'] as Record<string, unknown>;
    check('artists: cleared bank_name (metadata null) wins over stale column', a['bank_name'], null);
    check("artists: cleared pix_key (metadata '') wins over stale column", a['pix_key'], null);
    check('artists: bank_account from metadata', a['bank_account'], '123');
    check('artists: invalid date -> NULL', a['birth_date'], null);
    check('artists: invalid date kept in metadata', am['data_nascimento'], '31/12/1990');
    check('artists: over-long address -> NULL', a['address'], null);
    check('artists: over-long address kept in metadata', typeof am['endereco'], 'string');
    check('artists: copied keys leave metadata', ['banco', 'chave_pix', 'conta', 'relacionamentos'].filter((k) => k in am), []);
    check('artists: profile_type case/space-insensitive', a['profile_type'], 'independent');
    check('artists: specialties case-insensitive', a['specialties'], ['producer', 'dj_producer']);
    check('artists: JSON-text relationships parsed + type mapped', a['relationships'], [{ name: 'Z', type: 'agent' }]);
    check('artists: gender case-insensitive', am['gender'], 'male');
    const c = await one(db, `SELECT responsible_email, responsible_job_title, interactions, metadata FROM clients WHERE id = $1`, [CLIENT]);
    check('clients: responsible_email backfilled', c['responsible_email'], 'a@x.com');
    check('clients: cargo_responsavel backfilled', c['responsible_job_title'], 'Diretora');
    check('clients: empty interaction item stays {}', c['interactions'], [{}, { date: '2026-01-01', type: 'call' }]);
    check('clients: copied keys leave metadata', c['metadata'], {});
    const r = await db.query(`SELECT id, status, type FROM releases WHERE id = ANY($1::uuid[]) ORDER BY id`, [[RELEASE_CHANGED, RELEASE_PLANTED]]);
    check('releases: legacy statuses/types mapped', r.rows.map((x) => [x.status, x.type]), [['draft', 'single'], ['draft', 'album']]);

    // ── edits by the new API, then rollback ─────────────────────────────────────
    await db.query(`UPDATE artists SET bank_name = 'Banco Novo', pix_key = 'pix-novo', relationships = '[{"type":"agent","name":"W"}]' WHERE id = $1`, [ARTIST]);
    await db.query(`UPDATE clients SET responsible_email = 'b@x.com' WHERE id = $1`, [CLIENT]);
    await db.query(`UPDATE releases SET status = 'released' WHERE id = $1`, [RELEASE_CHANGED]);
    await db.query(`UPDATE releases SET metadata = metadata || '{"legacy_status":"arquivado"}' WHERE id = $1`, [RELEASE_PLANTED]);
    await rollbackTo(db, TARGET);
    const ad = await one(db, `SELECT banco, chave_pix, metadata FROM artists WHERE id = $1`, [ARTIST]);
    const adm = ad['metadata'] as Record<string, unknown>;
    check('down: artist edits written back to legacy metadata keys', [adm['banco'], adm['chave_pix'], adm['relacionamentos']], ['Banco Novo', 'pix-novo', [{ nome: 'W', type: 'empresario' }]]);
    check('down: artist legacy columns hold the edits', [ad['banco'], ad['chave_pix']], ['Banco Novo', 'pix-novo']);
    const cd = await one(db, `SELECT metadata FROM clients WHERE id = $1`, [CLIENT]);
    check('down: client edit written back to legacy metadata key', (cd['metadata'] as Record<string, unknown>)['responsavel_email'], 'b@x.com');
    const rd = await db.query(`SELECT status, metadata ? 'legacy_status' AS has_key FROM releases WHERE id = ANY($1::uuid[]) ORDER BY id`, [[RELEASE_CHANGED, RELEASE_PLANTED]]);
    check('down: status changed after up() is not reverted; planted legacy_status dropped', rd.rows.map((x) => [x.status, x.has_key]), [['released', false], ['draft', false]]);

    // ── re-apply ────────────────────────────────────────────────────────────────
    dbOps('migrate');
    const au = await one(db, `SELECT bank_name, pix_key, relationships FROM artists WHERE id = $1`, [ARTIST]);
    check('re-up: artist edits survive rollback + re-apply', [au['bank_name'], au['pix_key'], au['relationships']], ['Banco Novo', 'pix-novo', [{ name: 'W', type: 'agent' }]]);
    const cu = await one(db, `SELECT responsible_email, metadata FROM clients WHERE id = $1`, [CLIENT]);
    check('re-up: client edit survives rollback + re-apply', [cu['responsible_email'], cu['metadata']], ['b@x.com', {}]);
  } finally {
    await cleanup(db).catch(() => undefined);
    await db.end();
  }
  if (failures > 0) {
    console.error(`\n[verify-cz042-cz043] ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n[verify-cz042-cz043] all checks passed');
}

main().catch((error: unknown) => {
  console.error('[verify-cz042-cz043] error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
