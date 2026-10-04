#!/usr/bin/env node
/**
 * scripts/destructive-dossier.mjs: the complete approval dossier of every destructive package, one block per package.
 *
 *   node scripts/destructive-dossier.mjs --preflight <preflight.json> [--db-sizes] [--out docs/engineering/destructive-approval-dossier]
 *   node scripts/destructive-dossier.mjs --check          (validates the committed dossier: every field, READY: NO, typed missing items)
 *
 * Inputs are evidence, not claims: the read-only pre-flight JSON (`scripts/legacy-drop-preflight.mjs --env disposable ...`,
 * which already embeds the rehearsal report) and, with `--db-sizes`, read-only catalog sizes of the disposable database
 * (`DATABASE_URL`, local host only). Every real-environment measurement is reported as EXTERNAL_REQUIREMENT: this workspace
 * has no dev, staging or production database and the dossier never invents one. NOTHING here executes a destructive step,
 * reads a credential value or sets a confirmation token.
 *
 * Every missing item is typed:
 *   HUMAN_APPROVAL        an explicit owner/security approval naming migration + environment (never self-granted);
 *   HUMAN_DECISION        a policy the owner has to define (retention owner and period, key custody holder);
 *   EXTERNAL_REQUIREMENT  access, credential or infrastructure outside this workspace (real database, PITR, staging restore).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
export const MIN_FIELDS = ["PACKAGE", "MIGRATION", "TABLE", "COLUMNS", "ENVIRONMENT", "REAL_CENSUS", "DIVERGENCES", "ARCHIVE_PLAN", "RESTORE_PLAN", "PITR_REQUIREMENT", "TABLE_SIZE", "LOCK_ESTIMATE", "STAGING_REHEARSAL", "RETENTION", "KEY_CUSTODY", "DEPENDENCIES", "READY", "MISSING_REQUIREMENT"];
export const REQUIREMENT_TYPES = ["HUMAN_APPROVAL", "HUMAN_DECISION", "EXTERNAL_REQUIREMENT"];

/** Primitive costs measured on this workspace (synthetic table, 273 MB per million rows, 4 vCPU shared with other jobs). */
export const MEASURED_RATES = {
  provenance: "microbenchmark of 2026-10-03 (reproducible: scripts/legacy-drop-primitive-benchmark.sql) on the disposable PostgreSQL 16 of this workspace: synthetic table of 1,000,000 and 3,000,000 rows (273 MB and 829 MB, about 270 bytes per row), run while other CPU-heavy jobs shared the 4 vCPUs (contention biases the numbers pessimistic); the legacy columns of the synthetic table are tiny (short text, a one-key jsonb object, uuid) and the table fits in RAM (warm cache), so large TOASTed text/jsonb values (for example works.legacy_lyrics, legacy_alternative_titles, HR data) will cost more than these figures for archive insert and verification joins; order of magnitude only, to be re-measured on a staging restore. WAL volume, replication lag and archive table size were not estimated",
  preconditionScanPerMillionRowsSec: "0.03 to 0.18 s per million rows",
  archiveInsertPerMillionRowsSec: "1.3 to 1.7 s per million rows (CREATE TABLE AS, a lower bound: the draft inserts into a primary-key table)",
  verificationJoinsPerMillionRowsSec: "1.1 to 1.2 s per million rows per join (two joins: NOT EXISTS coverage and archive-to-live stale check)",
  dropColumnMs: "3 to 4 ms (catalog change, independent of row count)",
  restoreUpdatePerMillionRowsSec: "19 to 40 s per million rows (down() only)",
};

