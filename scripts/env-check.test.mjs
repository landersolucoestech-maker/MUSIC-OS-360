import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEV_REF = "rypnevnfipygyhysqpdo";
const PROD_REF = "sxmfeocztlztvpdnxayk";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (ref, role) => `${b64({ alg: "HS256" })}.${b64({ ref, role })}.sig`;

/** A throw-away repository containing only the script under test and the env files of the scenario. */
function scenario({ api, web }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "env-check-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(here, "env-check.mjs"), path.join(root, "scripts/env-check.mjs"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  const write = (rel, vars) => {
    if (!vars) return;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  };
  write("apps/api/.env.development", api);
  write("apps/web/.env.development", web);
  const run = spawnSync(process.execPath, [path.join(root, "scripts/env-check.mjs")], { cwd: root, encoding: "utf8" });
  fs.rmSync(root, { recursive: true, force: true });
  return run;
}

const goodApi = (ref = DEV_REF) => ({ NODE_ENV: "development", DATABASE_URL: `postgresql://u:pw@db.${ref}.supabase.co:5432/postgres`, SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_ANON_KEY: jwt(ref, "anon") });
const goodWeb = (ref = DEV_REF) => ({ VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_ANON_KEY: jwt(ref, "anon"), VITE_API_URL: "http://localhost:3001" });

test("a coherent development environment passes to the end (the success line must not throw)", () => {
  const run = scenario({ api: goodApi(), web: goodWeb() });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /env:check OK/);
  assert.doesNotMatch(run.stderr, /ReferenceError/);
  assert.match(run.stdout, /\(development\)/);
});

test("the success path never prints a secret value", () => {
  const run = scenario({ api: goodApi(), web: goodWeb() });
  assert.doesNotMatch(run.stdout + run.stderr, /postgresql:\/\/|pw@|eyJ/);
});

test("mutation: a production ref in the development environment fails", () => {
  const run = scenario({ api: goodApi(PROD_REF), web: goodWeb(PROD_REF) });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ANOTHER environment/);
});

test("mutation: frontend and backend on different projects fail", () => {
  const run = scenario({ api: goodApi(), web: goodWeb(PROD_REF) });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /DIFFERENT Supabase projects|ANOTHER environment/);
});

test("mutation: a missing apps/web/.env.development fails", () => {
  const run = scenario({ api: goodApi(), web: null });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /apps\/web\/\.env\.development missing/);
});

test("mutation: a missing required backend variable fails", () => {
  const api = goodApi();
  delete api.DATABASE_URL;
  const run = scenario({ api, web: goodWeb() });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /required backend env missing\/empty: DATABASE_URL/);
});

test("mutation: an auth bypass flag in a production-like environment fails", () => {
  const run = scenario({ api: { ...goodApi(), NODE_ENV: "staging", AUTH_DISABLED: "true" }, web: goodWeb() });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /AUTH_DISABLED \(api\)=true is forbidden/);
});

test("mutation: swapped keys (service_role in the anon slot) fail", () => {
  const run = scenario({ api: { ...goodApi(), SUPABASE_ANON_KEY: jwt(DEV_REF, "service_role") }, web: goodWeb() });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /service_role|swapped/);
});
