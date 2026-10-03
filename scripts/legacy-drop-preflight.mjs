#!/usr/bin/env node
/**
 * scripts/legacy-drop-preflight.mjs
 *
 * READ-ONLY pre-flight of the legacy column drop drafts (docs/engineering/legacy-column-drop-plan.md, LC1).
 * For every draft group it emits JSON with the 15 evidence items the owner requires before any destructive step.
 *
 * Guarantees (each one pinned by scripts/legacy-drop-preflight.test.mjs):
 *   - SELECT only: every statement is checked by assertSelectOnly (single statement, SELECT, no write/DDL/lock keyword
 *     outside string literals) AND the session is opened read-only (default_transaction_read_only=on, verified with
 *     current_setting('transaction_read_only') before the first measurement). Nothing here can drop, alter or write.
 *   - `--env <dev|staging|production|disposable>` is mandatory. DATABASE_URL is mandatory unless `--no-db` is passed
 *     explicitly (then every database measurement is reported NOT_MEASURED, never invented).
 *   - `--env disposable` only accepts a local host (127.0.0.1 / localhost / ::1); a local host is refused for
 *     dev/staging/production (a local database must never be labelled as a real environment).
 *   - LEGACY_DROP_CONFIRM must NOT be present in the environment of this tool (exit 3): the drop token is never set in
 *     any script, CI job or shell that runs a pre-flight.
 *   - Credentials are never printed (the URL, user and password are redacted from every message); row values are never
 *     read or printed: counts and catalog object names only.
 *   - `--pitr-id`, `--retention-ref` and `--rehearsal-report` are inputs. Absent means NOT_PROVIDED / NOT_DEFINED, never invented.
 *   - READY_FOR_DESTRUCTIVE_EXECUTION is true only when the environment is a real one and all 15 items are satisfied;
 *     this tool authorizes nothing (an approval is a human decision recorded outside this tool).
 *
 * Usage:
 *   DATABASE_URL=postgresql://user@host:5432/db node scripts/legacy-drop-preflight.mjs --env disposable \
 *       [--group 40,41,...|all] [--pitr-id <id>] [--retention-ref <ref> | --retention-ref <group>=<ref>] \
 *       [--rehearsal-report <file.json>] [--pretty]
 *   node scripts/legacy-drop-preflight.mjs --env dev --no-db      (static items only)
 * Exit codes: 0 report emitted (read it: NO / NOT_SATISFIED are results, not errors), 2 usage error, 3 safety refusal.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENVIRONMENTS = ['dev', 'staging', 'production', 'disposable'];
export const CONFIRM_ENV = 'LEGACY_DROP_CONFIRM';
const DRAFTS_DIR = 'apps/api/src/database/migration-drafts';
const MIGRATIONS_DIR = 'apps/api/src/database/migrations';
const PLAN_DOC = 'docs/engineering/legacy-column-drop-plan.md';
const SCAN_ROOTS = ['apps', 'packages', 'e2e', 'scripts'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.git', '.next', '.vite']);

/** Draft files and the facts a source parse cannot know. `kind` drives how the plan is obtained. */
export const GROUPS = [
  { id: '20260930000040', short: '40', label: 'works', file: '20260930000040_DropWorksLegacyColumns.ts', pii: false,
    canonical: { legacy_language_label: 'language', legacy_instrumental_flag: 'is_instrumental', legacy_ai_used: 'ai_used', legacy_alternative_titles: 'alternative_titles', legacy_lyrics: 'lyrics' } },
  { id: '20260930000041', short: '41', label: 'phonograms', file: '20260930000041_DropPhonogramsLegacyColumns.ts', pii: false,
    canonical: { legacy_recording_date: 'recording_date', legacy_release_date: 'release_date', legacy_duration_minutes: 'duration_seconds', legacy_duration_seconds_part: 'duration_seconds', legacy_origin_country: 'country_of_recording' } },
  { id: '20260930000042', short: '42', label: 'transactions', file: '20260930000042_DropTransactionsLegacyColumns.ts', pii: false,
    canonical: { legacy_transaction_type: 'type', legacy_transaction_date: 'transaction_date', legacy_attachment_url: 'attachment_url', legacy_reference: 'notes' } },
  { id: '20260930000043', short: '43', label: 'clients', file: '20260930000043_DropClientsLegacyContactStatus.ts', pii: true,
    canonical: { legacy_contact_status: 'status (UNPROVEN: owner-signed (legacy, status) pair census is the gate)' } },
  { id: '20260930000044', short: '44', label: 'shares', file: '20260930000044_DropSharesLegacyArtistProjectId.ts', pii: false,
    canonical: { legacy_artist_project_id: 'artist_id' } },
  { id: '20260930000045', short: '45', label: 'hr-mirrors', file: '20260930000045_DropHrLegacyMirrors.ts', pii: true,
    canonical: { legacy_full_name: 'name', legacy_sector: 'department', legacy_base_salary: 'salary', legacy_employee_id: 'employee_id', legacy_reference_month: 'reference_month' } },
  { id: '20260930000046', short: '46', label: 'events-data', file: '20260930000046_DropEventsDataAndSyncTrigger.ts', pii: false, kind: 'events',
    canonical: { data: 'starts_at' } },
  { id: '20260930000048', short: '48', label: 'invoices-relax-not-null', file: '20260930000048_RelaxInvoicesLegacyAmountNotNull.ts', pii: false, kind: 'relax', nonDestructive: true,
    canonical: { legacy_amount: 'service_amount' } },
  { id: '20260930000049', short: '49', label: 'invoices-legacy-amount', file: '20260930000049_DropInvoicesLegacyAmount.ts', pii: false,
    canonical: { legacy_amount: 'service_amount' } },
  { id: '20260930000053', short: '53', label: 'employees-pii', file: '20260930000053_DropEmployeesLegacyPiiColumns.ts', pii: true,
    canonical: { rg: 'NONE (no canonical counterpart: the values exist only here)', birth_date: 'NONE', address: 'NONE' } },
];

