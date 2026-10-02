/**
 * Frontend Supabase environment guard for dev, build, and preview.
 *
 * Mirrors apps/api/src/core/config/env.schema.ts and scripts/env-check.mjs:
 * - banned preview refs are never allowed;
 * - production/staging builds require real Supabase/API envs;
 * - backend and frontend refs must match when both are visible;
 * - mock/auth bypass flags are forbidden outside local development.
 */
import { loadEnv } from "vite";

// REAL ENVIRONMENT MATRIX:
//   development→DEV_REF · test→no remote · staging→STAGING_REF · production→PROD_REF.
export const SUPABASE_PROD_REF = "sxmfeocztlztvpdnxayk";
export const SUPABASE_STAGING_REF = "jjnnjnxjkqipgqebijen";
export const SUPABASE_DEV_REF = "rypnevnfipygyhysqpdo";
export const SUPABASE_REF_DENYLIST = ["mkyvkciwyhfawmvluugb", "sxdhnhoupjrnntrmjtyn"];
const SUPABASE_ALLOWED_REFS = [SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF];
const SUPABASE_KNOWN_REFS = [SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF];

/** Expected ref per environment. `null` (test) = no remote project accepted. */
function expectedRefFor(nodeEnv) {
  if (nodeEnv === "production") return SUPABASE_PROD_REF;
  if (nodeEnv === "staging") return SUPABASE_STAGING_REF;
  if (nodeEnv === "test") return null;
  return SUPABASE_DEV_REF;
}

/** Cross denylist: known refs of OTHER environments — takes precedence over the allowlist. */
function forbiddenRefsFor(nodeEnv) {
  const expected = expectedRefFor(nodeEnv);
  return SUPABASE_KNOWN_REFS.filter((ref) => ref !== expected);
}

/** The JWT's public payload ({ ref, role }). Never exposes the token. */
function jwtClaims(token) {
  if (!token || token.split(".").length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return { ref: payload.ref ?? null, role: payload.role ?? null };
  } catch {
    return null;
  }
}

export function extractSupabaseRef(value) {
  if (!value) return null;
  const asUrl = /https?:\/\/([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asUrl) return asUrl[1].toLowerCase();
  const asDirectDb = /\bdb\.([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asDirectDb) return asDirectDb[1].toLowerCase();
  const asPoolerUser = /\/\/[a-z0-9_]+\.([a-z0-9]{18,22}):[^@]*@[^/]*pooler\.supabase\.com/i.exec(value);
  if (asPoolerUser) return asPoolerUser[1].toLowerCase();
  return null;
}

/**
 * @param {"development"|"production"} mode
 * @param {string} envDir directory containing the web .env files
 */
export function assertWebSupabaseEnv(mode, envDir) {
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProdLike = nodeEnv === "production" || nodeEnv === "staging";
  const errors = [];

  const webUrl = env.VITE_SUPABASE_URL ?? "";
  const webRef = extractSupabaseRef(webUrl);
  const backendRef = extractSupabaseRef(env.SUPABASE_URL);

  if (webRef && SUPABASE_REF_DENYLIST.includes(webRef)) {
    errors.push(`VITE_SUPABASE_URL points to banned Supabase ref "${webRef}"`);
  }
  if (backendRef && SUPABASE_REF_DENYLIST.includes(backendRef)) {
    errors.push(`SUPABASE_URL points to banned Supabase ref "${backendRef}"`);
  }
  if (backendRef && webRef && backendRef !== webRef) {
    errors.push(
      `SUPABASE_URL (${backendRef}) and VITE_SUPABASE_URL (${webRef}) point to different projects`,
    );
  }

  const expectedRef = expectedRefFor(nodeEnv);
  const forbidden = forbiddenRefsFor(nodeEnv);
  for (const [key, ref] of [["VITE_SUPABASE_URL", webRef], ["SUPABASE_URL", backendRef]]) {
    if (!ref) continue;
    if (forbidden.includes(ref)) {
      errors.push(`${key} uses ref "${ref}" from ANOTHER environment — forbidden in NODE_ENV=${nodeEnv} (cross denylist)`);
    } else if (expectedRef === null) {
      errors.push(`${key} uses remote ref "${ref}" but NODE_ENV=${nodeEnv} accepts no remote Supabase project`);
    } else if (ref !== expectedRef) {
      errors.push(`${key} uses ref "${ref}" but NODE_ENV=${nodeEnv} requires the "${expectedRef}" project`);
    }
  }

  const anonClaims = jwtClaims(env.VITE_SUPABASE_ANON_KEY);
  if (anonClaims) {
    if (anonClaims.ref && forbidden.includes(anonClaims.ref)) {
      errors.push(`VITE_SUPABASE_ANON_KEY payload ref "${anonClaims.ref}" is from ANOTHER environment — forbidden in NODE_ENV=${nodeEnv}`);
    } else if (anonClaims.ref && expectedRef !== null && anonClaims.ref !== expectedRef) {
      errors.push(`VITE_SUPABASE_ANON_KEY payload ref "${anonClaims.ref}" != expected "${expectedRef}"`);
    } else if (anonClaims.ref && expectedRef === null) {
      errors.push(`VITE_SUPABASE_ANON_KEY payload ref "${anonClaims.ref}" but NODE_ENV=${nodeEnv} accepts no remote project`);
    }
    if (anonClaims.role && anonClaims.role !== "anon") {
      errors.push(`VITE_SUPABASE_ANON_KEY role "${anonClaims.role}" (expected "anon" — keys swapped?)`);
    }
  }

  if (isProdLike) {
    if (!webUrl) {
      errors.push(`VITE_SUPABASE_URL is required in ${nodeEnv}`);
    } else if (!webRef || !SUPABASE_ALLOWED_REFS.includes(webRef)) {
      errors.push(
        `VITE_SUPABASE_URL uses ref "${webRef ?? "unknown"}" outside allowlist [${SUPABASE_ALLOWED_REFS.join(", ")}] in ${nodeEnv}`,
      );
    }
    if (nodeEnv === "production" && webRef && webRef !== SUPABASE_PROD_REF) {
      errors.push(`VITE_SUPABASE_URL must use production ref "${SUPABASE_PROD_REF}" in production`);
    }
    if (!env.VITE_SUPABASE_ANON_KEY) {
      errors.push(`VITE_SUPABASE_ANON_KEY is required in ${nodeEnv}`);
    }
    if (!env.VITE_API_URL) {
      errors.push(`VITE_API_URL is required in ${nodeEnv}`);
    }
    for (const flag of ["VITE_AUTH_DISABLED", "VITE_DEV_AUTH_BYPASS"]) {
      if (env[flag] === "true") {
        errors.push(`${flag}=true is forbidden in ${nodeEnv}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("[assert-supabase-env] Invalid Supabase environment:");
    for (const err of errors) console.error(`  - ${err}`);
    console.error("Fix .env values or run pnpm env:check for the full repo gate.");
    process.exit(1);
  }
}