const PII_PACKAGES = [
  {
    id: "PII-BACKFILL", short: "PII backfill", migration: "20261002000002_EncryptArtistsAndClientsPiiBackfill", file: "apps/api/src/database/migration-drafts/20261002000002_EncryptArtistsAndClientsPiiBackfill.ts", destructive: false,
    tables: ["artists", "clients"], archive: "artists_pii_archive_20261002, clients_pii_archive_20261002 (plaintext PII copy, RLS enabled and forced, no policy, app roles revoked), created by the migration itself before any write",
    columns: "artists birth_date, rg, address, bank_name, bank_branch, bank_account, pix_key, account_holder (read) -> <column>_encrypted (written only when NULL); artists.metadata and clients.metadata PII keys (archived only); clients document",
    rehearsal: "pii-backfill-drafts.e2e-spec.ts on a COPY of the disposable database with synthetic rows (ciphertext written, plaintext untouched, verification by hash, injected failures roll back)",
    restore: "down() removes only the ciphertext this draft wrote (recorded in the archive); plaintext was never touched. Logical reversal rehearsed on synthetic data; a restore of a real backup was never performed",
    dependencies: "prerequisite registered migration 20261002000001_AddArtistsPiiEncryptedColumns; dual-read API release live on every instance (dual read: ciphertext first, plaintext fallback); a verified backfill is a prerequisite of PII-SCRUB; archive retention policy (draft 20260930000052 re-timestamped later)",
    token: "PII_ENCRYPT_CONFIRM", pii: true,
    missing: [
      ["HUMAN_APPROVAL", "explicit owner/security approval naming migration 20261002000002, the environment and the columns (the backfill never authorizes the scrub)"],
      ["EXTERNAL_REQUIREMENT", "real record census of artists and clients in the target environment (read-only connection; counts per column and per tenant)"],
      ["EXTERNAL_REQUIREMENT", "staging rehearsal on a fresh restore of the target data (up, verify, down, up)"],
      ["EXTERNAL_REQUIREMENT", "backup restore proof and a PITR restore point id taken immediately before the run"],
      ["HUMAN_DECISION", "ENCRYPTION_KEY custody: named holder, escrow location, recovery procedure, rotation plan (see docs/engineering/pii-key-custody-request.md)"],
      ["HUMAN_DECISION", "retention owner, period and policy of the two plaintext archive tables"],
      ["EXTERNAL_REQUIREMENT", "confirmation that the dual-read API release is live on every instance of the target"],
      ["HUMAN_DECISION", "maintenance window for the FOR UPDATE row locks"],
    ],
  },
  {
    id: "PII-SCRUB", short: "PII scrub", migration: "20261002000003_ScrubArtistsAndClientsPlaintext", file: "apps/api/src/database/migration-drafts/20261002000003_ScrubArtistsAndClientsPlaintext.ts", destructive: true,
    tables: ["artists", "clients"], archive: "artists_pii_archive_20261002, clients_pii_archive_20261002 (read as the only way back; created by the BACKFILL, must cover every candidate row by value or the scrub refuses)",
    columns: "artists birth_date, rg, address, bank_name, bank_branch, bank_account, pix_key, account_holder set to NULL; artists.metadata and clients.metadata PII keys removed (non-PII keys kept); ciphertext columns are never touched",
    rehearsal: "pii-backfill-drafts.e2e-spec.ts (scrub block) on a disposable COPY with synthetic rows: plaintext gone, ciphertext byte-identical, archive unchanged, down() restores the seed state, planted divergence blocks the scrub",
    restore: "down() restores plaintext columns and metadata keys from the archive (a newer ciphertext edit wins). After the scrub the ciphertext plus the archive are the only copies: without a custody-proven key the ciphertext is unrecoverable",
    dependencies: "a completed, approved and verified PII-BACKFILL in the same environment (zero missing, zero divergent ciphertext, controlled decrypt verification on real data); key custody; archive retention; dual-read API release; maintenance window",
    token: "PII_SCRUB_CONFIRM", pii: true,
    missing: [
      ["HUMAN_APPROVAL", "separate explicit owner/security destructive approval naming migration 20261002000003 and the environment (the backfill approval does not cover it)"],
      ["EXTERNAL_REQUIREMENT", "a completed and verified PII-BACKFILL in the target environment (it has run nowhere real)"],
      ["EXTERNAL_REQUIREMENT", "real record census with zero missing and zero divergent ciphertext, and a controlled decrypt verification on real data"],
      ["EXTERNAL_REQUIREMENT", "staging rehearsal of the scrub on a fresh restore of the target data, including the failure-recovery path"],
      ["EXTERNAL_REQUIREMENT", "backup restore proof and a PITR restore point id taken immediately before the run"],
      ["HUMAN_DECISION", "ENCRYPTION_KEY custody and escrow, proven by a restore of the key in a clean environment (see docs/engineering/pii-key-custody-request.md)"],
      ["HUMAN_DECISION", "retention owner, period and policy of the plaintext archives that become the only plaintext copy"],
      ["EXTERNAL_REQUIREMENT", "confirmation that the dual-read API release is live on every instance of the target (an old build would read NULL plaintext as empty and could write plaintext back)"],
      ["HUMAN_DECISION", "maintenance window for the FOR UPDATE row locks; also the lifetime of older backups and PITR points that still hold plaintext after the scrub"],
    ],
  },
];

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function dropPackage(g, drafts) {
  const ev = g.evidence;
  const cols = (ev["2"].columns ?? []).map((c) => `${c.table}.{${c.names.join(", ")}}`).join("; ");
  const tables = ev["2"].tables ?? [];
  const census = ev["6"];
  const rows = (census.per_table ?? []).map((t) => `${t.table}=${t.rows_holding_legacy_values}/${t.rows_total}`).join(" ");
  const div = ev["7"];
  const pii = (drafts.find((d) => d.short === g.group) ?? {}).pii;
  const o = OVERRIDES[g.group] ?? {};
  const base = { id: g.group, short: `package ${g.group} ${g.label}`, migration: `${g.migration} | ${ev["1"].file} | sha256=${ev["1"].sha256} | registered=${ev["1"].registered}`, destructive: g.destructive, tables, columns: cols,
    disposableCensus: `${rows} (disposable base, no business rows)`, divergences: `${div.status}: blocking=${div.blocking_total}, informational=${div.informational_total} over ${(div.checks ?? []).length} check(s) on the disposable base`,
    archive: `${tables.map((t) => `${t}_legacy_archive_20260930`).join(", ")}: created by up() (RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app revoked), holds the legacy values by id; kept by down(); retired only by draft 20260930000052 after the retention window`,
    restore: `down() re-adds the columns (nullable, same type) and restores the values by id from the archive (refuses without it, never drops it); disposable rehearsal ${ev["10"].status}: values equal by id after down(), archive kept. A restore of a real backup was never performed`,
    rehearsal: `disposable COPY ${ev["11"].status} (legacy-column-drop-drafts e2e spec, up -> down -> up)`,
    pii: Boolean(pii), missing: [] };
  return { ...base, ...o, divergences: o.divergences ?? (base.divergences + (o.divergences_note ? `; ${o.divergences_note}` : "")), dependencies: `${o.dependencies ?? "release B0 (entity/reader/writer removal) and release A deployed everywhere; the 15 owner evidence items of scripts/legacy-drop-preflight.mjs; one destructive migration per deploy"}; ${COMMON_DEPENDENCY_TAIL}` };
}

