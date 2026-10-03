import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ALLOWLIST, GROUPS, SafetyError, UsageError, assertDraftMatches, assertSafeTarget, assertSelectOnly, evaluateChecklist, hostClass,
  isRegistered, loadGroup, makeReadOnlyQuery, parseArgs, parseChecklist, parsePlans, redact, repoRootOf, retentionFor, run,
  scanIdentifiers, selectGroups, validateRehearsal,
} from './legacy-drop-preflight.mjs';

const repoRoot = repoRootOf();
const URL_WITH_SECRET = 'postgresql://musicos360:s3cr3t-pass@127.0.0.1:54329/music_os_drops_base';

// ---------------------------------------------------------------- SELECT-only guard

test('assertSelectOnly accepts plain SELECTs, including literals that mention write keywords', () => {
  assertSelectOnly('SELECT count(*)::int AS n FROM "works" WHERE "legacy_lyrics" IS NOT NULL AND "lyrics" IS NULL');
  assertSelectOnly(`SELECT count(*)::int AS n FROM "transactions" WHERE "legacy_reference" <> ''`);
  assertSelectOnly(`SELECT 'DROP TABLE x; DELETE' AS literal`);
  assertSelectOnly(`SELECT to_regclass('public.' || $1) IS NOT NULL AS ok;`);
});

test('assertSelectOnly refuses every non-SELECT, multi-statement, comment and side-effect form', () => {
  const bad = [
    'INSERT INTO works (id) VALUES (1)', 'UPDATE works SET title = 1', 'DELETE FROM works', 'DROP TABLE works', 'ALTER TABLE works DROP COLUMN legacy_lyrics',
    'CREATE TABLE x (a int)', 'TRUNCATE works', 'GRANT ALL ON works TO public', 'REVOKE ALL ON works FROM public', 'LOCK TABLE works', 'SET ROLE postgres',
    'BEGIN', 'COMMIT', 'COPY works TO STDOUT', 'DO $$ BEGIN END $$', 'VACUUM works', 'WITH x AS (DELETE FROM works RETURNING 1) SELECT 1',
    'SELECT 1; DROP TABLE works', 'SELECT 1 -- hidden', 'SELECT 1 /* c */', 'SELECT * INTO backup FROM works', 'SELECT * FROM works FOR UPDATE',
    'SELECT nextval(\'s\')', 'SELECT pg_terminate_backend(1)', 'SELECT pg_advisory_lock(1)', '', '   ', 'EXPLAIN ANALYZE DELETE FROM works',
  ];
  for (const sql of bad) assert.throws(() => assertSelectOnly(sql), /refused/, sql);
});

test('makeReadOnlyQuery never reaches the driver for a non-SELECT', async () => {
  let reached = 0;
  const q = makeReadOnlyQuery(async () => { reached += 1; return []; });
  await q('SELECT 1');
  await assert.rejects(q('DROP TABLE works'), /refused/);
  await assert.rejects(q('UPDATE works SET title = $1', ['x']), /refused/);
  assert.equal(reached, 1);
});

