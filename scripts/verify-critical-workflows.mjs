#!/usr/bin/env node
/**
 * verify-critical-workflows.mjs — RELEASE-01 guard.
 *
 * Confirms the 4 critical GitHub Actions workflows are present in the current
 * working tree, non-empty, and syntactically valid YAML. This does NOT prove
 * they exist on the `main` default branch (that requires the actual merge —
 * see docs/runbooks/staging-to-production.md) — it only prevents this branch
 * from silently losing one of them again in the future.
 *
 * Usage: node scripts/verify-critical-workflows.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS_DIR = path.join(repoRoot, ".github", "workflows");
const REQUIRED = ["ci.yml", "security.yml", "staging.yml", "backup.yml"];
const MIN_BYTES = 200;

let yaml = null;
try {
  ({ default: yaml } = await import("js-yaml"));
} catch {
  // js-yaml is not resolvable (not a direct dependency) — continues with only the
  // structural presence/size check, without deep parsing.
}

const errors = [];
const warnings = [];

for (const name of REQUIRED) {
  const file = path.join(WORKFLOWS_DIR, name);
  if (!fs.existsSync(file)) {
    errors.push(`${name}: ausente em .github/workflows/`);
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  if (content.trim().length < MIN_BYTES) {
    errors.push(`${name}: presente mas vazio/truncado (${content.trim().length} bytes)`);
    continue;
  }
  if (yaml) {
    try {
      yaml.load(content);
    } catch (err) {
      errors.push(`${name}: invalid YAML — ${String(err.message ?? err).split("\n")[0]}`);
    }
  } else {
    warnings.push(`${name}: present (js-yaml unavailable — syntax parse skipped)`);
  }
}

for (const w of warnings) console.warn(`⚠️  ${w}`);

if (errors.length > 0) {
  console.error("❌ verify:critical-workflows FAILED (RELEASE-01):");
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    "\nThese 4 workflows are required by the release gate (release-check.mjs) and by the " +
      "runbook docs/runbooks/staging-to-production.md. Lembrete: isto valida o WORKING " +
      "current TREE — confirm separately that they are merged into `main` " +
      "(git ls-tree origin/main -- .github/workflows).\n",
  );
  process.exit(1);
}

console.log(
  `✓ verify:critical-workflows — ${REQUIRED.length} workflows present, not empty` +
    `${yaml ? " and with valid YAML" : ""} in the current working tree.`,
);

// The same cheap gate also ensures no legacy spreadsheet format
// reappears in code, configuration, documentation or dependencies.
await import("./verify-xlsx-only.mjs");
