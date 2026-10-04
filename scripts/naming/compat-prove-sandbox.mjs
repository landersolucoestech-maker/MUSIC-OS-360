#!/usr/bin/env node
/**
 * scripts/naming/compat-prove-sandbox.mjs: (re)builds docs/naming/audit/compat-mutation-proof.json on SANDBOX COPIES.
 *
 *   node scripts/naming/compat-prove-sandbox.mjs [--shards N] [--rebind] [--only <path-substring>] [--keep]
 *
 * compat-mutation-proof.mjs rewrites source files, so it refuses to run on the working tree. This wrapper does the safe thing:
 * it copies the repository (without .git, node_modules, .claude/ops, build output) into N temporary directories, links the
 * node_modules folders, seeds every shard with the current proof file (a pair already judged against the SAME bytes of the file and
 * of its test is resumed, never re-run), runs the shards in parallel, merges the fresh records and writes the proof file. The copy is
 * removed afterwards (--keep leaves it for inspection). `--rebind` also tries tests that were not declared by a row (candidates).
 *
 * The proof file binds every result to sha256 of the runtime file and of the test: any later edit of either makes the pair stale
 * (the audit counts it as unproven), and the fix is to run this script again (only the stale pairs are re-run).
 * Typical cost: minutes when few pairs changed, a few hours from scratch (jest/vitest per mutation).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
// --proof <file>: read/write an isolated proof file (several people can verify their pairs in parallel without touching the shared one)
const PROOF = arg("--proof") ? path.resolve(arg("--proof")) : path.join(REPO, "docs/naming/audit/compat-mutation-proof.json");
const has = (n) => process.argv.includes(n);
const sha = (p) => (fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null);

const SKIP = /(^|\/)(node_modules|graphify-out|dist|coverage|playwright-report|\.git)(\/|$)/;
const skip = (rel) => SKIP.test(rel) || rel === ".claude/ops" || rel.startsWith(".claude/ops/");

function makeSandbox(dir) {
  fs.cpSync(REPO, dir, { recursive: true, filter: (src) => !skip(path.relative(REPO, src).split(path.sep).join("/")) });
  const mods = [".", "apps/api", "apps/web", ...fs.readdirSync(path.join(REPO, "packages")).map((p) => `packages/${p}`)];
  for (const m of mods) {
    const nm = path.join(REPO, m, "node_modules");
    if (fs.existsSync(nm) && fs.existsSync(path.join(dir, m))) fs.symlinkSync(nm, path.join(dir, m, "node_modules"));
  }
}

/** Per pair, the record whose hashes match the CURRENT repo bytes wins (preferring the one that ran the most mutations). */
export function mergeResults(lists, fileSha = sha) {
  const byKey = new Map();
  for (const list of lists) for (const r of list) byKey.set(`${r.file}\u0000${r.test}`, [...(byKey.get(`${r.file}\u0000${r.test}`) ?? []), r]);
  const out = [];
  for (const records of byKey.values()) {
    const fresh = records.filter((r) => fileSha(path.join(REPO, r.file)) === r.fileSha256 && (!r.testSha256 || fileSha(path.join(REPO, r.test)) === r.testSha256));
    // a strict (exhaustive) record always outranks a non-exhaustive one from an older run, whatever its mutation count; then the most mutations
    fresh.sort((a, b) => Number(b.exhaustive === true) - Number(a.exhaustive === true) || (b.mutations?.length ?? 0) - (a.mutations?.length ?? 0));
    out.push(fresh[0] ?? records[0]);
  }
  return out.sort((a, b) => (a.file + a.test).localeCompare(b.file + b.test));
}

async function main() {
  const shards = Math.max(1, Number(arg("--shards") ?? 3));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "compat-prove-"));
  const seed = fs.existsSync(PROOF) ? JSON.parse(fs.readFileSync(PROOF, "utf8")) : { schemaVersion: 1, results: [] };
  const procs = [];
  for (let i = 0; i < shards; i++) {
    const root = path.join(tmp, `root${i}`);
    makeSandbox(root);
    const out = path.join(tmp, `out${i}.json`);
    fs.writeFileSync(out, JSON.stringify(seed));
    const args = [path.join(here, "compat-mutation-proof.mjs"), "--root", root, "--shard", `${i}/${shards}`, "--out", out];
    if (has("--rebind")) { const rb = path.join(tmp, "rebind.json"); fs.writeFileSync(rb, JSON.stringify(seed)); args.push("--rebind", rb); }
    if (arg("--only")) args.push("--only", arg("--only"));
    const child = spawn(process.execPath, args, { stdio: ["ignore", "inherit", "inherit"], cwd: REPO });
    procs.push(new Promise((resolve) => child.on("exit", (code) => resolve({ i, code, out }))));
    console.log(`shard ${i}/${shards} pid ${child.pid}`);
  }
  const done = await Promise.all(procs);
  const failed = done.filter((d) => d.code !== 0);
  if (failed.length) { console.error(`shards failed: ${failed.map((f) => `${f.i} (exit ${f.code})`).join(", ")}; proof file NOT written (sandbox kept at ${tmp})`); process.exit(1); }
  const merged = mergeResults(done.map((d) => JSON.parse(fs.readFileSync(d.out, "utf8")).results));
  fs.mkdirSync(path.dirname(PROOF), { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify({ schemaVersion: 1, results: merged }, null, 1) + "\n");
  console.log(`proof file written: ${merged.length} pairs`);
  if (!has("--keep")) fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`compat-prove-sandbox FAILED: ${err.stack ?? err.message}`); process.exit(2); });
}