/** Plans of the two drafts that do not use the generic base (kept in sync with the draft text: see assertDraftMatches). */
const EVENTS_PLAN = [{
  table: 'events',
  archiveTable: null,
  columns: [{ name: 'data', type: 'timestamp' }],
  checks: [
    { label: 'data_differs_from_starts_at', where: '"data" IS DISTINCT FROM "starts_at"' },
    { label: 'starts_at_null', where: '"starts_at" IS NULL' },
  ],
  extraDraftFragments: ['"data" IS DISTINCT FROM "starts_at"', '"starts_at" IS NULL', 'idx_events_tenant_starts_at', 'trg_events_sync_start_columns', 'sync_events_start_columns'],
}];
const RELAX_PLAN = [{
  table: 'invoices',
  archiveTable: null,
  columns: [{ name: 'legacy_amount', type: 'numeric(15,2)' }],
  checks: [{ label: 'legacy_amount_without_service_amount', where: '"legacy_amount" IS NOT NULL AND "service_amount" IS NULL' }],
  extraDraftFragments: ['"legacy_amount" IS NOT NULL AND "service_amount" IS NULL', 'ALTER COLUMN "legacy_amount" DROP NOT NULL'],
}];

/**
 * Entity-free allowlist: files that legitimately still name a legacy column although no producer or consumer is left.
 * Each entry is narrow (exact path or directory) and carries its reason; the hits found there are REPORTED
 * (`allowlisted_hits`) but do not count toward items 4/5.
 */
export const ALLOWLIST = [
  { prefix: `${DRAFTS_DIR}/`, reason: 'the drafts themselves and their specs' },
  { prefix: `${MIGRATIONS_DIR}/`, reason: 'applied historical migrations (immutable text)' },
  { prefix: 'apps/api/test/e2e/schema/legacy-column-drop-drafts.e2e-spec.ts', reason: 'disposable rehearsal spec of the drafts' },
  { prefix: 'apps/api/scripts/verify-canonical-column-order.ts', reason: 'physical column list of the live schema; the line edit ships WITH the drop (plan section 2)' },
  { prefix: 'apps/api/src/database/client-entity-schema-alignment.spec.ts', reason: 'parses migration text; filters the dropped column through DROPPED_ENTITY_COLUMNS (plan section 2, clients)' },
  { prefix: 'apps/api/src/database/backfill-canonical-from-legacy-mirrors.migration.spec.ts', reason: 'spec of the applied backfill migration 20260930000022 (historical text)' },
  { prefix: 'apps/api/src/modules/shares/share-legacy-fields.ts', reason: 'comment only: the entity declares no such field (entity-free)' },
  { prefix: 'apps/api/src/modules/shares/share-contract.spec.ts', reason: 'negative assertion: the row must NOT expose the legacy field' },
  { prefix: 'apps/api/src/database/events-data-legacy-column.spec.ts', reason: 'pins that the entity declares no `data` column and that the sync trigger exists; its trigger assertions are deleted together with the trigger (plan section 2, events)' },
  { prefix: 'apps/api/src/database/add-events-starts-at.migration.spec.ts', reason: 'spec of the applied migration adding starts_at (historical text, plan section 2: "still true")' },
  { prefix: 'apps/api/src/database/rebuild-events-canonical-form-order.migration.spec.ts', reason: 'spec of the applied events rebuild migration (historical text)' },
  { prefix: 'scripts/legacy-drop-preflight.mjs', reason: 'this tool (column definitions)' },
  { prefix: 'scripts/legacy-drop-preflight.test.mjs', reason: 'this tool (tests)' },
];

// ---------------------------------------------------------------------------------------------------------------------
// safety primitives
// ---------------------------------------------------------------------------------------------------------------------

const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|LOCK|SET|RESET|VACUUM|ANALYZE|REINDEX|CLUSTER|REFRESH|COMMENT|MERGE|EXECUTE|PREPARE|LISTEN|NOTIFY|SECURITY|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|INTO|NEXTVAL|SETVAL|LO_IMPORT|LO_EXPORT|PG_ADVISORY_LOCK|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND)\b/i;