/** Facts that differ from the generic base-driven archive-then-drop shape (derived from the drafts, verified by the independent review). */
export const OVERRIDES = {
  "46": {
    archive: "NO archive table: events.data is enforced equal to events.starts_at (NOT NULL) by the sync trigger, so the precondition `data IS DISTINCT FROM starts_at` = 0 and `starts_at IS NULL` = 0 proves the column carries no information",
    restore: "down(): ADD COLUMN data, UPDATE events SET data = starts_at, SET NOT NULL, recreate the sync function, the trigger and idx_events_tenant_data (rebuilt from starts_at, not restored from an archive). up() drops trigger and function before the column and asserts idx_events_tenant_starts_at exists first",
    retention: "NOT_APPLICABLE (no archive)", noRetentionItem: true,
    dependencies: "release B0 (entity/reader/writer removal) deployed everywhere; index idx_events_tenant_starts_at present; one destructive migration per deploy; draft 52 retires no events archive because none exists",
    lockEstimate: "up(): SET LOCAL lock_timeout 15s, then LOCK TABLE events IN SHARE ROW EXCLUSIVE MODE first (readers continue, writers wait, also while queueing for up to 15s), held through the whole transaction: one precondition scan of events (data IS DISTINCT FROM starts_at, starts_at IS NULL), then DROP TRIGGER, DROP FUNCTION and DROP COLUMN (catalog changes, ACCESS EXCLUSIVE, milliseconds); no archive insert and no joins. down() is NOT a catalog change: a full-table UPDATE events SET data = starts_at plus SET NOT NULL and an index rebuild, proportional to table size. Real window EXTERNAL_REQUIREMENT (needs real row counts and a staging restore)",
  },
  "48": {
    archive: "NO archive and no data loss: the draft only runs ALTER COLUMN DROP NOT NULL on invoices.legacy_amount (precursor of package 49)",
    restore: "down(): refuses when legacy_amount is absent or when any row has both amounts NULL, otherwise refills legacy_amount from service_amount and SET NOT NULL",
    retention: "NOT_APPLICABLE (no archive)", noRetentionItem: true,
    dependencies: "requires migration 20260930000022; must be applied BEFORE package 49 with the stop-writing/entity-removal release between them; rollback order is 49 then 48 (legacy-column-drop-plan.md)",
    lockEstimate: "up(): SET LOCAL lock_timeout 15s, then LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE first (readers continue, writers wait, also while queueing for up to 15s), held through the transaction: one precondition scan of invoices, then ALTER COLUMN legacy_amount DROP NOT NULL (the ALTER itself is metadata-only, ACCESS EXCLUSIVE for milliseconds); there is no DROP COLUMN, no archive and no join. down() refills legacy_amount from service_amount (a full-table UPDATE) and sets NOT NULL again. Real window EXTERNAL_REQUIREMENT (needs real row counts and a staging restore)",
    b0: "release A deployed everywhere so that no writer depends on NOT NULL invoices.legacy_amount; release B0 (stop-writing/entity removal) comes AFTER 48 is applied everywhere and BEFORE package 49, so it is not a prerequisite of 48",
  },
  "49": { dependencies: "package 48 applied first and migration 20260930000022 present, with the stop-writing and entity-removal release between 48 and 49; rollback order 49 then 48; draft 52 retires the archive and must be re-timestamped after 49 and the PII drafts" },
  "53": {
    archive: "employees_pii_legacy_archive_20260930 (distinct from package 45's employees_legacy_archive_20260930): created by up(), RLS enabled and forced, no policy, app roles revoked, holds rg, birth_date, address by id; kept by down()",
    divergences: "NO machine check exists in the draft (checks: [] by design): the gate is the owner census (plan 3.6) and the HR retention decision, so this is not a clean ZERO",
    dependencies: "independent of package 45 although both touch employees: they must not share a deploy; owner census 3.6 and HR retention decision; release B0",
  },
  "43": { divergences_note: "the draft's single check is informational and vacuous: the real gate is the owner-signed (legacy, status) pair census" },
  "45": { lockNote: "three tables (employees, payroll_entries, leave_requests) are locked one after another, each under its own 15s lock_timeout, and the ALTERs run last: check for deadlock risk against other writers" },
};
const COMMON_DEPENDENCY_TAIL = "draft 20260930000052 (RetireLegacyColumnDropArchives) retires the archives of 40-45, 49, 53 and the two PII archives and must be re-timestamped AFTER 20261002000002 and 20261002000003, otherwise it is a no-op through DROP IF EXISTS and the archives are never retired";

