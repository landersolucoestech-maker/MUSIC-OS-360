import { z } from 'zod';
import { isProdLike as isProdLikeEnv } from './runtime-environment';

// ── Supabase environment guard ────────────────────────────────────────────────
// Single source of truth for the refs allowed per environment. The frontend mirrors
// this list in apps/web/scripts/assert-supabase-env.mjs and the repo gate in
// scripts/env-check.mjs — any change must be made in all three places.
//
// ENVIRONMENT MATRIX (isolation incident 2026-07-16/17):
//   development → ONLY DEV_REF; STAGING/PROD explicitly forbidden.
//   test        → NO remote project (no silent fallback to DEV).
//   staging     → ONLY STAGING_REF.
//   production  → ONLY PROD_REF.
// The MAIN Supabase project is the production environment and stays untouched until the formal release.
export const SUPABASE_PROD_REF = 'sxmfeocztlztvpdnxayk';
/** Persistent STAGING branch of the MAIN Supabase project, created in Part 65
 * (2026-08-01) via mcp__Supabase__create_branch. Replaces the previously reserved
 * value ('khnaxcgjnvhhtgkozsif') that never matched a real
 * resource — the placeholder stayed unused until this ref was confirmed. */
export const SUPABASE_STAGING_REF = 'jjnnjnxjkqipgqebijen';
/** Legacy alias for operational guards that explicitly block production. */
export const SUPABASE_MAIN_REF = SUPABASE_PROD_REF;
/** DEV branch of the Supabase project (the only ref accepted in development). */
export const SUPABASE_DEV_REF = 'rypnevnfipygyhysqpdo';
/** Refs banned from ANY runtime (previews/deleted branches). */
export const SUPABASE_REF_DENYLIST: readonly string[] = [
  'mkyvkciwyhfawmvluugb',
  'sxdhnhoupjrnntrmjtyn', // old DEV branch, deleted on 2026-07-17
];
export const SUPABASE_ALLOWED_REFS: readonly string[] = [
  SUPABASE_PROD_REF,
  SUPABASE_STAGING_REF,
  SUPABASE_DEV_REF,
];
/** All known refs (for the per-environment cross denylist). */
export const SUPABASE_KNOWN_REFS: readonly string[] = [
  SUPABASE_PROD_REF,
  SUPABASE_STAGING_REF,
  SUPABASE_DEV_REF,
];

/**
 * Expected ref per NODE_ENV — absolute isolation: each environment accepts ONLY
 * its own project. `null` means "no remote project is accepted" (test):
 * any resolved Supabase ref is an error, with no silent fallback.
 */
export function expectedSupabaseRef(nodeEnv: string | undefined): string | null {
  if (nodeEnv === 'production') return SUPABASE_PROD_REF;
  if (nodeEnv === 'staging') return SUPABASE_STAGING_REF;
  if (nodeEnv === 'test') return null;
  return SUPABASE_DEV_REF;
}

/**
 * Explicit cross denylist: known refs of OTHER environments are forbidden
 * even if an allowlist was edited incorrectly. It takes precedence over
 * any permissive configuration.
 */
export function forbiddenSupabaseRefs(nodeEnv: string | undefined): readonly string[] {
  const expected = expectedSupabaseRef(nodeEnv);
  return SUPABASE_KNOWN_REFS.filter((ref) => ref !== expected);
}

/**
 * Pure, testable core of the bootstrap guard (consumed by main.ts).
 * Jointly validates URLs, connection strings, JWTs and the coherence between them.
 * Returns the list of errors (empty = valid environment). Never exposes secrets.
 */