/** Rejects anything that is not one plain SELECT. Literals and quoted identifiers are masked before the keyword scan. */
export function assertSelectOnly(sql) {
  if (typeof sql !== 'string' || sql.trim() === '') throw new Error('refused: empty statement');
  const masked = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
  const trimmed = masked.trim().replace(/;\s*$/, '');
  if (trimmed.includes(';')) throw new Error('refused: more than one statement');
  if (/--|\/\*/.test(masked)) throw new Error('refused: SQL comments are not allowed');
  if (!/^\(?\s*SELECT\b/i.test(trimmed)) throw new Error('refused: only SELECT statements are allowed');
  const bad = FORBIDDEN_KEYWORDS.exec(trimmed);
  if (bad) throw new Error(`refused: keyword ${bad[1].toUpperCase()} is not allowed in a read-only pre-flight`);
  return sql;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
export function quoteIdent(name) {
  if (!IDENT.test(name)) throw new Error(`refused: unsafe identifier ${JSON.stringify(name)}`);
  return `"${name}"`;
}

/** Removes the URL, the user and the password (and any `postgres://...` token) from a message. */
export function redact(text, databaseUrl) {
  let out = String(text);
  if (databaseUrl) {
    const secrets = new Set([databaseUrl]);
    try {
      const u = new URL(databaseUrl);
      if (u.password) { secrets.add(u.password); secrets.add(decodeURIComponent(u.password)); }
      if (u.username) { secrets.add(u.username); secrets.add(decodeURIComponent(u.username)); }
    } catch { /* not a URL: the generic scrub below still applies */ }
    for (const s of secrets) if (s && s.length >= 3) out = out.split(s).join('***');
  }
  return out.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://***');
}

export function hostClass(databaseUrl) {
  const u = new URL(databaseUrl);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  return { host, port: u.port || '5432', database: decodeURIComponent(u.pathname.replace(/^\//, '')), local: ['127.0.0.1', 'localhost', '::1'].includes(host) };
}

/** Throws a safety refusal (exit 3) when the environment label and the target do not agree, or the drop token is present. */
export function assertSafeTarget({ env, databaseUrl, processEnv }) {
  if (processEnv[CONFIRM_ENV] !== undefined) {
    throw new SafetyError(`${CONFIRM_ENV} is present in the environment of the pre-flight; it must never be set in any shell, script or CI job that runs a pre-flight (unset it and retry).`);
  }
  if (!databaseUrl) return;
  const { local } = hostClass(databaseUrl);
  if (env === 'disposable' && !local) throw new SafetyError('--env disposable accepts only a local database (127.0.0.1 / localhost).');
  if (env !== 'disposable' && local) throw new SafetyError(`a local database cannot be labelled --env ${env}; use --env disposable.`);
}

export class SafetyError extends Error {}
export class UsageError extends Error {}

// ---------------------------------------------------------------------------------------------------------------------
// draft parsing (the plans are read from the draft source, never duplicated)
// ---------------------------------------------------------------------------------------------------------------------

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function unescapeTsString(literal) {
  return literal.slice(1, -1).replace(/\\(['\\])/g, '$1');
}

/** Extracts the PLANS array (table, archiveTable, columns, checks) from a generic draft. */
export function parsePlans(source) {
  const start = source.indexOf('export const PLANS');
  if (start < 0) throw new Error('draft has no exported PLANS');
  const end = source.indexOf('\nexport class', start);
  const body = source.slice(start, end < 0 ? undefined : end);
  const chunks = body.split(/\n\s*table:\s*'/).slice(1);
  const plans = chunks.map((chunk) => {
    const table = /^(\w+)'/.exec(chunk)[1];
    const archiveTable = /archiveTable:\s*'(\w+)'/.exec(chunk)?.[1] ?? null;
    const columns = [...chunk.matchAll(/\{\s*name:\s*'(\w+)',\s*type:\s*'([^']+)'\s*\}/g)].map((m) => ({ name: m[1], type: m[2] }));
    const checks = [...chunk.matchAll(/\{\s*label:\s*'(\w+)',\s*where:\s*('(?:[^'\\]|\\.)*')(?:,\s*informational:\s*('(?:[^'\\]|\\.)*'))?/g)]
      .map((m) => ({ label: m[1], where: unescapeTsString(m[2]), informational: m[3] ? unescapeTsString(m[3]) : null }));
    return { table, archiveTable, columns, checks };
  });
  if (plans.length === 0 || plans.some((p) => p.columns.length === 0)) throw new Error('could not parse the draft plans (format drift): refusing to guess');
  return plans;
}

export function archiveNameOf(plan) {
  return plan.archiveTable ?? `${plan.table}_legacy_archive_20260930`;
}

/** The hand-written plans (46, 48) must still be what the draft says: fail visible on drift. */
export function assertDraftMatches(source, fragments, file) {
  const missing = fragments.filter((f) => !source.includes(f));
  if (missing.length > 0) throw new Error(`${file}: the pre-flight definition drifted from the draft (missing ${missing.length} fragment(s)); update the tool.`);
}

export function loadGroup(repoRoot, group) {
  const rel = `${DRAFTS_DIR}/${group.file}`;
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) throw new Error(`draft file missing: ${rel}`);
  const buf = readFileSync(abs);
  const source = buf.toString('utf8');
  let plans;
  if (group.kind === 'events') { assertDraftMatches(source, EVENTS_PLAN[0].extraDraftFragments, group.file); plans = EVENTS_PLAN; }
  else if (group.kind === 'relax') { assertDraftMatches(source, RELAX_PLAN[0].extraDraftFragments, group.file); plans = RELAX_PLAN; }
  else plans = parsePlans(source);
  const className = /export class (\w+)/.exec(source)?.[1] ?? null;
  return { group, rel, sha256: sha256(buf), source, className, plans };
}

/** registered = the class or the file is wired into the runner (index.ts) or already lives under migrations/. */
export function isRegistered(repoRoot, loaded) {
  const base = loaded.group.file.replace(/\.ts$/, '');
  const indexPath = path.join(repoRoot, MIGRATIONS_DIR, 'index.ts');
  const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const inIndex = index.includes(base) || (loaded.className !== null && index.includes(loaded.className));
  const migrationsDir = path.join(repoRoot, MIGRATIONS_DIR);
  const underMigrations = existsSync(migrationsDir) && readdirSync(migrationsDir).some((f) => f.startsWith(`${loaded.group.id}_`));
  return { registered: inIndex || underMigrations, in_index: inIndex, file_under_migrations: underMigrations };
}

// ---------------------------------------------------------------------------------------------------------------------
// static scan (items 4 and 5)
// ---------------------------------------------------------------------------------------------------------------------

const AMBIGUOUS = {
  // Columns whose name is also used by other tables (artists.rg, any `data`): a hit needs the group's table in the same line or the 6 lines above.
  rg: /\b(employees|employee|EmployeeEntity)\b/i,
  birth_date: /\b(employees|employee|EmployeeEntity)\b/i,
  address: /\b(employees|employee|EmployeeEntity)\b/i,
  data: /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+"?events"?\b|\bEventEntity\b|@Entity\(\s*'events'/i,
};
const WRITE_LINE = /\b(INSERT\s+INTO|UPDATE\b|SET\b|VALUES\b|\.set\(|\.save\(|\.create\(|\.update\(|\.insert\()|\b[a-z_]+\s*:\s*[^,;]+,?\s*$|\bpayload\[|\bEXCLUDED\b|=\s*EXCLUDED/i;
/** `data` is a column only in SQL/entity positions (quoted identifier, alias-qualified, or an SQL clause); `res.data` and `{ data }` object keys are not. */
const DATA_COLUMN_USAGE = /"data"|\b(?:e|ev|events)\.data\b|\b(?:SELECT|ORDER\s+BY|GROUP\s+BY|WHERE|AND|SET|INSERT\s+INTO\s+\w+)\b[^;\n]*(?<![.\w'"])data(?![\w'":])\s*(?:::|,|<|>|=|\)|IS\b|ASC\b|DESC\b|$)|^\s*(?:@Column\([^)]*\)\s*)?data!?\??\s*:\s*(?:Date|string|Date \| string)\b/i;

export function* walkFiles(root, rel = '') {
  const abs = path.join(root, rel);
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walkFiles(root, path.posix.join(rel, e.name)); }
    else if (e.isFile() && SCAN_EXTENSIONS.has(path.extname(e.name))) yield path.posix.join(rel, e.name);
  }
}

export function allowlistReason(relFile) {
  return ALLOWLIST.find((a) => relFile === a.prefix || (a.prefix.endsWith('/') && relFile.startsWith(a.prefix)))?.reason ?? null;
}

function lineHits(lines, identifier) {
  const word = new RegExp(`(?<![A-Za-z0-9_])${identifier}(?![A-Za-z0-9_])`);
  const ctx = AMBIGUOUS[identifier];
  const hits = [];
  lines.forEach((line, i) => {
    if (!word.test(line)) return;
    if (ctx) {
      if (identifier === 'data' && !DATA_COLUMN_USAGE.test(line)) return;
      const window = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
      if (!ctx.test(window)) return;
    }
    hits.push({ line: i + 1, kind: WRITE_LINE.test(line) ? 'PRODUCER' : 'CONSUMER' });
  });
  return hits;
}

/** Scans apps/ packages/ e2e/ scripts/ for each identifier. Returns hits (gating) and allowlisted hits (reported only). */
export function scanIdentifiers(repoRoot, identifiers, { roots = SCAN_ROOTS } = {}) {
  const hits = [];
  const allowlisted = [];
  const wanted = [...new Set(identifiers)];
  for (const root of roots) {
    for (const rel of walkFiles(repoRoot, root)) {
      let text;
      try { text = readFileSync(path.join(repoRoot, rel), 'utf8'); } catch { continue; }
      if (!wanted.some((id) => text.includes(id))) continue;
      const lines = text.split('\n');
      for (const id of wanted) {
        for (const h of lineHits(lines, id)) {
          const reason = allowlistReason(rel);
          const entry = { file: rel, line: h.line, identifier: id, kind: h.kind };
          if (reason) allowlisted.push({ ...entry, allowlist_reason: reason }); else hits.push(entry);
        }
      }
    }
  }
  const sort = (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.identifier.localeCompare(b.identifier);
  return { hits: hits.sort(sort), allowlisted: allowlisted.sort(sort) };
}

// ---------------------------------------------------------------------------------------------------------------------
// database measurements (counts only)
// ---------------------------------------------------------------------------------------------------------------------

export function typeLabelOf(row) {
  const t = row.data_type;
  if (t === 'character varying') return `varchar(${row.character_maximum_length})`;
  if (t === 'numeric') return row.numeric_precision == null ? 'numeric' : `numeric(${row.numeric_precision},${row.numeric_scale})`;
  if (t === 'timestamp without time zone') return 'timestamp';
  return t;
}

/** `query(sql, params)` is the ONLY door to the database and always goes through assertSelectOnly. */
export function makeReadOnlyQuery(rawQuery) {
  return async (sql, params = []) => { assertSelectOnly(sql); return rawQuery(sql, params); };
}

export async function measureGroup(query, loaded) {
  const out = { tables: [] };
  for (const plan of loaded.plans) {
    const names = plan.columns.map((c) => c.name);
    const cols = await query(
      `SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
      [plan.table, names],
    );
    const present = new Map(cols.map((r) => [r.column_name, r]));
    const tableRow = await query(`SELECT to_regclass('public.' || $1) IS NOT NULL AS ok`, [plan.table]);
    const t = {
      table: plan.table,
      table_exists: Boolean(tableRow[0]?.ok),
      columns: plan.columns.map((c) => {
        const row = present.get(c.name);
        if (!row) return { name: c.name, declared_type: c.type, present: false };
        const actual = typeLabelOf(row);
        return { name: c.name, declared_type: c.type, present: true, actual_type: actual, type_matches: actual === c.type, nullable: row.is_nullable === 'YES' };
      }),
    };
    t.all_present = t.columns.every((c) => c.present);
    t.none_present = t.columns.every((c) => !c.present);
    if (t.all_present) {
      const q = quoteIdent(plan.table);
      const anyLegacy = names.map((n) => `${quoteIdent(n)} IS NOT NULL`).join(' OR ');
      const perColumn = names.map((n, i) => `count(*) FILTER (WHERE ${quoteIdent(n)} IS NOT NULL)::int AS c${i}`).join(', ');
      const hasTenant = (await query(`SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`, [plan.table])).length > 0;
      const census = (await query(
        `SELECT count(*)::int AS total, ${perColumn}, count(*) FILTER (WHERE ${anyLegacy})::int AS rows_any${hasTenant ? `, count(DISTINCT "tenant_id") FILTER (WHERE ${anyLegacy})::int AS tenants` : ''} FROM ${q}`,
      ))[0];
      t.census = {
        rows_total: census.total,
        rows_holding_legacy_values: census.rows_any,
        tenants_affected: hasTenant ? census.tenants : null,
        per_column_non_null: Object.fromEntries(names.map((n, i) => [n, census[`c${i}`]])),
      };
      t.divergences = [];
      for (const chk of plan.checks) {
        const n = (await query(`SELECT count(*)::int AS n FROM ${q} WHERE ${chk.where}`))[0].n;
        t.divergences.push({ label: chk.label, rows: n, informational: chk.informational ?? null });
      }
      const dep = await query(
        `SELECT a.attname AS col, d.deptype AS deptype, pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent
         FROM pg_depend d JOIN pg_class c ON c.oid = d.refobjid AND c.relnamespace = 'public'::regnamespace
         JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
         WHERE d.refobjsubid > 0 AND d.deptype IN ('n', 'a') AND c.relname = $1 AND a.attname = ANY($2::text[]) AND d.classid <> 'pg_attrdef'::regclass
         ORDER BY 1, 3`,
        [plan.table, names],
      );
      t.catalog_dependents = dep.map((r) => ({ column: r.col, dependent: r.dependent }));
    }
    const archive = archiveNameOf(plan);
    if (!plan.archiveTable && loaded.group.kind) { t.archive = { table: null }; }
    else {
      const ex = (await query(`SELECT to_regclass('public.' || $1) IS NOT NULL AS ok`, [archive]))[0].ok;
      t.archive = { table: archive, exists: ex };
      if (ex) {
        t.archive.rows = (await query(`SELECT count(*)::int AS n FROM ${quoteIdent(archive)}`))[0].n;
        const rls = (await query(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forced FROM pg_class WHERE oid = to_regclass('public.' || $1)`, [archive]))[0];
        t.archive.rls_enabled = rls.rls; t.archive.rls_forced = rls.forced;
        t.archive.grants_to_app_roles = (await query(
          `SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = $1 AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'musicos_app')`, [archive],
        ))[0].n;
      }
    }
    out.tables.push(t);
  }
  if (loaded.group.kind === 'events') {
    out.events_objects = {
      replacement_index_idx_events_tenant_starts_at: (await query(`SELECT to_regclass('public.idx_events_tenant_starts_at') IS NOT NULL AS ok`))[0].ok,
      trigger_trg_events_sync_start_columns: (await query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'trg_events_sync_start_columns' AND NOT tgisinternal`))[0].n,
      function_sync_events_start_columns: (await query(`SELECT to_regprocedure('public.sync_events_start_columns()') IS NOT NULL AS ok`))[0].ok,
    };
  }
  if (loaded.group.id === '20260930000043' && out.tables[0]?.all_present) {
    out.clients_pair_census = {
      distinct_legacy_status_pairs: (await query(`SELECT count(*)::int AS n FROM (SELECT 1 FROM "clients" WHERE "legacy_contact_status" IS NOT NULL GROUP BY "legacy_contact_status", "status") s`))[0].n,
      owner_signoff: 'NOT_PROVIDED',
    };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// runbook prerequisites (item 15), parsed from section 8 of the plan
// ---------------------------------------------------------------------------------------------------------------------

export function parseChecklist(planText) {
  const start = planText.search(/^## 8\./m);
  if (start < 0) throw new Error('plan section 8 not found');
  const rest = planText.slice(start);
  const next = rest.slice(3).search(/^## /m);
  const section = next < 0 ? rest : rest.slice(0, next + 3);
  return section.split('\n').filter((l) => /^- \[[ xX]\] /.test(l)).map((l) => l.replace(/^- \[[ xX]\] /, '').trim());
}

const SATISFIED = 'SATISFIED';
const NOT_SATISFIED = 'NOT_SATISFIED';
const NOT_APPLICABLE = 'NOT_APPLICABLE';

/** One evaluator per checklist line; an unknown line is NOT_SATISFIED (fail closed). */
export function evaluateChecklist(items, ctx) {
  const real = ctx.env !== 'disposable';
  const measured = ctx.measured;
  const noDivergence = measured && ctx.divergenceTotal === 0 && ctx.divergenceMeasured;
  return items.map((text) => {
    const r = (status, reason) => ({ item: text, status, reason });
    if (/Owner authorization recorded/.test(text)) return r(NOT_SATISFIED, 'external, human: decision deci-ed83c974 (2026-10-03) approves preparation, censuses, verifications and rehearsals only; it grants no DROP authorization for any group or environment.');
    if (/Preflight 3\.0, 3\.1, 3\.2, 3\.3/.test(text)) {
      if (!real) return r(NOT_SATISFIED, 'measured only on a disposable database; a real environment census (dev/staging/production) was not run (no such database is reachable).');
      if (!measured) return r(NOT_SATISFIED, 'database census NOT_MEASURED for this environment.');
      if (!noDivergence) return r(NOT_SATISFIED, 'divergence counts are not all 0 (or not measured).');
      if (ctx.staticHits > 0) return r(NOT_SATISFIED, `static scan found ${ctx.staticHits} legacy producer/consumer hit(s) (plan 3.3).`);
      return r(SATISFIED, 'census measured on the real environment, every divergence 0, static scan 0 hits (3.2 pg_stat_statements evidence still has to be attached by the owner).');
    }
    if (/Clients only|HR only/.test(text)) {
      if (ctx.group.id === '20260930000043') return r(NOT_SATISFIED, 'the owner-signed (legacy_contact_status, status) pair census (3.4) is NOT_PROVIDED; the machine check is informational only.');
      if (ctx.group.pii) {
        if (ctx.retentionRef && real && measured) return r(SATISFIED, 'retention decision reference supplied (content not verified by this tool) and census measured.');
        return r(NOT_SATISFIED, ctx.retentionRef ? 'a retention reference was supplied but the census is not a real-environment measurement.' : 'HR/PII archive retention decision NOT_DEFINED (no --retention-ref).');
      }
      return r(NOT_APPLICABLE, 'no clients/HR PII in this group.');
    }
    if (/Release B0/.test(text)) return r(NOT_SATISFIED, `external: deployment of B0 in every environment cannot be proven from this repository${ctx.staticHits > 0 ? `; additionally ${ctx.staticHits} producer/consumer hit(s) remain in code` : ' (static scan: 0 hits)'}.`);
    if (/Staging rehearsal/.test(text)) return r(NOT_SATISFIED, 'only a disposable-rehearsal exists; a rehearsal on a fresh restore of production data was never run.');
    if (/Backup \/ PITR/.test(text)) {
      if (ctx.pitrId && real) return r(SATISFIED, 'PITR id supplied for this environment (existence of the restore point is NOT verified by this tool).');
      return r(NOT_SATISFIED, ctx.pitrId ? 'a PITR id was supplied but the target is a disposable database, not a real environment.' : 'PITR/backup point id NOT_PROVIDED (never invented).');
    }
    if (/Previous releases \(A\)/.test(text)) return r(NOT_SATISFIED, 'external: deployment of release A in every environment cannot be proven from this repository.');
    if (/moved from `migration-drafts\/`/.test(text)) return r(NOT_SATISFIED, 'the draft is deliberately unregistered and under migration-drafts/ (this is the executing release step, not done).');
    if (/LEGACY_DROP_CONFIRM=/.test(text)) return r(NOT_SATISFIED, 'the token is never set outside the single executing deploy job; this tool refuses to run when it is present and never sets it.');
    if (/One destructive migration per deploy/.test(text)) return r(NOT_SATISFIED, 'deploy-time commitment (single migration per deploy, rollback owner on call): no deploy exists.');
    if (/After the deploy:/.test(text)) return r(NOT_SATISFIED, 'post-deploy step; no deploy happened.');
    return r(NOT_SATISFIED, 'no automated evaluator for this checklist line (fail closed).');
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// per-group report (the 15 evidence items)
// ---------------------------------------------------------------------------------------------------------------------

export function validateRehearsal(report, loaded) {
  if (!report) return { status: 'NOT_PROVIDED', satisfied: false, reason: 'no --rehearsal-report: run the disposable rehearsal spec (LEGACY_DROP_REHEARSAL_REPORT=<file>) and pass the file.' };
  const entry = report.drafts?.[loaded.group.id];
  if (!entry) return { status: 'NOT_PROVIDED', satisfied: false, reason: `the report has no entry for ${loaded.group.id} (the rehearsal of this draft did not pass).` };
  if (entry.sha256 !== loaded.sha256) return { status: 'STALE', satisfied: false, reason: 'the report was produced for a different draft content (sha256 mismatch): rerun the rehearsal.' };
  const ok = entry.up_down_up === true && entry.values_equal_by_id_after_down !== false && entry.archive_kept_after_down !== false;
  return {
    status: ok ? 'PASS' : 'FAIL',
    satisfied: ok,
    reason: ok ? 'real up -> down -> up executed on a disposable COPY database; values equal by id after down(); archive not dropped by down().' : 'the rehearsal recorded a failure.',
    rehearsal_environment: report.environment ?? null,
    values_equal_by_id_after_down: entry.values_equal_by_id_after_down,
    archive_kept_after_down: entry.archive_kept_after_down,
    archive_rows: entry.archive_rows,
  };
}

export function buildGroupReport({ repoRoot, loaded, env, measure, dbSupplied, pitrId, retentionRef, rehearsalReport, checklist }) {
  const { group, plans } = loaded;
  const reg = isRegistered(repoRoot, loaded);
  const identifiers = plans.flatMap((p) => p.columns.map((c) => c.name));
  const scan = scanIdentifiers(repoRoot, identifiers);
  const producers = scan.hits.filter((h) => h.kind === 'PRODUCER');
  const consumers = scan.hits.filter((h) => h.kind === 'CONSUMER');
  const NM = 'NOT_MEASURED';
  const m = measure; // undefined when no DB
  const tables = m?.tables ?? [];
  const exists = (t) => t.table_exists;

  // (2) table and columns, verified against information_schema when a DB is given
  const columnsVerified = m
    ? (tables.every((t) => t.all_present && t.columns.every((c) => c.type_matches)) ? 'VERIFIED'
      : tables.every((t) => t.none_present || !exists(t)) ? 'ABSENT_ALREADY_DROPPED'
        : 'MISMATCH')
    : NM;

  // (6)/(8) census
  const censusStatus = !m ? NM : tables.every((t) => t.census) ? 'MEASURED' : 'NOT_MEASURED_COLUMNS_ABSENT';
  const rowsHolding = m && censusStatus === 'MEASURED' ? tables.reduce((a, t) => a + t.census.rows_holding_legacy_values, 0) : null;

  // (7) divergences
  const divergenceRows = m && censusStatus === 'MEASURED' ? tables.flatMap((t) => t.divergences.map((d) => ({ table: t.table, ...d }))) : null;
  const divergenceTotal = divergenceRows ? divergenceRows.filter((d) => !d.informational).reduce((a, d) => a + d.rows, 0) : null;
  const infoTotal = divergenceRows ? divergenceRows.filter((d) => d.informational).reduce((a, d) => a + d.rows, 0) : null;

  // (9) archive integrity, only meaningful after a drop (or after a rehearsal that left the archive behind)
  const archives = tables.map((t) => ({ plan_table: t.table, ...t.archive }));
  const hasArchiveTables = plans.some((p) => !(loaded.group.kind));
  let archiveItem;
  if (!hasArchiveTables) archiveItem = { status: NOT_APPLICABLE, satisfied: true, reason: group.kind === 'events' ? 'no archive by design: data == starts_at (trigger-enforced) is the proof; rollback rebuilds from starts_at.' : 'no drop: non-destructive precursor, nothing is archived.' };
  else if (!m) archiveItem = { status: NOT_APPLICABLE, satisfied: true, reason: 'before the drop (drafts unregistered, never executed in any environment by this tool); archive integrity is measured only when a database holding an archive is supplied.' };
  else if (archives.every((a) => !a.exists)) archiveItem = { status: NOT_APPLICABLE, satisfied: true, reason: 'before the drop: no archive table exists in the measured database.' };
  else {
    const per = archives.map((a, i) => {
      const t = tables[i];
      const counts = a.exists ? {
        archive_rows: a.rows,
        rows_holding_legacy_values_live: t.census ? t.census.rows_holding_legacy_values : null,
        row_count_equals_live: t.census ? a.rows === t.census.rows_holding_legacy_values : null,
        rls_enabled: a.rls_enabled, rls_forced: a.rls_forced, grants_to_app_roles: a.grants_to_app_roles,
      } : { exists: false };
      return { table: a.plan_table, archive: a.table, exists: Boolean(a.exists), row_count_check: t.census ? 'MEASURED' : 'NOT_MEASURABLE_COLUMNS_ALREADY_DROPPED', ...counts };
    });
    const ok = per.every((p) => p.exists && p.rls_enabled && p.rls_forced && p.grants_to_app_roles === 0 && p.row_count_equals_live !== false);
    archiveItem = { status: ok ? 'PASS' : 'FAIL', satisfied: ok, per_table: per, reason: 'measured on the supplied database.' };
  }

  // (13) rollback
  const hasDown = /public async down\(/.test(loaded.source);
  const rollback = {
    status: hasDown ? 'AVAILABLE_WHILE_ARCHIVE_EXISTS' : 'NOT_AVAILABLE',
    satisfied: hasDown,
    mechanism: group.kind === 'events' ? 'down() re-adds data, rebuilds it from starts_at, SET NOT NULL, recreates function, trigger and idx_events_tenant_data (no archive needed)'
      : group.kind === 'relax' ? 'down() refills NULL legacy_amount from service_amount (never invents a 0), refuses rows with neither value, then SET NOT NULL'
        : 'down() re-adds the columns (nullable, same type) and restores values by id from the archive; refuses when the archive is missing; never drops the archive',
    archive_retired_by: group.kind ? null : 'draft 20260930000052 (irreversible; only after the retention window)',
    archive_exists_in_measured_database: m && hasArchiveTables ? archives.map((a) => ({ table: a.table ?? null, exists: Boolean(a.exists) })) : NM,
  };

  // (14) retention
  let retention;
  if (!group.pii) retention = { status: NOT_APPLICABLE, satisfied: true, reason: 'not a PII group.' };
  else if (retentionRef) retention = { status: 'PROVIDED_UNVERIFIED', satisfied: true, reference: retentionRef, reason: 'reference supplied by the operator; its content (an owner decision) is not verified by this tool.' };
  else retention = { status: 'NOT_DEFINED', satisfied: false, reason: 'PII group: the owner retention decision for the archive is required (--retention-ref).' };

  // (12) PITR
  const pitr = pitrId
    ? { status: 'PROVIDED_UNVERIFIED', satisfied: true, id: pitrId, reason: 'supplied by the operator; the existence of the restore point is not verified by this tool.' }
    : { status: 'NOT_PROVIDED', satisfied: false, reason: 'required input --pitr-id (never invented).' };

  const restore = validateRehearsal(rehearsalReport, loaded);
  const rehearsal = restore.status === 'PASS'
    ? { status: 'PASS_DISPOSABLE_ONLY', satisfied: false, reason: `up -> down -> up passed on a disposable COPY (${rehearsalReport.environment}); a rehearsal on a fresh restore of production data (staging) was never run, so this does not satisfy the plan.`, up_down_up: true }
    : { status: restore.status, satisfied: false, reason: restore.reason };

  const staticHits = scan.hits.length;
  const prerequisites = evaluateChecklist(checklist, {
    env, group, measured: Boolean(m), divergenceMeasured: divergenceRows !== null, divergenceTotal: divergenceTotal ?? 0,
    staticHits, retentionRef, pitrId,
  });

  const items = {
    1: { name: 'migration_file_sha256_registered', file: loaded.rel, sha256: loaded.sha256, class: loaded.className, registered: reg.registered, registration: reg, satisfied: reg.registered === false, status: reg.registered ? 'REGISTERED' : 'UNREGISTERED' },
    2: { name: 'table_and_columns', tables: plans.map((p) => p.table), columns: plans.map((p) => ({ table: p.table, names: p.columns.map((c) => c.name), declared_types: Object.fromEntries(p.columns.map((c) => [c.name, c.type])) })),
      information_schema: m ? tables.map((t) => ({ table: t.table, table_exists: t.table_exists, columns: t.columns })) : NM,
      catalog_dependents: m ? tables.map((t) => ({ table: t.table, dependents: t.catalog_dependents ?? NM })) : NM,
      status: columnsVerified, satisfied: columnsVerified === 'VERIFIED' },
    3: { name: 'canonical_replacement', mapping: Object.fromEntries(identifiers.map((i) => [i, group.canonical[i] ?? 'UNKNOWN'])), status: identifiers.every((i) => group.canonical[i]) ? 'DECLARED' : 'UNKNOWN',
      satisfied: identifiers.every((i) => group.canonical[i] && !String(group.canonical[i]).startsWith('NONE') && !String(group.canonical[i]).includes('UNPROVEN')),
      note: 'NONE/UNPROVEN means the values exist only in the legacy column or the canonical column is not proven: the owner census and retention decision are the gate.' },
    4: { name: 'zero_legacy_producers', status: producers.length === 0 ? 'YES' : 'NO', hits: producers.length, locations: producers, satisfied: producers.length === 0 },
    5: { name: 'zero_legacy_consumers', status: consumers.length === 0 ? 'YES' : 'NO', hits: consumers.length, locations: consumers, satisfied: consumers.length === 0,
      scan: { roots: SCAN_ROOTS, identifiers: [...new Set(identifiers)], allowlisted_hits: scan.allowlisted.length, allowlisted_locations: scan.allowlisted,
        note: 'PRODUCER/CONSUMER is a line heuristic (write patterns); the gate is the total: any hit = NO.' } },
    6: { name: 'environment_census', status: censusStatus, satisfied: censusStatus === 'MEASURED',
      per_table: m ? tables.map((t) => ({ table: t.table, ...(t.census ?? { census: NM }) })) : NM,
      ...(m?.clients_pair_census ? { clients_pair_census: m.clients_pair_census } : {}),
      ...(m?.events_objects ? { events_objects: m.events_objects } : {}) },
    7: { name: 'divergences_legacy_vs_canonical', status: divergenceRows ? (divergenceTotal === 0 ? 'ZERO' : 'DIVERGENT') : NM, satisfied: divergenceRows !== null && divergenceTotal === 0,
      blocking_total: divergenceTotal, informational_total: infoTotal, checks: divergenceRows ?? NM,
      declared_checks: plans.flatMap((p) => p.checks.map((c) => ({ table: p.table, label: c.label, predicate: c.where, informational: c.informational ?? null }))),
      note: plans.every((p) => p.checks.length === 0) ? 'NO machine check exists for this group (no canonical counterpart): the owner census is the only gate.' : undefined },
    8: { name: 'rows_affected', status: censusStatus, rows_holding_legacy_values: rowsHolding, satisfied: censusStatus === 'MEASURED',
      per_table: m && censusStatus === 'MEASURED' ? tables.map((t) => ({ table: t.table, rows: t.census.rows_holding_legacy_values, rows_total: t.census.rows_total })) : NM },
    9: { name: 'archive_integrity', ...archiveItem },
    10: { name: 'restore_test', ...restore },
    11: { name: 'rehearsal', ...rehearsal },
    12: { name: 'pitr_restore_point', ...pitr },
    13: { name: 'rollback_availability', ...rollback },
    14: { name: 'retention', ...retention },
    15: { name: 'runbook_prerequisites', status: prerequisites.every((p) => p.status !== NOT_SATISFIED) ? 'ALL_SATISFIED' : 'HAS_NOT_SATISFIED',
      satisfied: prerequisites.every((p) => p.status !== NOT_SATISFIED), source: `${PLAN_DOC} section 8`, items: prerequisites },
  };

  const blockers = [];
  if (env === 'disposable') blockers.push('ENVIRONMENT_NOT_REAL: a disposable database is not dev/staging/production');
  for (const [n, item] of Object.entries(items)) {
    if (item.satisfied === true) continue;
    if (n === '15') { for (const p of item.items.filter((x) => x.status === NOT_SATISFIED)) blockers.push(`15: ${p.item.slice(0, 110)} -> ${p.reason}`); continue; }
    blockers.push(`${n} ${item.name}: ${item.status}${item.reason ? ` (${item.reason})` : ''}`);
  }
  return {
    group: group.short, migration: loaded.className, migration_id: group.id, label: group.label,
    destructive: !group.nonDestructive, environment: env, database_measured: Boolean(m),
    evidence: items,
    ready_for_destructive_execution: env !== 'disposable' && blockers.length === 0,
    blockers,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { env: null, group: 'all', noDb: false, pitrId: null, retention: [], rehearsalReport: null, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`); return v; };
    if (a === '--env') args.env = val();
    else if (a === '--group') args.group = val();
    else if (a === '--no-db') args.noDb = true;
    else if (a === '--pitr-id') args.pitrId = val();
    else if (a === '--retention-ref') args.retention.push(val());
    else if (a === '--rehearsal-report') args.rehearsalReport = val();
    else if (a === '--pretty') args.pretty = true;
    else throw new UsageError(`unknown argument ${a}`);
  }
  if (!args.env) throw new UsageError(`--env <${ENVIRONMENTS.join('|')}> is required`);
  if (!ENVIRONMENTS.includes(args.env)) throw new UsageError(`--env must be one of ${ENVIRONMENTS.join(', ')}`);
  if (args.pitrId !== null && !/^[A-Za-z0-9_.:\-]{3,128}$/.test(args.pitrId)) throw new UsageError('--pitr-id has an invalid format');
  return args;
}

export function selectGroups(spec) {
  if (spec === 'all') return GROUPS;
  const wanted = spec.split(',').map((s) => s.trim());
  const chosen = wanted.map((w) => GROUPS.find((g) => g.short === w || g.id === w));
  const unknown = wanted.filter((_, i) => !chosen[i]);
  if (unknown.length > 0) throw new UsageError(`unknown group(s): ${unknown.join(', ')}`);
  return chosen;
}

export function retentionFor(retention, group) {
  for (const r of retention) {
    const eq = r.indexOf('=');
    if (eq > 0) { const g = r.slice(0, eq); if (g === group.short || g === group.id) return r.slice(eq + 1); }
  }
  return retention.find((r) => !/^(\d{2}|\d{14})=/.test(r)) ?? null;
}

async function openReadOnly(databaseUrl, processEnv) {
  const require = createRequire(path.join(repoRootOf(), 'apps/api/package.json'));
  const { Client } = require('pg');
  const ssl = processEnv.DB_SSL === 'false' ? false : undefined;
  const client = new Client({ connectionString: databaseUrl, ssl, options: '-c default_transaction_read_only=on -c statement_timeout=30000', application_name: 'legacy-drop-preflight' });
  await client.connect();
  const ro = (await client.query(`SELECT current_setting('transaction_read_only') AS ro`)).rows[0].ro;
  if (ro !== 'on') { await client.end(); throw new SafetyError('the session is not read-only (transaction_read_only != on): refusing to measure.'); }
  return client;
}

export function repoRootOf() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export async function run(argv, processEnv = process.env, { repoRoot = repoRootOf(), openClient = openReadOnly } = {}) {
  const args = parseArgs(argv);
  const databaseUrl = processEnv.DATABASE_URL || null;
  if (!args.noDb && !databaseUrl) throw new UsageError('DATABASE_URL is required (or pass --no-db explicitly to emit only the static items).');
  if (args.noDb && databaseUrl) { /* ignored on purpose: --no-db never connects */ }
  assertSafeTarget({ env: args.env, databaseUrl: args.noDb ? null : databaseUrl, processEnv });
  const groups = selectGroups(args.group);
  const checklist = parseChecklist(readFileSync(path.join(repoRoot, PLAN_DOC), 'utf8'));
  const rehearsalReport = args.rehearsalReport ? JSON.parse(readFileSync(path.resolve(args.rehearsalReport), 'utf8')) : null;

  let client = null;
  let query = null;
  let target = { supplied: false };
  if (!args.noDb) {
    try {
      client = await openClient(databaseUrl, processEnv);
    } catch (e) {
      if (e instanceof SafetyError) throw e;
      throw new Error(redact(`cannot connect to the database: ${e.message}`, databaseUrl));
    }
    query = makeReadOnlyQuery(async (sql, params) => (await client.query(sql, params)).rows);
    const h = hostClass(databaseUrl);
    target = { supplied: true, host: h.host, port: h.port, database: h.database, read_only_session: true, credentials: 'redacted' };
  }
  try {
    const reports = [];
    for (const group of groups) {
      const loaded = loadGroup(repoRoot, group);
      const measure = query ? await measureGroup(query, loaded) : undefined;
      reports.push(buildGroupReport({
        repoRoot, loaded, env: args.env, measure, dbSupplied: Boolean(query), pitrId: args.pitrId,
        retentionRef: retentionFor(args.retention, group), rehearsalReport, checklist,
      }));
    }
    return {
      tool: 'scripts/legacy-drop-preflight.mjs',
      read_only: true,
      generated_at: new Date().toISOString(),
      environment: args.env,
      database: target,
      authorization: 'NONE: this report authorizes no destructive step; production receives no DROP authorization (decision deci-ed83c974, 2026-10-03).',
      groups: reports,
      summary: reports.map((g) => ({ group: g.group, migration: g.migration, ready_for_destructive_execution: g.ready_for_destructive_execution, blockers: g.blockers.length })),
    };
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  run(argv).then((result) => {
    const pretty = argv.includes('--pretty');
    process.stdout.write(`${JSON.stringify(result, null, pretty ? 2 : 0)}\n`);
  }).catch((e) => {
    const msg = redact(e?.message ?? String(e), process.env.DATABASE_URL);
    process.stderr.write(`legacy-drop-preflight: ${msg}\n`);
    process.exit(e instanceof SafetyError ? 3 : e instanceof UsageError ? 2 : 1);
  });
}