export function buildPackages(preflight, drafts) {
  const pk = [];
  for (const g of preflight.groups) {
    if (!g.destructive && !["48"].includes(g.group)) continue;
    pk.push(dropPackage(g, drafts));
  }
  return pk;
}

const COMMON_MISSING = (id, pii, noRetention = false, b0 = "release B0 (entity/reader/writer removal) and release A deployed and green in every environment") => [
  ["HUMAN_APPROVAL", `explicit owner approval naming migration ${id}, the environment and the columns (decision deci-ed83c974 grants none)`],
  ["EXTERNAL_REQUIREMENT", "real-environment census (read-only connection; `node scripts/legacy-drop-preflight.mjs --env <dev|staging|production> --group " + id + "` with DATABASE_URL of that environment)"],
  ["EXTERNAL_REQUIREMENT", b0],
  ["EXTERNAL_REQUIREMENT", "coexistence proof: B0 deployed for at least one full deploy cycle and no old build/instance still running (rollout complete, old revision drained) before the drop (plan: docs/engineering/legacy-column-drop-plan.md, section on coexistence)"],
  ["EXTERNAL_REQUIREMENT", "staging rehearsal on a fresh restore of production data (up, verify, down, byte-equal values, up)"],
  ["EXTERNAL_REQUIREMENT", "PITR restore point id (`--pitr-id`) taken immediately before the deploy, and a restore proof"],
  ["EXTERNAL_REQUIREMENT", "table size and measured lock window on production-sized data (formula in LOCK_ESTIMATE)"],
  ["HUMAN_APPROVAL", "draft moved to migrations/ and registered, LEGACY_DROP_CONFIRM present only in the single executing deploy job (never from this workspace), one destructive migration per deploy, rollback owner on call"],
  ...(noRetention ? [] : [["HUMAN_DECISION", pii ? "retention owner, period and policy of the archive that holds personal data" : "owner of the retention window after which draft 20260930000052 may retire the archive"]]),
];

