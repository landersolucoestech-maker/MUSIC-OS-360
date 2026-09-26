#!/usr/bin/env node
/**
 * cleanup-check.mjs — anti-dead-weight gate (pnpm cleanup:check).
 *
 * PERMANENT REPO RULES (fails if violated by NEW material):
 *   1. No tracked temporary files (*.log, *.tmp, *.bak, .DS_Store...).
 *   2. No new tracked audit/historical doc (AUDITORIA_*, P0_*, P1_*,
 *      *_REPORT.md, EXECUCAO_* ...) — reports are ephemeral, they do not go into git.
 *   3. No banned Supabase ref (preview branch) in any file or .env.
 *   4. No asset in apps/web/public without a proven reference.
 *   5. No package.json script pointing to a nonexistent file.
 *   6. No workspace dep (@music-os-360/*) declared without use.
 *   7. No tracked alternative .env file name — only .env.development/
 *      .env.staging/.env.production (root, apps/api, apps/web).
 *
 * Detecting dead imports/unused npm deps is delegated to `pnpm typecheck` +
 * knip/depcheck/ts-prune (root devDeps) — run them manually before releases.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SUPABASE_REF_DENYLIST = ["mkyvkciwyhfawmvluugb"];

// The only files authorized to MENTION banned refs: they are the guards themselves.
const GUARD_FILE_ALLOWLIST = new Set([
  "apps/api/src/core/config/env.schema.ts",
  "apps/web/src/shared/lib/env.ts",
  "apps/web/scripts/assert-supabase-env.mjs",
  "scripts/env-check.mjs",
  "scripts/cleanup/cleanup-check.mjs",
]);

// Historical docs that ALREADY existed when the gate was created (2026-07-04).
// Do not add new items here without an explicit architecture decision.
// CLEANUP_REPORT.md moved from root/ (tracked, baseline below) to reports/
// (untracked, the same convention as everything else in reports/) — Part 81.
const HISTORICAL_DOC_BASELINE = new Set([]);

const JUNK_PATTERN = /\.(log|tmp|bak|orig|rej)$|~$|(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$|(^|\/)\.tmp-/i;
const HISTORICAL_DOC_PATTERN = /(AUDITORIA|LEVANTAMENTO|_REPORT|_AUDIT|^P0_|\/P0_|^P1_|\/P1_|EXECUCAO_|RUNBOOK_STAGING)/i;

const errors = [];

function git(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  } catch (err) {
    if (err.status === 1) return ""; // git grep sem matches
    throw err;
  }
}

const trackedFiles = git(["ls-files"]).split(/\r?\n/).filter(Boolean);

// ── 1. Tracked temporary files ───────────────────────────────────────────────
for (const file of trackedFiles) {
  if (JUNK_PATTERN.test(file)) {
    errors.push(`arquivo temporário rastreado: ${file}`);
  }
}

// ── 2. New historical docs (.md only) ────────────────────────────────────────
for (const file of trackedFiles) {
  if (!file.endsWith(".md")) continue;
  if (HISTORICAL_DOC_PATTERN.test(file) && !HISTORICAL_DOC_BASELINE.has(file)) {
    errors.push(`doc histórico/auditoria novo rastreado (proibido): ${file}`);
  }
}

// ── 3. Refs Supabase banidos ──────────────────────────────────────────────────
for (const banned of SUPABASE_REF_DENYLIST) {
  const hits = git(["grep", "-l", banned, "--", "."]);
  for (const file of hits.split(/\r?\n/).filter(Boolean)) {
    if (GUARD_FILE_ALLOWLIST.has(file.replace(/\\/g, "/"))) continue;
    errors.push(`ref Supabase banido "${banned}" em arquivo rastreado: ${file}`);
  }
}
const envCandidates = [
  ".env.development", ".env.staging", ".env.production",
  "apps/api/.env.development", "apps/api/.env.staging", "apps/api/.env.production",
  "apps/web/.env.development", "apps/web/.env.staging", "apps/web/.env.production",
];
for (const rel of envCandidates) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const banned of SUPABASE_REF_DENYLIST) {
    if (content.includes(banned)) errors.push(`ref Supabase banido "${banned}" em ${rel}`);
  }
}

// ── 3b. .env naming — only .env.development/.env.staging/.env.production ──
// (Systemic homologation: apps/api and apps/web consolidated to the same pattern
// already used at the root. Any tracked alternative name is a regression.)
const LEGACY_ENV_PATTERN = /(^|\/)\.env(\.example|\.dev\.example|\.production\.template|\.local|\.staging\.example|\.production\.example|\.backup.*|\.fase\d+.*)?$/;
for (const file of trackedFiles) {
  const normalized = file.replace(/\\/g, "/");
  if (!LEGACY_ENV_PATTERN.test(normalized)) continue;
  const base = normalized.split("/").pop();
  const isCanonical = base === ".env.development" || base === ".env.staging" || base === ".env.production";
  if (!isCanonical) {
    errors.push(`nome de env alternativo rastreado (proibido): ${file}`);
  }
}

// ── 4. Orphan assets in apps/web/public ──────────────────────────────────────
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function concatSources(dir, exts) {
  let bundle = "";
  for (const file of listFiles(dir)) {
    if (exts.some((ext) => file.endsWith(ext))) bundle += fs.readFileSync(file, "utf8");
  }
  return bundle;
}

const publicDir = path.join(repoRoot, "apps/web/public");
const searchSpace =
  concatSources(path.join(repoRoot, "apps/web/src"), [".ts", ".tsx", ".css", ".html"]) +
  concatSources(path.join(repoRoot, "apps/api/src"), [".ts"]) +
  (fs.existsSync(path.join(repoRoot, "apps/web/index.html"))
    ? fs.readFileSync(path.join(repoRoot, "apps/web/index.html"), "utf8")
    : "");

for (const asset of listFiles(publicDir)) {
  const name = path.basename(asset);
  if (!searchSpace.includes(name)) {
    errors.push(`asset órfão em apps/web/public (0 referências): ${path.relative(repoRoot, asset)}`);
  }
}

// ── 5. package.json scripts pointing to nonexistent files ───────────────────
const pkgFiles = ["package.json", "apps/api/package.json", "apps/web/package.json"].concat(
  fs.readdirSync(path.join(repoRoot, "packages")).map((p) => `packages/${p}/package.json`),
);
for (const rel of pkgFiles) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  const pkgDir = path.dirname(file);
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    const match = /(?:^|[\s&|;])(?:node|tsx)\s+(?!-)([^\s&|;"']+\.(?:mjs|cjs|js|ts))/.exec(cmd);
    if (match && !fs.existsSync(path.resolve(pkgDir, match[1]))) {
      errors.push(`script quebrado em ${rel} → "${name}": arquivo ${match[1]} não existe`);
    }
  }
}

// ── 6. Workspace deps declaradas sem uso ──────────────────────────────────────
for (const rel of ["apps/api/package.json", "apps/web/package.json"]) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const appSrc = concatSources(path.join(repoRoot, path.dirname(rel), "src"), [".ts", ".tsx"]);
  for (const dep of Object.keys(deps)) {
    if (!dep.startsWith("@music-os-360/")) continue;
    if (!appSrc.includes(dep)) {
      errors.push(`workspace dep declarada sem uso em ${rel}: ${dep}`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error("❌ cleanup:check FALHOU — peso morto novo detectado:");
  for (const err of errors) console.error(`  • ${err}`);
  process.exit(1);
}
console.log("✅ cleanup:check OK — nenhum peso morto novo (temp/docs/refs/assets/scripts/deps)");