export function collectSupabaseEnvErrors(
  env: Record<string, string | undefined>,
  nodeEnvInput?: string,
): string[] {
  const nodeEnv = nodeEnvInput ?? env['NODE_ENV'] ?? 'development';
  const expectedRef = expectedSupabaseRef(nodeEnv);
  const forbidden = forbiddenSupabaseRefs(nodeEnv);
  const prodLike = nodeEnv === 'production' || nodeEnv === 'staging';
  const errors: string[] = [];

  const refSources: Array<[string, string | undefined]> = [
    ['SUPABASE_URL', env['SUPABASE_URL']],
    ['DATABASE_URL', env['DATABASE_URL']],
    ['DIRECT_DATABASE_URL', env['DIRECT_DATABASE_URL']],
    ['APP_DATABASE_URL', env['APP_DATABASE_URL']],
    ['VITE_SUPABASE_URL', env['VITE_SUPABASE_URL']],
  ];

  const resolved: Array<[string, string]> = [];
  for (const [key, raw] of refSources) {
    if (!raw) continue;
    const ref = extractSupabaseRef(raw);
    if (ref === null) {
      // A malformed Supabase hostname (present but with no extractable ref) is an error;
      // non-Supabase connections (e.g. local Postgres in test) pass without a ref.
      if (/supabase\.(co|com)/i.test(raw)) {
        errors.push(`${key} has a malformed Supabase hostname — ref cannot be extracted`);
      }
      continue;
    }
    resolved.push([key, ref]);
    if (SUPABASE_REF_DENYLIST.includes(ref)) {
      errors.push(`${key} points to the banned Supabase ref "${ref}"`);
      continue;
    }
    // Cross denylist: a known ref of ANOTHER environment is always forbidden.
    if (forbidden.includes(ref)) {
      errors.push(
        `${key} uses ref "${ref}" from ANOTHER environment — forbidden in NODE_ENV=${nodeEnv} (cross denylist)`,
      );
      continue;
    }
    if (expectedRef === null) {
      errors.push(
        `${key} uses remote ref "${ref}" but NODE_ENV=${nodeEnv} accepts no remote Supabase project`,
      );
    } else if (ref !== expectedRef) {
      errors.push(
        `${key} uses ref "${ref}" but NODE_ENV=${nodeEnv} requires project "${expectedRef}"`,
      );
    }
  }

  // Coherence: every resolved source must point to the SAME project.
  const distinctRefs = new Set(resolved.map(([, ref]) => ref));
  if (distinctRefs.size > 1) {
    errors.push(
      `Diverging Supabase refs across variables: ${resolved
        .map(([key, ref]) => `${key}=${ref}`)
        .join(' · ')} — all of them must point to the same project`,
    );
  }

  // Coherence of ref × JWT payloads (without exposing the token).
  const jwtSources: Array<[string, string | undefined, string]> = [
    ['SUPABASE_ANON_KEY', env['SUPABASE_ANON_KEY'], 'anon'],
    ['VITE_SUPABASE_ANON_KEY', env['VITE_SUPABASE_ANON_KEY'], 'anon'],
    ['SUPABASE_SERVICE_ROLE_KEY', env['SUPABASE_SERVICE_ROLE_KEY'], 'service_role'],
  ];
  for (const [key, token, expectedRole] of jwtSources) {
    if (!token) continue;
    const claims = decodeSupabaseJwtClaims(token);
    if (!claims) {
      errors.push(`${key} is not a decodable JWT`);
      continue;
    }
    if (claims.ref && forbidden.includes(claims.ref)) {
      errors.push(
        `${key} has payload ref "${claims.ref}" from ANOTHER environment — forbidden in NODE_ENV=${nodeEnv}`,
      );
    } else if (claims.ref && expectedRef !== null && claims.ref !== expectedRef) {
      errors.push(`${key} has payload ref "${claims.ref}" != expected project "${expectedRef}"`);
    } else if (claims.ref && expectedRef === null) {
      errors.push(`${key} has payload ref "${claims.ref}" but NODE_ENV=${nodeEnv} accepts no remote project`);
    }
    if (claims.role && claims.role !== expectedRole) {
      errors.push(`${key} has role "${claims.role}" (expected "${expectedRole}" — keys swapped?)`);
    }
  }

  if (prodLike) {
    for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const) {
      if (!env[key]) errors.push(`${key} is required in NODE_ENV=${nodeEnv}`);
    }
  }

  return errors;
}

/** Decodes only the JWT's public payload ({ ref, role }). Never exposes the token. */
export function decodeSupabaseJwtClaims(
  token: string | undefined | null,
): { ref: string | null; role: string | null } | null {
  if (!token || token.split('.').length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { ref?: string; role?: string };
    return { ref: payload.ref ?? null, role: payload.role ?? null };
  } catch {
    return null;
  }
}