export function render(packages, { sizes, generatedFrom }) {
  const out = [];
  out.push("# Destructive approval dossier (generated)", "");
  out.push(`Generated by \`node scripts/destructive-dossier.mjs\` from ${generatedFrom}. Scope: the column-drop and PII packages 40-46, 48, 49, 53 and the PII backfill/scrub. Other destructive or irreversible drafts are covered by their own plans and tokens, not by a block here: 20260930000050 PurgeBackfillSideTables (DROP TABLE of the backfill side tables, irreversible, token BACKFILL_PURGE_CONFIRM; docs/engineering/backfill-side-tables-retention.md), 20260930000052 RetireLegacyColumnDropArchives (drops the only copy of the dropped values, irreversible, token LEGACY_ARCHIVE_RETIRE_CONFIRM; legacy-column-drop-plan.md and the dependency line of each block), 20260930000051 and the role-slug retirement (docs/engineering/rbac-retirement-plan.md). Preparation only: every package says \`READY: NO\`, nothing was dropped, scrubbed or approved, no confirmation token was set. Every real-environment measurement is \`EXTERNAL_REQUIREMENT\` because no dev, staging or production database is reachable from this workspace.`, "");
  out.push("Missing items are typed: `HUMAN_APPROVAL` (explicit approval naming migration and environment, never self-granted), `HUMAN_DECISION` (a policy the owner defines), `EXTERNAL_REQUIREMENT` (access, credential or infrastructure outside this workspace).", "");
  out.push("## Measured primitives (lock estimate inputs)", "", `Provenance: ${MEASURED_RATES.provenance}.`, "");
  out.push("| Primitive | Measured |", "|---|---|", `| precondition scan (all rows, per check) | ${MEASURED_RATES.preconditionScanPerMillionRowsSec} |`, `| archive insert (rows holding legacy values) | ${MEASURED_RATES.archiveInsertPerMillionRowsSec} |`, `| verification joins (two) | ${MEASURED_RATES.verificationJoinsPerMillionRowsSec} |`, `| ALTER TABLE DROP COLUMN | ${MEASURED_RATES.dropColumnMs} |`, `| down(): restore UPDATE | ${MEASURED_RATES.restoreUpdatePerMillionRowsSec} |`, "");
  out.push("Base-driven drafts (40-45, 49, 53) take `LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE` first (readers continue, writers wait) under `SET LOCAL lock_timeout = '15s'`, which bounds each lock acquisition and not the total window, and hold it to the end of the transaction through the preconditions, the archive insert, two verification joins and the drop. Estimated write-blocking window of `up()`: `T_scan(all rows, once per check) + T_insert(rows holding legacy values) + 2 x T_join + O(ms)`. The final `ALTER TABLE ... DROP COLUMN` needs ACCESS EXCLUSIVE, so readers are blocked from that statement until commit (and queue behind its wait). Queueing for SHARE ROW EXCLUSIVE behind a long-running writer already stalls every writer that arrives after it, for up to the 15s lock_timeout, before the window itself starts. Packages 46 and 48 are not base-driven (no archive, no joins): their own LOCK_ESTIMATE lines apply. The two PII drafts take NO table lock: their exposure is row locks (`FOR UPDATE`, 200-row keyset batches) held through the whole transaction.", "");
  out.push("## Overview", "", "| Package | Table | Destructive | Disposable census | Rehearsal (disposable) | READY |", "|---|---|---|---|---|---|");
  for (const p of packages) out.push(`| ${p.short} | ${p.tables.join(", ")} | ${p.destructive ? "yes" : "no (precursor/backfill)"} | ${p.disposableCensus ?? "synthetic rows only"} | ${(p.rehearsal ?? "").split(" (")[0].split(":")[0]} | NO |`);
  out.push("");
  for (const p of packages) {
    const size = p.tables.map((t) => `${t}=${sizes?.[t] != null ? `${sizes[t]} bytes (disposable, empty)` : "NOT_MEASURED"}`).join("; ");
    const missing = (p.missing && p.missing.length ? p.missing : COMMON_MISSING(p.id, p.pii, Boolean(p.noRetentionItem), p.b0));
    out.push(`## ${p.short}`, "", "```text");
    out.push(`PACKAGE: ${p.short} (${p.destructive ? "DESTRUCTIVE" : "non-destructive precursor or backfill"})`);
    out.push(`MIGRATION: ${p.migration}`);
    out.push(`TABLE: ${p.tables.join(", ")}`);
    out.push(`COLUMNS: ${p.columns}`);
    out.push("ENVIRONMENT: disposable-rehearsal (local PostgreSQL 16 COPY); target environment NOT_DEFINED until the owner names it (EXTERNAL_REQUIREMENT: no dev, staging or production database is reachable here)");
    out.push(`REAL_CENSUS: EXTERNAL_REQUIREMENT (never measured on a real environment; disposable base: ${p.disposableCensus ?? "synthetic rows only"})`);
    out.push(`DIVERGENCES: ${p.divergences ?? "rehearsal: planted divergent ciphertext is detected, never overwritten and blocks the scrub; real divergences EXTERNAL_REQUIREMENT (needs the real census)"}`);
    out.push(`ARCHIVE_PLAN: ${p.archive}`);
    out.push(`RESTORE_PLAN: ${p.restore}`);
    out.push("PITR_REQUIREMENT: EXTERNAL_REQUIREMENT: a point-in-time restore point id of the target database taken immediately before the deploy, plus a restore proof into a disposable target (a configured backup is not restore evidence); never invented here");
    out.push(`TABLE_SIZE: ${size}; real size EXTERNAL_REQUIREMENT (SELECT pg_total_relation_size on the target)`);
    out.push(p.id.startsWith("PII")
      ? `LOCK_ESTIMATE: no table lock; FOR UPDATE row locks in 200-row keyset batches on ${p.tables.join(", ")} held through the whole transaction, lock_timeout 15s; duration proportional to candidate rows (not measured: needs real counts and a staging restore: EXTERNAL_REQUIREMENT)`
      : p.lockEstimate ? `LOCK_ESTIMATE: ${p.lockEstimate}`
      : `LOCK_ESTIMATE: SHARE ROW EXCLUSIVE on ${p.tables.join(", ")} (lock_timeout 15s per acquisition), ACCESS EXCLUSIVE at the final DROP; window formula above${p.lockNote ? `; ${p.lockNote}` : ""}; real window EXTERNAL_REQUIREMENT (needs real row counts and a staging restore)`);
    out.push(`STAGING_REHEARSAL: disposable COPY: ${p.rehearsal}; staging rehearsal on restored target data: EXTERNAL_REQUIREMENT`);
    out.push(`RETENTION: ${p.retention ?? (p.pii ? "HUMAN_DECISION: owner, period and policy of the archive that holds personal data are NOT_DEFINED (none is invented here)" : "archive kept until the separate retirement draft 20260930000052 runs after its retention window; owner of that window is a HUMAN_DECISION recorded with the approval")}`);
    out.push(`KEY_CUSTODY: ${p.id.startsWith("PII") ? "HUMAN_DECISION: NOT_DEFINED (see docs/engineering/pii-key-custody-request.md for exactly what the owner must provide)" : "NOT_APPLICABLE (no encrypted data in this package)"}`);
    out.push(`DEPENDENCIES: ${p.dependencies ?? "release B0 (entity/reader/writer removal) and release A deployed everywhere; the 15 owner evidence items of scripts/legacy-drop-preflight.mjs; draft 20260930000052 retires the archive only after retention; one destructive migration per deploy"}`);
    out.push("READY: NO");
    out.push("MISSING_REQUIREMENT:");
    for (const [t, m] of missing) out.push(`  - ${t}: ${m}`);
    out.push("```", "");
  }
  return out.join("\n");
}

