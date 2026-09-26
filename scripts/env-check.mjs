#!/usr/bin/env node
/**
 * env-check.mjs — Supabase environment coherence gate (pnpm env:check).
 *
 * Validates, without printing secrets:
 *   1. No banned Supabase ref (denylist) in .env*, tracked code, workflows or scripts.
 *   2. Frontend (VITE_SUPABASE_URL) and backend (SUPABASE_URL/DATABASE_URL/APP_DATABASE_URL)
 *      point to the SAME Supabase project.
 *   3. The ref in use belongs to the environment's allowlist.
 *   4. Mandatory envs present and non-empty.
 *   5. Mock/auth-bypass forbidden outside development and coherent between web and api.
 *
 * Mirrors the constants of:
 *   - apps/api/src/core/config/env.schema.ts
 *   - apps/web/scripts/assert-supabase-env.mjs
 * Any change of refs must be replicated in all three places.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ENVIRONMENT MATRIX (mirror of env.schema.ts; incident 2026-07-16/17):
//   development→DEV_REF · test→no remote · staging→STAGING_REF · production→PROD_REF.
// The main Supabase project is the production target and stays blocked until the formal release.
const SUPABASE_PROD_REF = "sxmfeocztlztvpdnxayk";
// Persistent STAGING branch of the MAIN project, created in Part 65 (2026-08-01).
// Replaces the reserved placeholder ('khnaxcgjnvhhtgkozsif') that never
// matched a real resource.
const SUPABASE_STAGING_REF = "jjnnjnxjkqipgqebijen";
const SUPABASE_DEV_REF = "rypnevnfipygyhysqpdo";
const SUPABASE_REF_DENYLIST = ["mkyvkciwyhfawmvluugb", "sxdhnhoupjrnntrmjtyn"];
const SUPABASE_ALLOWED_REFS = [SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF];
const SUPABASE_KNOWN_REFS = [SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF];

/**
 * Expected Supabase ref for each NODE_ENV — absolute environment isolation.
 * `null` (test) = no remote project accepted, no silent fallback.
 */
function expectedRefFor(nodeEnv) {
  if (nodeEnv === "production") return SUPABASE_PROD_REF;
  if (nodeEnv === "staging") return SUPABASE_STAGING_REF;
  if (nodeEnv === "test") return null;
  return SUPABASE_DEV_REF;
}

/** Denylist cruzada: refs conhecidos de OUTROS ambientes — prevalece sobre allowlist. */
function forbiddenRefsFor(nodeEnv) {
  const expected = expectedRefFor(nodeEnv);
  return SUPABASE_KNOWN_REFS.filter((ref) => ref !== expected);
}

/** Decodes only the JWT's public payload and returns { ref, role }. Never prints the token. */
function jwtClaims(token) {
  if (!token || typeof token !== "string" || token.split(".").length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return { ref: payload.ref ?? null, role: payload.role ?? null };
  } catch {
    return null;
  }
}

// The only files authorized to MENTION banned refs: they are the guards themselves.
const GUARD_FILE_ALLOWLIST = new Set([
  "apps/api/src/core/config/env.schema.ts",
  "apps/api/src/core/config/env.schema.spec.ts",
  "apps/api/src/core/config/verify-supabase-dev-ref.util.spec.ts",
  "apps/api/src/database/financial-migrations.static.spec.ts",
  "apps/web/src/shared/lib/env.ts",
  "apps/web/scripts/assert-supabase-env.mjs",
  "scripts/env-check.mjs",
  "scripts/cleanup/cleanup-check.mjs",
  "docs/SUPABASE_ENVIRONMENTS.md",
]);

const errors = [];
const warnings = [];

