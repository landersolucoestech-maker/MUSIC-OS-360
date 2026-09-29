/**
 * verify-cz042-cz043-migrations.ts
 *
 * Real-database regression for the data-safety guarantees of migrations
 * 20260928000019 (release statuses), 20260928000022 (artists, CZ-042) and
 * 20260928000023 (clients, CZ-043) — database review of bc40b76:
 *   - a metadata key PRESENT with null/'' wins over the stale column copy
 *     (a cleared bank account / PIX key never comes back);
 *   - invalid dates / over-long text become NULL and stay in metadata (also
 *     through down() + re-apply); dd/mm/yyyy dates are parsed;
 *   - value maps are case/space-insensitive; a JSON-text jsonb value is parsed;
 *   - copied keys leave metadata (no stale plaintext duplicate);
 *   - down() writes the columns back to the legacy metadata keys, so edits made
 *     after up() survive rollback + re-apply, and so do client edits/clears
 *     made by the pre-CZ-043 web while rolled back;
 *   - release down() never reverts a status changed after up() nor applies a
 *     legacy_status planted through the API;
 *   - the older `cargo_responsavel` alias never fills a job title the current
 *     key cleared or could not copy, and down() never overwrites that value.
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
const ARTIST_DMY = '40000000-0000-0000-0000-0000000000f5';
const ARTIST_ZERO_DATE = '40000000-0000-0000-0000-0000000000f6';
const CLIENT = '40000000-0000-0000-0000-0000000000f2';
const CLIENT_ALIAS = '40000000-0000-0000-0000-0000000000f7';
/** Over-long current job title next to the older alias (b875241 LOW-2). */
const CLIENT_OVERLONG_TITLE = '40000000-0000-0000-0000-0000000000f8';
/** Current job title cleared (null) next to the older alias, over a stale column. */
const CLIENT_CLEARED_TITLE = '40000000-0000-0000-0000-0000000000f9';
/** interacoes stored as JSON text (INFO-2). */
const CLIENT_JSON_TEXT = '40000000-0000-0000-0000-0000000000fa';
/** metadata that is a JSON array, not an object: down() must leave it untouched (48de4bb INFO-B). */
const CLIENT_ARRAY_METADATA = '40000000-0000-0000-0000-0000000000fb';
const CLIENT_PROBES = [CLIENT, CLIENT_ALIAS, CLIENT_OVERLONG_TITLE, CLIENT_CLEARED_TITLE, CLIENT_JSON_TEXT, CLIENT_ARRAY_METADATA];
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
  await db.query(`DELETE FROM artists WHERE id = ANY($1::uuid[])`, [[ARTIST, ARTIST_DMY, ARTIST_ZERO_DATE]]);
  await db.query(`DELETE FROM clients WHERE id = ANY($1::uuid[])`, [CLIENT_PROBES]);
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
        banco: null, chave_pix: '', conta: '123', data_nascimento: '31/02/1990', genero: 'masculino', tags_musicais: null,
        relacionamentos: JSON.stringify([{ type: 'Empresario', nome: 'Z' }]), endereco: 'x'.repeat(310),
      })],
    );
    await db.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico, metadata) VALUES ($1, $2, 'Probe DMY', $3)`,
      [ARTIST_DMY, tenant, JSON.stringify({ data_nascimento: '15/03/1985' })],
    );
    // '00/00/1990' is a common "unknown" placeholder: to_date() alone would invent 1990-01-01.
    await db.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico, metadata) VALUES ($1, $2, 'Probe zero date', $3)`,
      [ARTIST_ZERO_DATE, tenant, JSON.stringify({ data_nascimento: '00/00/1990' })],
    );
    await db.query(
      `INSERT INTO clients (id, tenant_id, nome, categoria, perfil, metadata) VALUES ($1, $2, 'Probe Cliente', 'PARTNER', 'outros', $3)`,
      [CLIENT, tenant, JSON.stringify({
        responsavel_email: 'a@x.com', cargo_responsavel: 'Diretora',
        interacoes: [{}, { type: 'ligacao', data: '2026-01-01' }],
      })],
    );
    await db.query(
      // `cep` column holds a stale value: an over-long metadata cep must clear it, not leave it.
      `INSERT INTO clients (id, tenant_id, nome, categoria, perfil, cep, metadata) VALUES ($1, $2, 'Probe Alias', 'PARTNER', 'outros', '01310-100', $3)`,
      [CLIENT_ALIAS, tenant, JSON.stringify({ responsavel_cargo: 'Gerente', cargo_responsavel: 'Cargo antigo', cep: '0'.repeat(20) })],
    );
    await db.query(
      `INSERT INTO clients (id, tenant_id, nome, categoria, perfil, metadata) VALUES ($1, $4, 'Probe Over-long title', 'PARTNER', 'outros', $5),
         ($2, $4, 'Probe Cleared title', 'PARTNER', 'outros', $6), ($3, $4, 'Probe JSON text', 'PARTNER', 'outros', $7)`,
      [CLIENT_OVERLONG_TITLE, CLIENT_CLEARED_TITLE, CLIENT_JSON_TEXT, tenant,
        JSON.stringify({ responsavel_cargo: 'T'.repeat(120), cargo_responsavel: 'Diretor' }),
        JSON.stringify({ responsavel_cargo: null, cargo_responsavel: 'Alias antigo' }),
        JSON.stringify({ interacoes: JSON.stringify([{ type: 'reuniao', descricao: 'Kickoff', data: '2026-02-01' }]) })],
    );
    await db.query(`UPDATE clients SET responsavel_cargo = 'Cargo antigo na coluna' WHERE id = $1`, [CLIENT_CLEARED_TITLE]);
    await db.query(
      `INSERT INTO clients (id, tenant_id, nome, categoria, perfil, razao_social, metadata) VALUES ($1, $2, 'Probe array metadata', 'PARTNER', 'outros', 'ACME Ltda', '["nota antiga"]')`,
      [CLIENT_ARRAY_METADATA, tenant],
    );
    await db.query(
      `INSERT INTO releases (id, tenant_id, title, status, type) VALUES ($1, $3, 'Probe R1', 'Rascunho ', 'single'), ($2, $3, 'Probe R2', 'em_producao', ' LP')`,
      [RELEASE_CHANGED, RELEASE_PLANTED, tenant],
    );

    // ── up ────────────────────────────────────────────────────────────────────
    dbOps('migrate');
    const a = await one(db, `SELECT bank_name, pix_key, bank_account, birth_date, profile_type, specialties, relationships, address, music_tags, metadata FROM artists WHERE id = $1`, [ARTIST]);
    const am = a['metadata'] as Record<string, unknown>;
    check('artists: cleared bank_name (metadata null) wins over stale column', a['bank_name'], null);
    check("artists: cleared pix_key (metadata '') wins over stale column", a['pix_key'], null);
    check('artists: bank_account from metadata', a['bank_account'], '123');
    check('artists: invalid date -> NULL', a['birth_date'], null);
    check('artists: invalid date kept in metadata', am['data_nascimento'], '31/02/1990');
    check('artists: jsonb key present as null -> NULL column, key removed', [a['music_tags'], 'tags_musicais' in am], [null, false]);
    const dmy = await one(db, `SELECT birth_date::text AS birth_date, metadata FROM artists WHERE id = $1`, [ARTIST_DMY]);
    check('artists: dd/mm/yyyy birth date parsed', [dmy['birth_date'], 'data_nascimento' in (dmy['metadata'] as object)], ['1985-03-15', false]);
    const zero = await one(db, `SELECT birth_date, metadata FROM artists WHERE id = $1`, [ARTIST_ZERO_DATE]);
    check('artists: zero-part date is not invented (NULL column, original kept in metadata)',
      [zero['birth_date'], (zero['metadata'] as Record<string, unknown>)['data_nascimento']], [null, '00/00/1990']);
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
    const ca = await one(db, `SELECT responsible_job_title, zip_code, metadata FROM clients WHERE id = $1`, [CLIENT_ALIAS]);
    check('clients: newer key wins; superseded cargo_responsavel parked (never refills); over-long cep clears the stale column + kept',
      [ca['responsible_job_title'], ca['zip_code'], ca['metadata']],
      ['Gerente', null, { cep: '0'.repeat(20), legacy_cargo_responsavel: 'Cargo antigo' }]);
    const co = await one(db, `SELECT responsible_job_title, metadata FROM clients WHERE id = $1`, [CLIENT_OVERLONG_TITLE]);
    check('clients: an over-long current job title is kept and the older alias never fills the column',
      [co['responsible_job_title'], co['metadata']],
      [null, { responsavel_cargo: 'T'.repeat(120), legacy_cargo_responsavel: 'Diretor' }]);
    const cc = await one(db, `SELECT responsible_job_title, metadata FROM clients WHERE id = $1`, [CLIENT_CLEARED_TITLE]);
    check('clients: a cleared current job title wins over the stale column and the older alias',
      [cc['responsible_job_title'], cc['metadata']], [null, { legacy_cargo_responsavel: 'Alias antigo' }]);
    const cj = await one(db, `SELECT interactions, metadata FROM clients WHERE id = $1`, [CLIENT_JSON_TEXT]);
    check('clients: interacoes as JSON text parsed, keys/types mapped, key removed',
      [cj['interactions'], cj['metadata']], [[{ date: '2026-02-01', type: 'meeting', description: 'Kickoff' }], {}]);
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
    const cod = await one(db, `SELECT responsavel_cargo, metadata FROM clients WHERE id = $1`, [CLIENT_OVERLONG_TITLE]);
    check('down: the over-long job title (only copy) is not overwritten by the alias',
      [cod['responsavel_cargo'], (cod['metadata'] as Record<string, unknown>)['responsavel_cargo'], 'cargo_responsavel' in (cod['metadata'] as object)],
      [null, 'T'.repeat(120), false]);
    const cam = await one(db, `SELECT razao_social, metadata FROM clients WHERE id = $1`, [CLIENT_ARRAY_METADATA]);
    check('down: non-object metadata is left untouched (the value stays in its column)', [cam['razao_social'], cam['metadata']], ['ACME Ltda', ['nota antiga']]);
    const cd = await one(db, `SELECT metadata FROM clients WHERE id = $1`, [CLIENT]);
    check('down: client edit written back to legacy metadata key', (cd['metadata'] as Record<string, unknown>)['responsavel_email'], 'b@x.com');
    check('down: values up() could not copy survive in metadata', [typeof adm['endereco'], adm['data_nascimento']], ['string', '31/02/1990']);
    // The pre-CZ-043 web writes contact fields to metadata only: an edit and a clear while rolled back.
    await db.query(`UPDATE clients SET metadata = metadata || '{"responsavel_email":"c@x.com","responsavel_cargo":""}' WHERE id = $1`, [CLIENT]);
    const rd = await db.query(`SELECT status, metadata ? 'legacy_status' AS has_key FROM releases WHERE id = ANY($1::uuid[]) ORDER BY id`, [[RELEASE_CHANGED, RELEASE_PLANTED]]);
    check('down: status changed after up() is not reverted; planted legacy_status dropped', rd.rows.map((x) => [x.status, x.has_key]), [['released', false], ['draft', false]]);

    // ── re-apply ────────────────────────────────────────────────────────────────
    dbOps('migrate');
    const au = await one(db, `SELECT bank_name, pix_key, relationships, address, birth_date, metadata FROM artists WHERE id = $1`, [ARTIST]);
    const aum = au['metadata'] as Record<string, unknown>;
    check('re-up: artist edits survive rollback + re-apply', [au['bank_name'], au['pix_key'], au['relationships']], ['Banco Novo', 'pix-novo', [{ name: 'W', type: 'agent' }]]);
    check('re-up: uncopied values still kept in metadata', [au['address'], au['birth_date'], typeof aum['endereco'], aum['data_nascimento']], [null, null, 'string', '31/02/1990']);
    const cu = await one(db, `SELECT responsible_email, responsible_job_title, metadata FROM clients WHERE id = $1`, [CLIENT]);
    check('re-up: client edit and clear made while rolled back win', [cu['responsible_email'], cu['responsible_job_title'], cu['metadata']], ['c@x.com', null, {}]);
    const cou = await one(db, `SELECT responsible_job_title, metadata FROM clients WHERE id = $1`, [CLIENT_OVERLONG_TITLE]);
    check('re-up: over-long job title still kept; alias still parked',
      [cou['responsible_job_title'], cou['metadata']], [null, { responsavel_cargo: 'T'.repeat(120), legacy_cargo_responsavel: 'Diretor' }]);
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