export function checkDossier(text) {
  const problems = [];
  const blocks = text.split(/^## /m).filter((b) => /^PACKAGE:/m.test(b));
  for (const b of blocks) {
    const name = b.split("\n")[0];
    for (const f of MIN_FIELDS) if (!new RegExp(`^${f}:`, "m").test(b)) problems.push(`${name}: missing field ${f}`);
    if (!/^READY: NO$/m.test(b)) problems.push(`${name}: READY is not NO`);
    const missing = b.split(/^MISSING_REQUIREMENT:$/m)[1] ?? "";
    const items = missing.split("\n").filter((l) => /^\s+- /.test(l));
    if (!items.length) problems.push(`${name}: no missing requirement listed`);
    for (const i of items) if (!REQUIREMENT_TYPES.some((t) => i.includes(`- ${t}:`))) problems.push(`${name}: untyped missing item ${i.trim().slice(0, 60)}`);
    if (/READY: YES/.test(b)) problems.push(`${name}: READY: YES`);
  }
  return { blocks: blocks.length, problems };
}

async function main() {
  if (process.argv.includes("--check")) {
    const f = path.join(ROOT, "docs/engineering/destructive-approval-dossier.md");
    const { blocks, problems } = checkDossier(fs.readFileSync(f, "utf8"));
    console.log(`destructive dossier: ${blocks} package block(s), ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    if (problems.length || blocks < 11) process.exit(1);
    return;
  }
  const pre = arg("--preflight");
  if (!pre) throw new Error("usage: destructive-dossier.mjs --preflight <file> [--db-sizes] | --check");
  const preflight = JSON.parse(fs.readFileSync(path.resolve(pre), "utf8"));
  let sizes = null;
  if (process.argv.includes("--db-sizes")) {
    const url = process.env.DATABASE_URL ?? "";
    if (!/@(127\.0\.0\.1|localhost|\[::1\]):/.test(url)) throw new Error("--db-sizes only reads a LOCAL disposable database");
    const require = createRequire(path.join(ROOT, "apps/api/package.json"));
    const { Client } = require("pg");
    const c = new Client({ connectionString: url, options: "-c default_transaction_read_only=on" });
    await c.connect();
    sizes = {};
    for (const t of ["works", "phonograms", "transactions", "clients", "shares", "employees", "payroll_entries", "leave_requests", "events", "invoices", "artists"]) {
      const r = await c.query("SELECT pg_total_relation_size(to_regclass($1)) AS s", [`public.${t}`]);
      sizes[t] = r.rows[0].s == null ? null : Number(r.rows[0].s);
    }
    await c.end();
  }
  const drafts = (await import("./legacy-drop-preflight.mjs")).GROUPS ?? [];
  const packages = [...buildPackages(preflight, drafts), ...PII_PACKAGES];
  const md = render(packages, { sizes, generatedFrom: `the read-only pre-flight of the disposable database (${preflight.generated_at}, environment \`${preflight.environment}\`, rehearsal report embedded)` });
  const out = path.resolve(ROOT, arg("--out") ?? "docs/engineering/destructive-approval-dossier");
  fs.writeFileSync(`${out}.md`, md + "\n");
  console.log(`destructive dossier written: ${packages.length} packages (${sha(md).slice(0, 12)})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`destructive-dossier FAILED: ${err.message}`); process.exit(2); });
}