function extractSupabaseRef(value) {
  if (!value) return null;
  const asUrl = /https?:\/\/([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asUrl) return asUrl[1].toLowerCase();
  const asDirectDb = /\bdb\.([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asDirectDb) return asDirectDb[1].toLowerCase();
  const asPoolerUser = /\/\/[a-z0-9_]+\.([a-z0-9]{18,22}):[^@]*@[^/]*pooler\.supabase\.com/i.exec(value);
  if (asPoolerUser) return asPoolerUser[1].toLowerCase();
  return null;
}

/** KEY=VALUE parser identical to loadLocalEnv in apps/api/src/main.ts. */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const vars = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const raw = trimmed.slice(sep + 1).trim();
    if (key) vars[key] = raw.replace(/^["']|["']$/g, "");
  }
  return vars;
}

// ── 1. Denylist in tracked files (code, workflows, configs) ───────────────────
for (const banned of SUPABASE_REF_DENYLIST) {
  let hits = "";
  try {
    hits = execFileSync("git", ["grep", "-l", banned, "--", "."], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch {
    // exit code 1 = no matches (the desired result)
  }
  for (const file of hits.split(/\r?\n/).filter(Boolean)) {
    if (GUARD_FILE_ALLOWLIST.has(file.replace(/\\/g, "/"))) continue;
    errors.push(`banned ref "${banned}" found in a tracked file: ${file}`);
  }
}

// ── 1b. Denylist in all .env* files (untracked) ───────────────────────────────
const envFiles = [
  ".env.development",
  ".env.staging",
  ".env.production",
  "apps/api/.env.development",
  "apps/api/.env.staging",
  "apps/api/.env.production",
  "apps/web/.env.development",
  "apps/web/.env.staging",
  "apps/web/.env.production",
].map((p) => path.join(repoRoot, p));

for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const banned of SUPABASE_REF_DENYLIST) {
    if (content.includes(banned)) {
      errors.push(`banned ref "${banned}" found in ${path.relative(repoRoot, file)}`);
    }
  }
}

// ── 2–5. Coherence of the effective envs ─────────────────────────────────────
const rootEnv = parseEnvFile(path.join(repoRoot, ".env.development")) ?? {};
const apiFileEnv = parseEnvFile(path.join(repoRoot, "apps/api/.env.development"));
const webEnv = parseEnvFile(path.join(repoRoot, "apps/web/.env.development"));

if (!apiFileEnv) warnings.push("apps/api/.env.development missing — the API will depend on the root .env.development/process.env");
if (!webEnv) errors.push("apps/web/.env.development missing — frontend without VITE_SUPABASE_URL defined");

// Real precedence: main.ts loads apps/api/.env.development first and does NOT overwrite it with the root one.
const apiEnv = { ...rootEnv, ...(apiFileEnv ?? {}) };
const web = webEnv ?? {};

const nodeEnv = apiEnv.NODE_ENV ?? "development";
const isProdLike = nodeEnv === "production" || nodeEnv === "staging";

// Mandatory non-empty envs
const requiredApi = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
const requiredWeb = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_URL"];
for (const key of requiredApi) {
  if (!apiEnv[key]) errors.push(`required backend env missing/empty: ${key}`);
}
for (const key of requiredWeb) {
  if (!web[key]) errors.push(`required frontend env missing/empty (apps/web/.env.development): ${key}`);
}

// Refs por origem
const refSources = [
  ["SUPABASE_URL (api)", extractSupabaseRef(apiEnv.SUPABASE_URL)],
  ["DATABASE_URL (api)", extractSupabaseRef(apiEnv.DATABASE_URL)],
  ["APP_DATABASE_URL (api)", extractSupabaseRef(apiEnv.APP_DATABASE_URL)],
  ["VITE_SUPABASE_URL (web)", extractSupabaseRef(web.VITE_SUPABASE_URL)],
];

const expectedRef = expectedRefFor(nodeEnv);
const forbiddenRefs = forbiddenRefsFor(nodeEnv);

for (const [label, ref] of refSources) {
  if (!ref) continue;
  if (SUPABASE_REF_DENYLIST.includes(ref)) {
    errors.push(`${label} uses the banned ref "${ref}" (preview branch without public tables)`);
    continue;
  }
  // Cross denylist: a known ref of ANOTHER environment is always forbidden,
  // even if an allowlist was edited incorrectly.
  if (forbiddenRefs.includes(ref)) {
    errors.push(
      `${label} uses ref "${ref}" from ANOTHER environment — forbidden with NODE_ENV=${nodeEnv} (cross denylist)`,
    );
    continue;
  }
  if (expectedRef === null) {
    errors.push(
      `${label} uses remote ref "${ref}" but NODE_ENV=${nodeEnv} accepts no remote Supabase project`,
    );
  } else if (ref !== expectedRef) {
    errors.push(
      `${label} uses ref "${ref}" but NODE_ENV=${nodeEnv} requires the ${nodeEnv} project "${expectedRef}"`,
    );
  }
}

const resolved = refSources.filter(([, ref]) => ref !== null);
const distinct = [...new Set(resolved.map(([, ref]) => ref))];
if (distinct.length > 1) {
  errors.push(
    `frontend and backend point to DIFFERENT Supabase projects: ${resolved
      .map(([label, ref]) => `${label}=${ref}`)
      .join(" · ")}`,
  );
}

// ── ref × JWT payload coherence (anon and service role) ──────────────────────
// The token's ref MUST match the URLs' ref; anon can never be service_role.
const jwtSources = [
  ["SUPABASE_ANON_KEY (api)", apiEnv.SUPABASE_ANON_KEY, "anon"],
  ["VITE_SUPABASE_ANON_KEY (web)", web.VITE_SUPABASE_ANON_KEY, "anon"],
  ["SUPABASE_SERVICE_ROLE_KEY (api)", apiEnv.SUPABASE_SERVICE_ROLE_KEY, "service_role"],
];
for (const [label, token, expectedRole] of jwtSources) {
  if (!token) continue;
  const claims = jwtClaims(token);
  if (!claims) {
    errors.push(`${label} is not a decodable JWT`);
    continue;
  }
  if (claims.ref && forbiddenRefs.includes(claims.ref)) {
    errors.push(`${label} has payload ref "${claims.ref}" from ANOTHER environment — forbidden with NODE_ENV=${nodeEnv}`);
  } else if (claims.ref && expectedRef !== null && claims.ref !== expectedRef) {
    errors.push(`${label} has payload ref "${claims.ref}" ≠ expected project "${expectedRef}"`);
  } else if (claims.ref && expectedRef === null) {
    errors.push(`${label} has payload ref "${claims.ref}" but NODE_ENV=${nodeEnv} accepts no remote project`);
  }
  if (claims.role && claims.role !== expectedRole) {
    errors.push(`${label} has role "${claims.role}" in the payload (expected "${expectedRole}" — swapped keys?)`);
  }
}

// VITE_API_URL bem formada
if (web.VITE_API_URL && !/^https?:\/\//.test(web.VITE_API_URL)) {
  errors.push(`invalid VITE_API_URL: "${web.VITE_API_URL}" (expected http(s)://host[:port])`);
}

// Mock / auth bypass
const mockFlags = [
  ["USE_MOCK (api)", apiEnv.USE_MOCK],
  ["MOCK_MODE (api)", apiEnv.MOCK_MODE],
  ["VITE_USE_MOCK (web)", web.VITE_USE_MOCK],
  ["VITE_MOCK_MODE (web)", web.VITE_MOCK_MODE],
];
if (isProdLike) {
  for (const [label, value] of mockFlags) {
    if (value === "true") errors.push(`${label}=true is forbidden with NODE_ENV=${nodeEnv}`);
  }
  if (apiEnv.AUTH_DISABLED === "true" || web.VITE_AUTH_DISABLED === "true") {
    errors.push(`auth bypass (AUTH_DISABLED/VITE_AUTH_DISABLED) is forbidden with NODE_ENV=${nodeEnv}`);
  }
}
const apiMock = apiEnv.USE_MOCK === "true" || apiEnv.MOCK_MODE === "true";
const webMock = web.VITE_USE_MOCK === "true" || web.VITE_MOCK_MODE === "true";
if (apiMock !== webMock) {
  errors.push(
    `mock mode mismatch: api=${apiMock} vs web=${webMock} — frontend and backend must run in the same mode`,
  );
}

// ── Report ────────────────────────────────────────────────────────────────────
for (const warning of warnings) console.warn(`⚠️  ${warning}`);
if (errors.length > 0) {
  console.error("❌ env:check FAILED:");
  for (const err of errors) console.error(`  • ${err}`);
  process.exit(1);
}

const envLabel =
  distinct[0] === SUPABASE_PROD_REF
    ? "production"
    : distinct[0] === SUPABASE_STAGING_REF
      ? "staging"
      : distinct[0] === SUPABASE_DEV_REF
        ? "desenvolvimento"
        : "?";
console.log(
  `✅ env:check OK — ref Supabase "${distinct[0] ?? "n/d"}" ` +
    `(${envLabel}) · ` +
    `NODE_ENV=${nodeEnv} · mock=${webMock ? "ON" : "off"} · frontend↔backend alinhados`,
);
