#!/usr/bin/env node
/**
 * release-check.mjs — Cutover (go-live) gate of MUSIC OS 360.
 *
 * Two modes:
 *   node scripts/release-check.mjs            → "check"  (READ-ONLY, safe at any time)
 *   node scripts/release-check.mjs --migrate  → "migrate" (applies db:migrate before the checks)
 *
 * Chains the steps in order, FAILS FAST at the first one that breaks and prints
 * a PASS/FAIL summary at the end. The database steps require Postgres to be
 * reachable (DATABASE_URL); if it is not, the step is reported as FAIL with the
 * cause (ECONNREFUSED) — run it in an environment where the database responds.
 *
 * No "check" step writes to the database. Only "--migrate" applies schema.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATE = process.argv.includes("--migrate");

/** @type {{ name: string, cmd: string, writes?: boolean }[]} */
const steps = [
  // Cheap, build-free checks first (RELEASE-01, RBAC-SHADOW-01, DBCTX-01).
  { name: "Critical workflows present",   cmd: "node scripts/verify-critical-workflows.mjs" },
  { name: "Production flags (RBAC/DBCTX)", cmd: "corepack pnpm --filter @music-os-360/api verify:production-flags" },
  { name: "Web typecheck (0 errors)",        cmd: "corepack pnpm --filter @music-os-360/web typecheck" },
  { name: "API build (tsc)",                cmd: "corepack pnpm --filter @music-os-360/api build" },
  { name: "Web build (vite, MOCK off)",     cmd: "corepack pnpm --filter @music-os-360/web build" },
  { name: "Production source/mock audit",   cmd: "node scripts/check-production-source.mjs" },
  { name: "DB: migrations pendentes",       cmd: "corepack pnpm --filter @music-os-360/api db:check" },
  ...(MIGRATE
    ? [{ name: "DB: aplicar migrations", cmd: "corepack pnpm --filter @music-os-360/api db:migrate", writes: true }]
    : []),
  { name: "RLS fail-closed",                cmd: "corepack pnpm --filter @music-os-360/api verify:rls" },
  { name: "Tenant isolation",          cmd: "corepack pnpm --filter @music-os-360/api verify:tenant-isolation" },
];

const results = [];
let failed = false;

console.log(`\n=== MUSIC OS 360 — release ${MIGRATE ? "MIGRATE" : "CHECK"} ===`);
console.log(`Steps: ${steps.length}. Mode: ${MIGRATE ? "applies schema" : "read-only"}.\n`);

for (const step of steps) {
  if (failed) { results.push({ name: step.name, status: "SKIP" }); continue; }
  process.stdout.write(`▶ ${step.name} … `);
  try {
    execSync(step.cmd, { cwd: root, stdio: "pipe", shell: true });
    console.log("PASS");
    results.push({ name: step.name, status: "PASS" });
  } catch (err) {
    console.log("FAIL");
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    const reason = /ECONNREFUSED/.test(out)
      ? "database unreachable (ECONNREFUSED) — run where Postgres responds"
      : (out.split("\n").filter(Boolean).slice(-3).join(" | ") || err.message);
    results.push({ name: step.name, status: "FAIL", reason });
    failed = true;
  }
}

console.log("\n=== SUMMARY ===");
for (const r of results) {
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️ ";
  console.log(`${icon} ${r.status.padEnd(4)} — ${r.name}${r.reason ? `\n        ↳ ${r.reason}` : ""}`);
}

if (failed) {
  console.log("\n❌ Release gate REJECTED. Fix the step above and run again.\n");
  process.exit(1);
}
console.log(`\n✅ Release gate APPROVED${MIGRATE ? " (migrations applied)" : ""}. Cleared to proceed with the cutover.\n`);