/**
 * Extracts the project ref from any Supabase connection format:
 *   https://<ref>.supabase.co · db.<ref>.supabase.co · <role>.<ref>@...pooler.supabase.com
 */
export function extractSupabaseRef(value: string | undefined | null): string | null {
  if (!value) return null;
  const asUrl = /https?:\/\/([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asUrl) return asUrl[1].toLowerCase();
  const asDirectDb = /\bdb\.([a-z0-9]{18,22})\.supabase\.co/i.exec(value);
  if (asDirectDb) return asDirectDb[1].toLowerCase();
  const asPoolerUser = /\/\/[a-z0-9_]+\.([a-z0-9]{18,22}):[^@]*@[^/]*pooler\.supabase\.com/i.exec(value);
  if (asPoolerUser) return asPoolerUser[1].toLowerCase();
  return null;
}

/** Local hosts accepted when the URL is not Supabase (unambiguous identification). */
const LOCAL_DB_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Database COMMAND guard (migrate/rollback/reset/seed/scripts): in addition to the
 * full collectSupabaseEnvErrors matrix, requires DATABASE_URL present and
 * identifiable — the expected environment's Supabase or an explicit local Postgres.
 * A non-Supabase remote host or an unparseable URL = fail-closed block.
 * Pure and testable; never includes credentials in the messages.
 */
export function collectDatabaseCommandErrors(
  env: Record<string, string | undefined>,
  nodeEnvInput?: string,
): string[] {
  const nodeEnv = nodeEnvInput ?? env['NODE_ENV'] ?? 'development';
  const errors = collectSupabaseEnvErrors(env, nodeEnv);
  const url = env['DATABASE_URL'];
  if (!url || url.trim() === '') {
    errors.push('DATABASE_URL missing/empty — database commands require an explicit target');
    return errors;
  }
  if (extractSupabaseRef(url) === null) {
    let host: string | null = null;
    try {
      host = new URL(url).hostname;
    } catch {
      host = null;
    }
    if (!host) {
      errors.push('DATABASE_URL malformed — environment unidentifiable (fail-closed block)');
    } else if (!LOCAL_DB_HOSTS.includes(host.toLowerCase())) {
      errors.push(
        `DATABASE_URL points to a non-Supabase remote host "${host}" — environment unidentifiable (fail-closed block)`,
      );
    }
  }
  return errors;
}

/**
 * Aborts the process BEFORE any connection when the database target is not the
 * one authorized for NODE_ENV. Used by datasource.ts (module level — whoever
 * imports the DataSource cannot bypass it), seed.ts and database scripts.
 * `envOverride` allows validating URLs obtained outside process.env (e.g. a manually
 * parsed .env). Never prints the full URL, user or password.
 */
export function assertDatabaseCommandEnv(
  context: string,
  envOverride?: Record<string, string | undefined>,
): void {
  const env = envOverride ?? (process.env as Record<string, string | undefined>);
  const errors = collectDatabaseCommandErrors(env, env['NODE_ENV']);
  if (errors.length > 0) {
    console.error(`\n[${context}] BLOCKED — database target not authorized for this environment:`);
    for (const err of errors) console.error(`  • ${err}`);
    console.error(
      'No connection was opened. Environment matrix: docs/SUPABASE_ENVIRONMENTS.md\n',
    );
    process.exit(1);
  }
}

/**
 * RELEASE-01/RBAC-SHADOW-01/DBCTX-01: in production, these two flags can never
 * stay on zod's silent default. They must be declared explicitly in the
 * environment. RBAC_PERSISTED_AUTHORITY may only remain in SHADOW under an explicit,
 * temporary waiver (ALLOW_RBAC_SHADOW_IN_PRODUCTION=true) while the rollout
 * of the harness (test/rbac-shadow-harness) has not been approved; OFF is always forbidden.
 * DATABASE_SESSION_CONTEXT_ENABLED=true without APP_DATABASE_URL does not fail here by
 * accident — DatabaseModule silently falls back to the bypassrls connection
 * (see database.module.ts), so that combination is blocked too.
 * Receives the RAW env (not the object already parsed by zod) because only then is it possible
 * to distinguish "explicitly declared" from "absent and covered by the default".
 *
 * find-902e12f6 (Wave 4): the gate only covered a literal nodeEnv==='production'.
 * .github/workflows/staging.yml declares NODE_ENV=staging — a deployed,
 * publicly reachable environment (not a developer loopback) — which
 * fell outside the gate and inherited the silent defaults (RLS/RBAC off).
 * `envSchema.NODE_ENV` only recognizes 4 values; 'staging' is treated as
 * "deployed" together with 'production', leaving only 'development'/'test'
 * outside the gate.
 */
export function collectProductionAuthorityErrors(
  env: Record<string, string | undefined>,
  nodeEnvInput?: string,
): string[] {
  const nodeEnv = nodeEnvInput ?? env['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'production' && nodeEnv !== 'staging') return [];

  const errors: string[] = [];
  const envLabel = nodeEnv === 'staging' ? 'staging' : 'production';

  const dbCtxRaw = env['DATABASE_SESSION_CONTEXT_ENABLED'];
  if (dbCtxRaw === undefined || dbCtxRaw === '') {
    errors.push(
      `DATABASE_SESSION_CONTEXT_ENABLED not declared in ${envLabel} — the silent default ` +
        '("false") turns off per-tenant session isolation in the app DataSource (DBCTX-01).',
    );
  } else if (dbCtxRaw !== 'true') {
    errors.push(
      `DATABASE_SESSION_CONTEXT_ENABLED=false in ${envLabel} — per-tenant session isolation turned off (DBCTX-01).`,
    );
  } else {
    const appUrl = env['APP_DATABASE_URL'];
    if (!appUrl || appUrl.trim() === '') {
      errors.push(
        'DATABASE_SESSION_CONTEXT_ENABLED=true but APP_DATABASE_URL missing — the DatabaseModule ' +
          'silently falls back to DATABASE_URL (bypassrls), voiding the per-tenant ' +
          'session isolation the flag is supposed to guarantee (DBCTX-01).',
      );
    }
  }

  const rbacRaw = env['RBAC_PERSISTED_AUTHORITY'];
  if (rbacRaw === undefined || rbacRaw === '') {
    errors.push(
      `RBAC_PERSISTED_AUTHORITY not declared in ${envLabel} — the silent default ("SHADOW") ` +
        'means real authorization still runs only on the legacy engine (RBAC-SHADOW-01).',
    );
  } else if (rbacRaw === 'OFF') {
    errors.push(`RBAC_PERSISTED_AUTHORITY=OFF is forbidden in ${envLabel} (RBAC-SHADOW-01).`);
  } else if (rbacRaw === 'SHADOW') {
    const waiver = env['ALLOW_RBAC_SHADOW_IN_PRODUCTION'] === 'true';
    if (!waiver) {
      errors.push(
        `RBAC_PERSISTED_AUTHORITY=SHADOW in ${envLabel} without waiver — set ` +
          'ALLOW_RBAC_SHADOW_IN_PRODUCTION=true only as a formal temporary exception while the ' +
          'harness (test/rbac-shadow-harness) has not yet approved the promotion to ON (RBAC-SHADOW-01).',
      );
    }
  } else if (rbacRaw !== 'ON') {
    errors.push(`RBAC_PERSISTED_AUTHORITY="${rbacRaw}" is not a recognized value (RBAC-SHADOW-01).`);
  }

  return errors;
}

/**
 * Flags that must never be 'true' in a staging/production runtime.
 * SINGLE SOURCE: create-app.ts, security-startup.service.ts, the superRefine below and
 * scripts/verify-production-flags.ts (through collectProductionBypassFlagErrors) all reuse
 * this list; scripts/env-check.mjs mirrors it and bypass-flags-agreement.spec.ts proves it.
 * USE_MOCK is the DEPRECATED alias of DEV_SOCIAL_METRICS_MOCK and stays forbidden.
 */
export const PROD_FORBIDDEN_BYPASS_FLAGS = [
  'AUTH_DISABLED',
  'DEV_SOCIAL_METRICS_MOCK',
  'USE_MOCK',
  'DEV_AUTH_ENDPOINT_ENABLED',
] as const;

const CANONICAL_NODE_ENVS = ['development', 'test', 'staging', 'production'];

/**
 * Release-gate check (verify:production-flags) for the auth/mock bypass flags.
 * Strict on purpose, unlike the runtime default (an unset NODE_ENV runs as
 * 'development' locally so developers need no setup):
 *  - an unset/blank NODE_ENV is a FAILURE (the gate cannot prove the environment);
 *  - a NODE_ENV that is not exactly one of development|test|staging|production
 *    (e.g. ' Production ', 'prod') is a FAILURE;
 *  - any bypass flag === 'true' fails when the environment is prod-like OR unproven.
 * Never includes flag values other than the literal name in the messages.
 */
export function collectProductionBypassFlagErrors(
  env: Record<string, string | undefined>,
): string[] {
  const errors: string[] = [];
  const raw = env['NODE_ENV'];
  const unset = raw === undefined || raw.trim() === '';
  if (unset) {
    errors.push(
      'NODE_ENV is not set — the release gate cannot prove this is not production ' +
        "(the API runtime defaults an unset NODE_ENV to 'development' for local use only).",
    );
  } else if (!CANONICAL_NODE_ENVS.includes(raw as string)) {
    errors.push(
      `NODE_ENV is not exactly one of ${CANONICAL_NODE_ENVS.join('|')} (non-canonical value, ` +
        'case/whitespace matter) — refusing to treat the environment as non-production.',
    );
  }
  const strict = unset || isProdLikeEnv(raw) || !CANONICAL_NODE_ENVS.includes(raw as string);
  if (strict) {
    for (const flag of PROD_FORBIDDEN_BYPASS_FLAGS) {
      if (env[flag] === 'true') {
        errors.push(`${flag}=true is forbidden in a production-like or unproven environment.`);
      }
    }
  }
  return errors;
}

// Exported (Part 76) only for direct tests of the superRefine (e.g. AUTH_DISABLED
// forbidden outside development) without having to trigger validateEnv()'s process.exit.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'DATABASE_URL is required in production' },
    ),

  // ── RLS defense-in-depth (P2-2) ─────────────────────────────────────────────
  // Optional connection string for an application DB role WITHOUT BYPASSRLS.
  // When unset the app keeps using DATABASE_URL (current behaviour). Only consumed
  // when DATABASE_SESSION_CONTEXT_ENABLED=true; never auto-rotated.
  APP_DATABASE_URL: z.string().optional(),
  // Master switch for runtime session-context (SET LOCAL app.current_tenant_id).
  // OFF by default → zero behavioural change. Must be explicitly 'true' to enable.
  DATABASE_SESSION_CONTEXT_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_QUEUE_URL: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'REDIS_QUEUE_URL is required in production' },
    ),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
  RBAC_PERSISTED_AUTHORITY: z.enum(['OFF', 'SHADOW', 'ON']).default('SHADOW'),
  // Explicit, temporary waiver (RBAC-SHADOW-01): allows RBAC_PERSISTED_AUTHORITY=SHADOW
  // in production while the harness rollout (test/rbac-shadow-harness) has not yet been
  // approved. Never leave it "true" permanently — remove it as soon as the flag is promoted to ON.
  // Validated by collectProductionAuthorityErrors, not by zod (it needs the raw value, not the default).
  ALLOW_RBAC_SHADOW_IN_PRODUCTION: z.enum(['true', 'false']).default('false'),
  RBAC_DUAL_READ_TELEMETRY: z.enum(['true', 'false']).default('true'),
  RBAC_DISTRIBUTED_CACHE_ENABLED: z.enum(['true', 'false']).default('true'),
  RBAC_AUDIT_MIRROR_ENABLED: z.enum(['true', 'false']).default('true'),
  RBAC_DECISION_RETENTION_DAYS: z.coerce.number().min(1).max(365).default(30),
  RBAC_DECISION_RETENTION_INTERVAL_HOURS: z.coerce
    .number()
    .min(1)
    .max(168)
    .default(6),

  SUPABASE_URL: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'SUPABASE_URL is required in production' },
    ),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5000')
    .refine(
      (val) => {
        if (process.env['NODE_ENV'] !== 'production') return true;
        // Production must NOT include localhost / 127.0.0.1
        return !/localhost|127\.0\.0\.1/i.test(val);
      },
      { message: 'CORS_ORIGINS cannot contain localhost in production' },
    ),

  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be 64 hex chars')
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must contain only hexadecimal characters')
    .default('0000000000000000000000000000000000000000000000000000000000000000')
    .refine(
      (val) => {
        const nodeEnv = process.env.NODE_ENV;
        const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
        const isAllZero = /^0+$/.test(val);
        return !(isProdLike && isAllZero);
      },
      { message: 'ENCRYPTION_KEY cannot be all-zero in production or staging' },
    ),
  // Supabase auth keys — service role only ever used in backend (never VITE_*)
  SUPABASE_ANON_KEY: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'SUPABASE_ANON_KEY is required in production' },
    ),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'SUPABASE_SERVICE_ROLE_KEY is required in production' },
    ),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .refine(
      (val) => {
        // Required in production when Stripe is active (STRIPE_SECRET_KEY is set)
        if (process.env['NODE_ENV'] !== 'production') return true;
        const stripeActive = !!process.env['STRIPE_SECRET_KEY'];
        return !stripeActive || !!val;
      },
      { message: 'STRIPE_WEBHOOK_SECRET is required in production when STRIPE_SECRET_KEY is set' },
    ),
  // Prices/plans NO longer come from env. Primary source = the billing_plans table (admin),
  // and each plan stores its synced stripe_price_id. (STRIPE_PRICE_* removed.)

  AUTENTIQUE_WEBHOOK_SECRET: z
    .string()
    .min(24, 'AUTENTIQUE_WEBHOOK_SECRET must have at least 24 characters')
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'AUTENTIQUE_WEBHOOK_SECRET is required in production' },
    ),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('music-os-360'),
  R2_PUBLIC_URL: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (process.env['NODE_ENV'] !== 'production') return true;
        // Block placeholder values in production
        return !val || (!val.includes('pub-xxx') && !val.includes('placeholder'));
      },
      { message: 'R2_PUBLIC_URL must be set to a real Cloudflare R2 public URL in production' },
    ),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  RESEND_API_KEY: z
    .string()
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'RESEND_API_KEY is required in production for transactional email' },
    ),
  RESEND_FROM_EMAIL: z
    .string()
    .email()
    .default('noreply@musicos360.com.br'),
  // STAGING-01: in NODE_ENV=staging, MailService only sends to these domains
  // (comma-separated list) — protects against accidentally sending to
  // real addresses during manual tests in staging. No effect outside staging.
  STAGING_MAIL_ALLOWLIST_DOMAINS: z.string().default('example.com'),

  // Platform Commercial Contact (2026-08-22 product decision): destination of the
  // institutional contact form of Music OS 360's own landing page
  // (companies interested in hiring the platform) — NEVER an address
  // invented in code. Optional: when absent, the endpoint honestly answers
  // unavailable (503) instead of pretending it sent.
  PLATFORM_CONTACT_RECIPIENT_EMAIL: z.string().email().optional(),

  SENTRY_DSN: z
    .string()
    .url({ message: 'SENTRY_DSN must be a valid URL' })
    .optional()
    .refine(
      (val) => process.env['NODE_ENV'] !== 'production' || !!val,
      { message: 'SENTRY_DSN is required in production for error monitoring' },
    ),
  SENTRY_RELEASE: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default('https://app.posthog.com'),

  IDEMPOTENCY_TTL_HOURS: z.coerce.number().min(1).max(168).default(24),
  APP_URL: z
    .string()
    .default('http://localhost:5000')
    .refine(
      (val) => {
        if (process.env['NODE_ENV'] !== 'production') return true;
        return !/localhost|127\.0\.0\.1/i.test(val);
      },
      { message: 'APP_URL cannot point to localhost in production' },
    ),
  FRONTEND_URL: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (process.env['NODE_ENV'] !== 'production') return true;
        return !val || !/localhost|127\.0\.0\.1/i.test(val);
      },
      { message: 'FRONTEND_URL cannot point to localhost in production' },
    ),

  ACRCLOUD_HOST: z.string().optional(),
  ACRCLOUD_ACCESS_KEY: z.string().optional(),
  ACRCLOUD_ACCESS_SECRET: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().optional(),
  SPOTIFY_OAUTH_STATE_SECRET: z.string().optional(),

  YOUTUBE_API_KEY: z.string().optional(),

  SOUNDCLOUD_CLIENT_ID: z.string().optional(),

  // Soundcharts — source of public audience metrics (backend-only,
  // client_credentials). Never expose via VITE_* — client_secret must not
  // reach the browser (see SoundchartsService).
  SOUNDCHARTS_CLIENT_ID: z.string().optional(),
  SOUNDCHARTS_CLIENT_SECRET: z.string().optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),

  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().optional(),

  // WhatsApp Cloud API (Meta) — phoneNumberId/accessToken/wabaId are per
  // tenant (see WhatsAppCloudProvider.configure, same pattern as Apple Music).
  // The verify token is unique per Meta app (one webhook for all WABAs).
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_CLIENT_SECRET: z.string().optional(),
  DOCUSIGN_AUTH_BASE_URL: z.string().url().default('https://account-d.docusign.com'),
  // HMAC key configured in DocuSign Connect. Without it the webhook is rejected
  // fail-closed (same rule as AUTENTIQUE_WEBHOOK_SECRET) — never process
  // a signature callback without verifying the HMAC signature.
  DOCUSIGN_WEBHOOK_SECRET: z
    .string()
    .min(24, 'DOCUSIGN_WEBHOOK_SECRET must have at least 24 characters')
    .optional(),

  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_REDIRECT_URI: z.string().optional(),

  // Generic Google OAuth (corp_youtube/google_business exchange in
  // integrations.controller.ts) — falls back to GOOGLE_ADS_CLIENT_ID/SECRET
  // when unset, but was previously read via bare process.env with no schema
  // validation at all.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ── Operational variables read directly by modules ─────────────────────────────
  // Declared here so a typo or a malformed value fails at boot instead of being ignored by a
  // bare process.env read (environment-contract census: scripts/env-contract-census.mjs).
  // Direct (non-pooler) connection string; only its Supabase ref is checked (collectSupabaseEnvErrors).
  DIRECT_DATABASE_URL: z.string().optional(),
  // Pool sizing and TLS (database.module.ts, datasource.ts): positive integers; DB_SSL only 'false' disables TLS.
  DB_POOL_MAX: z.string().regex(/^\d+$/, 'DB_POOL_MAX must be a positive integer').optional(),
  DB_POOL_MIN: z.string().regex(/^\d+$/, 'DB_POOL_MIN must be a non-negative integer').optional(),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.string().regex(/^\d+$/, 'DB_POOL_CONNECTION_TIMEOUT_MS must be a positive integer').optional(),
  DB_SSL: z.enum(['true', 'false']).optional(),
  // Bull-board basic auth (admin-queues.module.ts): required in staging/production by the module itself.
  ADMIN_QUEUES_USER: z.string().optional(),
  ADMIN_QUEUES_PASS: z.string().optional(),
  // Prometheus scrape token (metrics.controller.ts): required in staging/production by the controller.
  METRICS_TOKEN: z.string().optional(),
  // Deploy-platform build identifier shown by /health.
  BUILD_SHA: z.string().optional(),
  // 'true' trusts X-Forwarded-For behind a known proxy only (rate-limit.guard.ts).
  RATE_LIMIT_TRUST_PROXY: z.enum(['true', 'false']).optional(),
  // 'false' is the kill switch that makes the role writer emit the legacy form (users.service.ts).
  RBAC_CANONICAL_ROLE_WRITE: z.enum(['true', 'false']).optional(),
  // Registry adapters stay disabled unless exactly 'true' (never enabled implicitly).
  REGISTRY_PARTNER_API_ENABLED: z.enum(['true', 'false']).optional(),
  REGISTRY_PORTAL_RPA_ENABLED: z.enum(['true', 'false']).optional(),
  // HMAC secret of the external data webhook (external-data.controller.ts).
  EXTERNAL_DATA_WEBHOOK_SECRET: z.string().optional(),

  // LOCAL convenience flags — blocked outside development by the superRefine.
  // DEV_SOCIAL_METRICS_MOCK: dev-only synthetic Instagram/TikTok followers fallback.
  // USE_MOCK is its deprecated alias (still read, still forbidden in prod-like environments).
  DEV_SOCIAL_METRICS_MOCK: z.string().optional(),
  USE_MOCK: z.string().optional(),
  AUTH_DISABLED: z.string().optional(),
  // GET /dev-auth/token (DevAuthController) is OFF unless DEV_AUTH_ENDPOINT_ENABLED === 'true'
  // (non prod-like only; forbidden by superRefine in staging/production). When enabled, the
  // dev account comes from DEV_AUTH_EMAIL / DEV_AUTH_PASSWORD (no hardcoded credentials).
  DEV_AUTH_ENDPOINT_ENABLED: z.string().optional(),
  DEV_AUTH_EMAIL: z.string().optional(),
  DEV_AUTH_PASSWORD: z.string().optional(),
  // Identity overrides used under AUTH_DISABLED (core/auth-disabled.ts): must be UUIDs when set.
  DEV_TENANT_ID: z.string().uuid().optional(),
  DEV_ORG_ID: z.string().uuid().optional(),
}).superRefine((cfg, ctx) => {
  const isProdLike = cfg.NODE_ENV === 'production' || cfg.NODE_ENV === 'staging';

  // 1) Denylist: preview branch forbidden in any environment.
  const refSources: Array<[string, string | null]> = [
    ['SUPABASE_URL', extractSupabaseRef(cfg.SUPABASE_URL)],
    ['DATABASE_URL', extractSupabaseRef(cfg.DATABASE_URL)],
    ['APP_DATABASE_URL', extractSupabaseRef(cfg.APP_DATABASE_URL)],
  ];
  for (const [key, ref] of refSources) {
    if (ref && SUPABASE_REF_DENYLIST.includes(ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} points to the banned Supabase ref "${ref}" (preview branch without public tables)`,
      });
    }
  }

  // 2) Coherence: the whole API (auth + database) must use ONE single Supabase project.
  const resolved = refSources.filter((entry): entry is [string, string] => entry[1] !== null);
  const distinctRefs = new Set(resolved.map(([, ref]) => ref));
  if (distinctRefs.size > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SUPABASE_URL'],
      message: `Refs Supabase divergentes no backend: ${resolved
        .map(([key, ref]) => `${key}=${ref}`)
        .join(' · ')} — todos devem apontar para o mesmo projeto`,
    });
  }

  // 3) Production/staging: only allowlisted refs; production requires the production ref.
  if (isProdLike) {
    for (const [key, ref] of resolved) {
      if (!SUPABASE_ALLOWED_REFS.includes(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} uses ref "${ref}" outside the allowlist [${SUPABASE_ALLOWED_REFS.join(', ')}] in ${cfg.NODE_ENV}`,
        });
      }
      if (cfg.NODE_ENV === 'production' && ref !== SUPABASE_PROD_REF) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must use the production ref "${SUPABASE_PROD_REF}" when NODE_ENV=production (found "${ref}")`,
        });
      }
    }

    // 4) Mock and auth bypass are exclusive to development.
    for (const flag of PROD_FORBIDDEN_BYPASS_FLAGS) {
      if (cfg[flag] === 'true') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [flag],
          message: `${flag}=true is forbidden in ${cfg.NODE_ENV} (allowed only in development)`,
        });
      }
    }
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  const authorityErrors = collectProductionAuthorityErrors(config as Record<string, string | undefined>);
  if (authorityErrors.length > 0) {
    console.error('Invalid environment variables (RBAC-SHADOW-01 / DBCTX-01 production gate):');
    authorityErrors.forEach((err) => console.error(`  ${err}`));
    process.exit(1);
  }
  return result.data;
}