test('the tool source has exactly two doors to client.query: the read-only session check and the guarded wrapper', () => {
  const src = readFileSync(path.join(repoRoot, 'scripts/legacy-drop-preflight.mjs'), 'utf8');
  const calls = src.split('\n').filter((l) => /client\.query\(/.test(l) && !l.trim().startsWith('*') && !l.trim().startsWith('//'));
  assert.equal(calls.length, 2, calls.join('\n'));
  assert.ok(calls.some((l) => l.includes('transaction_read_only')));
  assert.ok(calls.some((l) => l.includes('makeReadOnlyQuery') || l.includes('(await client.query(sql, params)).rows')));
  assert.doesNotMatch(src, /process\.env\[?\.?['"]?LEGACY_DROP_CONFIRM['"]?\]?\s*=[^=]/, 'the tool must never assign the drop token');
});

// ---------------------------------------------------------------- credentials, targets, tokens

test('redact removes the URL, user and password from any message', () => {
  const msg = redact(`connect ECONNREFUSED ${URL_WITH_SECRET} (password s3cr3t-pass, user musicos360)`, URL_WITH_SECRET);
  assert.doesNotMatch(msg, /s3cr3t-pass|musicos360|postgresql:\/\/musicos360/);
  assert.match(redact('failed postgres://u:p@h/db now', undefined), /postgresql:\/\/\*\*\*/);
});

test('assertSafeTarget: token present, label/host mismatch are refused', () => {
  assert.throws(() => assertSafeTarget({ env: 'disposable', databaseUrl: URL_WITH_SECRET, processEnv: { LEGACY_DROP_CONFIRM: 'anything' } }), SafetyError);
  assert.throws(() => assertSafeTarget({ env: 'disposable', databaseUrl: URL_WITH_SECRET, processEnv: { LEGACY_DROP_CONFIRM: '' } }), SafetyError);
  assert.throws(() => assertSafeTarget({ env: 'disposable', databaseUrl: 'postgresql://u@db.example.com:5432/x', processEnv: {} }), /local database/);
  for (const env of ['dev', 'staging', 'production']) {
    assert.throws(() => assertSafeTarget({ env, databaseUrl: URL_WITH_SECRET, processEnv: {} }), /cannot be labelled/);
    assertSafeTarget({ env, databaseUrl: 'postgresql://u@db.example.com:5432/x', processEnv: {} });
  }
  assertSafeTarget({ env: 'disposable', databaseUrl: URL_WITH_SECRET, processEnv: {} });
  assert.equal(hostClass(URL_WITH_SECRET).local, true);
});

test('parseArgs requires an explicit valid --env', () => {
  assert.throws(() => parseArgs([]), UsageError);
  assert.throws(() => parseArgs(['--env', 'prod']), UsageError);
  assert.throws(() => parseArgs(['--env']), UsageError);
  assert.throws(() => parseArgs(['--env', 'dev', '--bogus']), UsageError);
  assert.throws(() => parseArgs(['--env', 'dev', '--pitr-id', 'a b; drop']), UsageError);
  assert.equal(parseArgs(['--env', 'staging', '--no-db']).env, 'staging');
});

test('run refuses without DATABASE_URL unless --no-db is explicit, and refuses when LEGACY_DROP_CONFIRM is set', async () => {
  await assert.rejects(run(['--env', 'dev'], {}), UsageError);
  await assert.rejects(run(['--env', 'dev', '--no-db'], { LEGACY_DROP_CONFIRM: 'drop-legacy-columns-gates-satisfied' }), SafetyError);
  await assert.rejects(run(['--env', 'production'], { DATABASE_URL: URL_WITH_SECRET }), SafetyError);
});

test('a failing connection never leaks the credentials', async () => {
  const openClient = async () => { throw new Error(`connect failed for ${URL_WITH_SECRET}`); };
  await assert.rejects(run(['--env', 'disposable'], { DATABASE_URL: URL_WITH_SECRET }, { openClient }), (e) => !/s3cr3t-pass/.test(e.message) && /cannot connect/.test(e.message));
});

// ---------------------------------------------------------------- draft parsing

test('parsePlans reads every generic draft: tables, physical types and the drafts own checks', () => {
  const expected = { '40': [1, 5, 5], '41': [1, 5, 4], '42': [1, 4, 2], '43': [1, 1, 1], '44': [1, 1, 1], '45': [3, 6, 6], '49': [1, 1, 2], '53': [1, 3, 0] };
  for (const g of GROUPS.filter((x) => !x.kind)) {
    const plans = parsePlans(readFileSync(path.join(repoRoot, 'apps/api/src/database/migration-drafts', g.file), 'utf8'));
    const [tables, cols, checks] = expected[g.short];
    assert.equal(plans.length, tables, g.short);
    assert.equal(plans.reduce((a, p) => a + p.columns.length, 0), cols, g.short);
    assert.equal(plans.reduce((a, p) => a + p.checks.length, 0), checks, g.short);
  }
  const clients = parsePlans(readFileSync(path.join(repoRoot, 'apps/api/src/database/migration-drafts/20260930000043_DropClientsLegacyContactStatus.ts'), 'utf8'))[0];
  assert.equal(clients.checks[0].where, `"legacy_contact_status" IS NOT NULL AND ("status" IS NULL OR "status" = '')`);
  assert.ok(clients.checks[0].informational);
  const pii = parsePlans(readFileSync(path.join(repoRoot, 'apps/api/src/database/migration-drafts/20260930000053_DropEmployeesLegacyPiiColumns.ts'), 'utf8'))[0];
  assert.equal(pii.archiveTable, 'employees_pii_legacy_archive_20260930');
  assert.throws(() => parsePlans('export const PLANS = [];\nexport class X {}'), /could not parse/);
});

test('hand-written plans (46, 48) fail visible when the draft drifts', () => {
  assert.throws(() => assertDraftMatches('nothing here', ['"data" IS DISTINCT FROM "starts_at"'], 'x.ts'), /drifted/);
  for (const g of GROUPS.filter((x) => x.kind)) loadGroup(repoRoot, g); // real drafts still match
});

test('item 1: exact sha256 of each draft and registered=false (never in the runner)', () => {
  for (const g of GROUPS) {
    const loaded = loadGroup(repoRoot, g);
    const real = createHash('sha256').update(readFileSync(path.join(repoRoot, loaded.rel))).digest('hex');
    assert.equal(loaded.sha256, real);
    assert.equal(isRegistered(repoRoot, loaded).registered, false, g.short);
  }
});

// ---------------------------------------------------------------- static scan (items 4/5)

function fixtureRepo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ldp-'));
  for (const [rel, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); }
  return dir;
}

test('scan: finds file:line hits, classifies writers, honours the narrow allowlist, never matches a longer identifier', () => {
  const dir = fixtureRepo({
    'apps/api/src/modules/a/a.service.ts': 'const a = 1;\nawait q(`INSERT INTO works (legacy_lyrics) VALUES ($1)`);\nconst b = row.legacy_lyrics;\nconst c = legacy_lyrics_extra;\n',
    'apps/api/src/database/migration-drafts/x.ts': 'legacy_lyrics\n',
    'apps/api/src/database/migrations/old.ts': 'legacy_lyrics\n',
    'docs/x.md': 'legacy_lyrics\n',
    'apps/api/node_modules/p/i.ts': 'legacy_lyrics\n',
  });
  try {
    const { hits, allowlisted } = scanIdentifiers(dir, ['legacy_lyrics']);
    assert.deepEqual(hits.map((h) => `${h.file}:${h.line}:${h.kind}`), ['apps/api/src/modules/a/a.service.ts:2:PRODUCER', 'apps/api/src/modules/a/a.service.ts:3:CONSUMER']);
    assert.equal(allowlisted.length, 2);
    assert.ok(allowlisted.every((h) => h.allowlist_reason));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scan: ambiguous names (rg, birth_date, address, data) need the group table context', () => {
  const dir = fixtureRepo({
    'apps/api/src/modules/artists/artist.ts': 'const x = { rg: "1", birth_date: "2", address: "3" };\n',
    'apps/api/src/modules/hr/emp.ts': 'await q(`SELECT id\n  FROM employees\n  WHERE rg = $1`);\n',
    'apps/api/src/modules/events/ev.ts': 'const r = await http.get(); use(res.data);\nawait q(`SELECT starts_at FROM events ORDER BY "data" ASC`);\n',
  });
  try {
    const rg = scanIdentifiers(dir, ['rg', 'birth_date', 'address']).hits;
    assert.deepEqual(rg.map((h) => `${h.file}:${h.line}`), ['apps/api/src/modules/hr/emp.ts:3']);
    const data = scanIdentifiers(dir, ['data']).hits;
    assert.deepEqual(data.map((h) => `${h.file}:${h.line}`), ['apps/api/src/modules/events/ev.ts:2']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the allowlist is narrow: every entry has a reason and none covers a whole source tree of the product', () => {
  for (const a of ALLOWLIST) {
    assert.ok(a.reason.length > 10);
    assert.ok(!['apps/', 'packages/', 'e2e/', 'scripts/', 'apps/api/src/'].includes(a.prefix));
  }
});

// ---------------------------------------------------------------- full report, no database

test('run --no-db: 10 groups x 15 items, database items NOT_MEASURED, inputs absent = NOT_PROVIDED/NOT_DEFINED, never READY', async () => {
  let opened = 0;
  const out = await run(['--env', 'dev', '--no-db'], {}, { openClient: async () => { opened += 1; throw new Error('must not connect'); } });
  assert.equal(opened, 0);
  assert.equal(out.read_only, true);
  assert.equal(out.database.supplied, false);
  assert.equal(out.groups.length, 10);
  for (const g of out.groups) {
    assert.deepEqual(Object.keys(g.evidence).map(Number), Array.from({ length: 15 }, (_, i) => i + 1));
    assert.equal(g.evidence[1].registered, false);
    assert.match(g.evidence[1].sha256, /^[0-9a-f]{64}$/);
    for (const n of [2, 6, 8]) assert.equal(g.evidence[n].status, 'NOT_MEASURED', `${g.short} item ${n}`);
    assert.equal(g.evidence[7].status, 'NOT_MEASURED');
    assert.equal(g.evidence[9].status, 'NOT_APPLICABLE');
    assert.equal(g.evidence[10].status, 'NOT_PROVIDED');
    assert.equal(g.evidence[12].status, 'NOT_PROVIDED');
    assert.equal(g.evidence[12].satisfied, false);
    assert.equal(g.ready_for_destructive_execution, false);
    assert.ok(g.blockers.length > 0);
    assert.ok(g.evidence[15].items.length >= 11);
  }
  const pii = out.groups.filter((g) => ['43', '45', '53'].includes(g.group));
  assert.equal(pii.length, 3);
  for (const g of pii) assert.equal(g.evidence[14].status, 'NOT_DEFINED');
  for (const g of out.groups.filter((x) => !['43', '45', '53'].includes(x.group))) assert.equal(g.evidence[14].status, 'NOT_APPLICABLE');
  assert.equal(out.groups.find((g) => g.group === '48').destructive, false);
});

test('run: static scan outcome is real: invoices drafts report hits (NO), the others report 0 (YES)', async () => {
  const out = await run(['--env', 'dev', '--no-db'], {});
  const by = Object.fromEntries(out.groups.map((g) => [g.group, g]));
  for (const k of ['49', '48']) {
    assert.equal(by[k].evidence[4].status === 'NO' || by[k].evidence[5].status === 'NO', true, k);
    for (const h of [...by[k].evidence[4].locations, ...by[k].evidence[5].locations]) { assert.match(h.file, /\.(ts|tsx)$/); assert.ok(h.line > 0); }
  }
  assert.equal(by['49'].evidence[5].status, 'NO');
  for (const k of ['40', '41', '42', '43', '44', '45', '46', '53']) {
    assert.equal(by[k].evidence[4].hits + by[k].evidence[5].hits, 0, `${k} ${JSON.stringify([...by[k].evidence[4].locations, ...by[k].evidence[5].locations])}`);
  }
});

test('inputs: --pitr-id and --retention-ref are carried, unverified; a staging label with them is STILL not ready (owner authorization is human)', async () => {
  const out = await run(['--env', 'staging', '--no-db', '--pitr-id', 'pitr-2026-10-03T10:00Z', '--retention-ref', '45=HR-RET-2026-01', '--retention-ref', 'RET-GLOBAL'], {});
  const by = Object.fromEntries(out.groups.map((g) => [g.group, g]));
  assert.equal(by['45'].evidence[14].reference, 'HR-RET-2026-01');
  assert.equal(by['53'].evidence[14].reference, 'RET-GLOBAL');
  assert.equal(by['43'].evidence[14].status, 'PROVIDED_UNVERIFIED');
  assert.equal(by['40'].evidence[12].status, 'PROVIDED_UNVERIFIED');
  for (const g of out.groups) {
    assert.equal(g.ready_for_destructive_execution, false);
    assert.ok(g.evidence[15].items.some((p) => /Owner authorization/.test(p.item) && p.status === 'NOT_SATISFIED'));
  }
  assert.equal(retentionFor(['45=A', 'B'], GROUPS.find((g) => g.short === '45')), 'A');
  assert.equal(retentionFor(['45=A'], GROUPS.find((g) => g.short === '53')), null);
});

test('selectGroups accepts short ids and timestamps and rejects unknown groups', () => {
  assert.deepEqual(selectGroups('40,20260930000053').map((g) => g.short), ['40', '53']);
  assert.throws(() => selectGroups('47'), /unknown group/);
});

// ---------------------------------------------------------------- full report, injected database

function fakeClient(log, { rowsHolding = 2, divergence = 0, archive = false } = {}) {
  const sqlTypeOf = (t) => {
    const m = /^varchar\((\d+)\)$/.exec(t); if (m) return { data_type: 'character varying', character_maximum_length: Number(m[1]) };
    const n = /^numeric\((\d+),(\d+)\)$/.exec(t); if (n) return { data_type: 'numeric', numeric_precision: Number(n[1]), numeric_scale: Number(n[2]) };
    return { data_type: t === 'timestamp' ? 'timestamp without time zone' : t };
  };
  const typesByCol = {};
  for (const g of GROUPS) for (const p of loadGroup(repoRoot, g).plans) for (const c of p.columns) typesByCol[`${p.table}.${c.name}`] = c.type;
  return {
    async query(sql, params = []) { return { rows: await this.rows(sql, params) }; },
    async rows(sql, params = []) {
      log.push(sql);
      assertSelectOnly(sql);
      if (sql.includes('information_schema.columns') && sql.includes('ANY($2')) {
        return params[1].map((name) => ({ column_name: name, is_nullable: 'YES', character_maximum_length: null, numeric_precision: null, numeric_scale: null, ...sqlTypeOf(typesByCol[`${params[0]}.${name}`]) }));
      }
      if (sql.includes('relrowsecurity')) return [{ rls: true, forced: true }];
      if (sql.includes("column_name = 'tenant_id'")) return [{ ok: 1 }];
      if (sql.includes('to_regclass(\'public.\' || $1)')) return [{ ok: archive ? true : !String(params[0]).includes('_legacy_archive_') }];
      if (sql.includes('count(*)::int AS total')) {
        const cols = [...sql.matchAll(/AS c(\d+)/g)].length;
        return [{ total: 10, rows_any: rowsHolding, tenants: 1, ...Object.fromEntries(Array.from({ length: cols }, (_, i) => [`c${i}`, rowsHolding])) }];
      }
      if (sql.includes('FROM pg_depend')) return [];
      if (sql.includes('(SELECT 1 FROM "clients"')) return [{ n: 3 }];
      if (sql.includes('idx_events_tenant_starts_at')) return [{ ok: true }];
      if (sql.includes('pg_trigger')) return [{ n: 1 }];
      if (sql.includes('to_regprocedure')) return [{ ok: true }];
      if (sql.includes('role_table_grants')) return [{ n: 0 }];
      if (sql.startsWith('SELECT count(*)::int AS n FROM')) return [{ n: sql.includes('_legacy_archive_') ? rowsHolding : divergence }];
      throw new Error(`unexpected query in test: ${sql.slice(0, 80)}`);
    },
    async end() {},
  };
}

test('with a database: counts only, columns verified against information_schema, SELECT-only, no credentials in the output', async () => {
  const log = [];
  const out = await run(['--env', 'disposable'], { DATABASE_URL: URL_WITH_SECRET }, { openClient: async () => fakeClient(log) });
  assert.ok(log.length > 50);
  for (const sql of log) assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i);
  const json = JSON.stringify(out);
  assert.doesNotMatch(json, /s3cr3t-pass|musicos360:/);
  assert.equal(out.database.credentials, 'redacted');
  assert.equal(out.database.read_only_session, true);
  const by = Object.fromEntries(out.groups.map((g) => [g.group, g]));
  for (const g of out.groups) {
    assert.equal(g.evidence[2].status, 'VERIFIED', g.group);
    assert.equal(g.evidence[6].status, 'MEASURED');
    assert.equal(g.evidence[7].status, 'ZERO');
    assert.equal(g.evidence[8].status, 'MEASURED');
    assert.equal(g.ready_for_destructive_execution, false);
    assert.ok(g.blockers.some((b) => b.startsWith('ENVIRONMENT_NOT_REAL')));
  }
  assert.equal(by['45'].evidence[8].rows_holding_legacy_values, 6); // employees + payroll_entries + leave_requests
  assert.equal(by['43'].evidence[6].clients_pair_census.distinct_legacy_status_pairs, 3);
  assert.equal(by['43'].evidence[6].clients_pair_census.owner_signoff, 'NOT_PROVIDED');
  assert.equal(by['46'].evidence[6].events_objects.trigger_trg_events_sync_start_columns, 1);
  assert.equal(by['53'].evidence[3].satisfied, false); // no canonical counterpart
  assert.equal(by['53'].evidence[7].declared_checks.length, 0);
  assert.match(by['53'].evidence[7].note, /NO machine check/);
});

test('divergences are reported with the drafts own predicates and block the group', async () => {
  const out = await run(['--env', 'disposable', '--group', '40'], { DATABASE_URL: URL_WITH_SECRET }, { openClient: async () => fakeClient([], { divergence: 4 }) });
  const e = out.groups[0].evidence[7];
  assert.equal(e.status, 'DIVERGENT');
  assert.equal(e.blocking_total, 20);
  assert.equal(e.checks.length, 5);
  assert.ok(out.groups[0].blockers.some((b) => b.startsWith('7 ')));
});

test('item 9: when an archive exists it is verified (rows, RLS forced, grants revoked); a mismatch FAILS', async () => {
  const ok = await run(['--env', 'disposable', '--group', '44'], { DATABASE_URL: URL_WITH_SECRET }, { openClient: async () => fakeClient([], { archive: true }) });
  assert.equal(ok.groups[0].evidence[9].status, 'PASS');
  assert.equal(ok.groups[0].evidence[9].per_table[0].rls_forced, true);
  const bad = fakeClient([], { archive: true });
  const originalRows = bad.rows.bind(bad);
  bad.rows = async (sql, params) => (sql.includes('role_table_grants') ? [{ n: 2 }] : originalRows(sql, params));
  const fail = await run(['--env', 'disposable', '--group', '44'], { DATABASE_URL: URL_WITH_SECRET }, { openClient: async () => bad });
  assert.equal(fail.groups[0].evidence[9].status, 'FAIL');
});

test('a read-only session that is not read-only is refused (SafetyError)', async () => {
  const openClient = async () => { throw new SafetyError('the session is not read-only'); };
  await assert.rejects(run(['--env', 'disposable'], { DATABASE_URL: URL_WITH_SECRET }, { openClient }), SafetyError);
});

// ---------------------------------------------------------------- rehearsal + checklist

test('rehearsal report: matches the draft sha256 or it is STALE; a missing entry is NOT_PROVIDED; passing is disposable-only', () => {
  const loaded = loadGroup(repoRoot, GROUPS[0]);
  const entry = { migration_file: loaded.group.file, sha256: loaded.sha256, up_down_up: true, values_equal_by_id_after_down: true, archive_kept_after_down: true, archive_rows: 1 };
  assert.equal(validateRehearsal(null, loaded).status, 'NOT_PROVIDED');
  assert.equal(validateRehearsal({ environment: 'disposable-rehearsal', drafts: {} }, loaded).status, 'NOT_PROVIDED');
  assert.equal(validateRehearsal({ environment: 'disposable-rehearsal', drafts: { [loaded.group.id]: { ...entry, sha256: 'deadbeef' } } }, loaded).status, 'STALE');
  assert.equal(validateRehearsal({ environment: 'disposable-rehearsal', drafts: { [loaded.group.id]: { ...entry, values_equal_by_id_after_down: false } } }, loaded).status, 'FAIL');
  const pass = validateRehearsal({ environment: 'disposable-rehearsal', drafts: { [loaded.group.id]: entry } }, loaded);
  assert.equal(pass.status, 'PASS');
  assert.equal(pass.rehearsal_environment, 'disposable-rehearsal');
});

test('run with a rehearsal report: item 10 PASS, item 11 PASS_DISPOSABLE_ONLY and not satisfied', async () => {
  const dir = fixtureRepo({});
  try {
    const loaded = loadGroup(repoRoot, GROUPS.find((g) => g.short === '44'));
    const file = path.join(dir, 'r.json');
    writeFileSync(file, JSON.stringify({ environment: 'disposable-rehearsal', drafts: { [loaded.group.id]: { sha256: loaded.sha256, up_down_up: true, values_equal_by_id_after_down: true, archive_kept_after_down: true, archive_rows: 1 } } }));
    const out = await run(['--env', 'dev', '--no-db', '--group', '44', '--rehearsal-report', file], {});
    assert.equal(out.groups[0].evidence[10].status, 'PASS');
    assert.equal(out.groups[0].evidence[10].satisfied, true);
    assert.equal(out.groups[0].evidence[11].status, 'PASS_DISPOSABLE_ONLY');
    assert.equal(out.groups[0].evidence[11].satisfied, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('item 15: the checklist is parsed from section 8 of the plan and every external item is NOT_SATISFIED here', () => {
  const items = parseChecklist(readFileSync(path.join(repoRoot, 'docs/engineering/legacy-column-drop-plan.md'), 'utf8'));
  assert.ok(items.length >= 11);
  assert.ok(items.some((i) => /Staging rehearsal/.test(i)) && items.some((i) => /Backup \/ PITR/.test(i)) && items.some((i) => /LEGACY_DROP_CONFIRM/.test(i)));
  const group = GROUPS.find((g) => g.short === '43');
  const res = evaluateChecklist(items, { env: 'disposable', group, measured: true, divergenceMeasured: true, divergenceTotal: 0, staticHits: 0, retentionRef: null, pitrId: null });
  assert.equal(res.length, items.length);
  assert.ok(res.every((r) => r.status === 'NOT_SATISFIED'), JSON.stringify(res.filter((r) => r.status !== 'NOT_SATISFIED')));
  assert.ok(res.every((r) => r.reason.length > 10));
  // unknown checklist line fails closed
  assert.equal(evaluateChecklist(['A brand new gate'], { env: 'dev', group, measured: true, divergenceMeasured: true, divergenceTotal: 0, staticHits: 0 })[0].status, 'NOT_SATISFIED');
});
