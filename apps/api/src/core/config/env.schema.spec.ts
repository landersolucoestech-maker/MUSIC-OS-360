import {
  SUPABASE_DEV_REF,
  SUPABASE_MAIN_REF,
  SUPABASE_PROD_REF,
  SUPABASE_STAGING_REF,
  collectDatabaseCommandErrors,
  collectProductionAuthorityErrors,
  collectSupabaseEnvErrors,
  expectedSupabaseRef,
  extractSupabaseRef,
  forbiddenSupabaseRefs,
} from './env.schema';

function jwtFor(ref: string, role = 'anon'): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ ref, role })}.sig`;
}

const url = (ref: string) => `https://${ref}.supabase.co`;
const pooler = (ref: string) => `postgresql://musicos_migrator.${ref}:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
const direct = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;

describe('env.schema — Supabase environment isolation matrix (2026-07-16/17 incident)', () => {
  describe('expectedSupabaseRef / forbiddenSupabaseRefs', () => {
    it('development → DEV_REF; test → null (no remote); staging → STAGING_REF; production → PROD_REF', () => {
      expect(expectedSupabaseRef('development')).toBe(SUPABASE_DEV_REF);
      expect(expectedSupabaseRef(undefined)).toBe(SUPABASE_DEV_REF);
      expect(expectedSupabaseRef('test')).toBeNull();
      expect(expectedSupabaseRef('staging')).toBe(SUPABASE_STAGING_REF);
      expect(expectedSupabaseRef('production')).toBe(SUPABASE_PROD_REF);
    });

    it('MAIN_REF is an alias for the real production project', () => {
      expect(SUPABASE_MAIN_REF).toBe(SUPABASE_PROD_REF);
      expect(SUPABASE_PROD_REF).toBe('sxmfeocztlztvpdnxayk');
      expect(expectedSupabaseRef('production')).toBe(SUPABASE_MAIN_REF);
      expect(forbiddenSupabaseRefs('production')).not.toContain(SUPABASE_MAIN_REF);
    });
  });

  describe('collectSupabaseEnvErrors — mandatory matrix', () => {
    it('development + DEV_REF → passes', () => {
      expect(collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF), DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'development')).toEqual([]);
    });

    it('development + MAIN_REF → fails (cross denylist)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('ANOTHER environment') && e.includes(SUPABASE_MAIN_REF))).toBe(true);
    });

    it('development + old excluded DEV (sxdhnhoupjrnntrmjtyn) → fails (absolute denylist)', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url('sxdhnhoupjrnntrmjtyn') }, 'development');
      expect(errors.some((e) => e.includes('banned'))).toBe(true);
    });

    it('development + PROD_REF → fails', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_PROD_REF) }, 'development');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('development + STAGING_REF → fails', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_STAGING_REF) }, 'development');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('production + PROD_REF → passes (with required variables present)', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_PROD_REF),
        DATABASE_URL: pooler(SUPABASE_PROD_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_PROD_REF, 'anon'),
      }, 'production');
      expect(errors).toEqual([]);
    });

    it('production + MAIN_REF → passes because MAIN is production', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_MAIN_REF),
        DATABASE_URL: pooler(SUPABASE_MAIN_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_MAIN_REF, 'anon'),
      }, 'production');
      expect(errors).toEqual([]);
    });

    it('production + DEV_REF → fails', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF) }, 'production');
      expect(errors.some((e) => e.includes('ANOTHER environment'))).toBe(true);
    });

    it('staging + STAGING_REF → passes', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_STAGING_REF),
        DATABASE_URL: pooler(SUPABASE_STAGING_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_STAGING_REF, 'anon'),
      }, 'staging');
      expect(errors).toEqual([]);
    });

    it('staging + DEV_REF → fails', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF) }, 'staging');
      expect(errors.some((e) => e.includes('ANOTHER environment'))).toBe(true);
    });

    it('test + any remote ref → fails (no silent fallback)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'test');
      expect(errors.some((e) => e.includes('accepts no remote Supabase project') || e.includes('ANOTHER environment'))).toBe(true);
    });

    it('test + local Postgres (non-Supabase) → passes', () => {
      expect(collectSupabaseEnvErrors({ DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/test' }, 'test')).toEqual([]);
    });

    it('SUPABASE_URL and DATABASE_URL with different refs → fails due to divergence', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        DATABASE_URL: pooler(SUPABASE_STAGING_REF),
      }, 'development');
      expect(errors.some((e) => e.includes('Diverging'))).toBe(true);
    });

    it('URL and JWT with different refs → fails', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_MAIN_REF, 'anon'),
      }, 'development');
      expect(errors.some((e) => e.includes('SUPABASE_ANON_KEY') && e.includes('ANOTHER environment'))).toBe(true);
    });

    it('required variable missing in production → fails', () => {
      const errors = collectSupabaseEnvErrors({}, 'production');
      expect(errors).toEqual(expect.arrayContaining([
        expect.stringContaining('DATABASE_URL is required'),
        expect.stringContaining('SUPABASE_URL is required'),
        expect.stringContaining('SUPABASE_ANON_KEY is required'),
      ]));
    });

    it('unknown ref (outside KNOWN_REFS) → fails in any environment', () => {
      const stranger = 'aaaabbbbccccddddeeee';
      for (const env of ['development', 'staging', 'production']) {
        const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(stranger) }, env);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('absolute denylist (banned preview branch) prevails in any environment', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url('mkyvkciwyhfawmvluugb') }, 'development');
      expect(errors.some((e) => e.includes('banned'))).toBe(true);
    });

    it('malformed Supabase hostname (ref not extractable) → fails', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: 'https://.supabase.co' }, 'development');
      expect(errors.some((e) => e.includes('malformed'))).toBe(true);
    });

    it('ref extracted from the pooler is validated (cross denylist via connection string)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_PROD_REF) }, 'development');
      expect(errors.some((e) => e.includes('DATABASE_URL') && e.includes('ANOTHER environment'))).toBe(true);
    });

    it('ref extracted from the direct URL (db.<ref>) is validated, including DIRECT_DATABASE_URL', () => {
      const errors = collectSupabaseEnvErrors({ DIRECT_DATABASE_URL: direct(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('DIRECT_DATABASE_URL') && e.includes('ANOTHER environment'))).toBe(true);
    });

    it('JWT with inverted role (service_role in ANON_KEY) → fails', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_DEV_REF, 'service_role'),
      }, 'development');
      expect(errors.some((e) => e.includes('keys swapped'))).toBe(true);
    });
  });

  describe('extractSupabaseRef — supported formats', () => {
    it('extracts from an https URL, direct db.<ref> host, and pooler username', () => {
      expect(extractSupabaseRef(url(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef(direct(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef(pooler(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef('postgresql://postgres:pw@localhost:5432/x')).toBeNull();
    });
  });

  describe('collectDatabaseCommandErrors — database command guard (fail-closed)', () => {
    it('development + DATABASE_URL from the new DEV → allowed', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'development')).toEqual([]);
    });

    it('development + MAIN → blocked', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('ANOTHER environment'))).toBe(true);
    });

    it('development + PROD → blocked', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: direct(SUPABASE_PROD_REF) }, 'development').length).toBeGreaterThan(0);
    });

    it('development + old excluded DEV → blocked (denylist)', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: direct('sxdhnhoupjrnntrmjtyn') }, 'development');
      expect(errors.some((e) => e.includes('banned'))).toBe(true);
    });

    it('development + unknown random ref → blocked', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: direct('aaaabbbbccccddddeeee') }, 'development').length).toBeGreaterThan(0);
    });

    it('missing DATABASE_URL → blocked', () => {
      expect(collectDatabaseCommandErrors({}, 'development').some((e) => e.includes('missing'))).toBe(true);
    });

    it('empty DATABASE_URL → blocked', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: '   ' }, 'development').some((e) => e.includes('missing'))).toBe(true);
    });

    it('malformed DATABASE_URL (not parseable) → blocked', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: 'not a url at all' }, 'development');
      expect(errors.some((e) => e.includes('unidentifiable') || e.includes('malformed'))).toBe(true);
    });

    it('non-Supabase remote host → blocked (unidentifiable environment)', () => {
      const errors = collectDatabaseCommandErrors(
        { DATABASE_URL: 'postgresql://user:pw@db.example-somewhere.com:5432/postgres' },
        'development',
      );
      expect(errors.some((e) => e.includes('unidentifiable'))).toBe(true);
    });

    it('divergent URL and ref (SUPABASE_URL=DEV, DATABASE_URL=MAIN) → blocked', () => {
      const errors = collectDatabaseCommandErrors(
        { SUPABASE_URL: url(SUPABASE_DEV_REF), DATABASE_URL: pooler(SUPABASE_MAIN_REF) },
        'development',
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Diverging') || e.includes('ANOTHER environment'))).toBe(true);
    });

    it('password with special characters in the DEV pooler → safe parse, allowed', () => {
      const weird = `postgresql://musicos_migrator.${SUPABASE_DEV_REF}:p%40s$!x*(1)@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
      expect(collectDatabaseCommandErrors({ DATABASE_URL: weird }, 'development')).toEqual([]);
    });

    it('test + local Postgres (with special password) → allowed', () => {
      expect(collectDatabaseCommandErrors(
        { DATABASE_URL: 'postgresql://postgres:p%23w!x@localhost:5432/musicos_test' },
        'test',
      )).toEqual([]);
    });

    it('test + remote (even the DEV authorized for development) → blocked', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'test').length).toBeGreaterThan(0);
    });
  });
});

describe('collectProductionAuthorityErrors — RBAC-SHADOW-01 / DBCTX-01 (Part 45)', () => {
  const base = { APP_DATABASE_URL: 'postgresql://musicos_app@host/db' };

  it('development, missing RBAC, missing DB context → passes (flags only apply in production/staging)', () => {
    expect(collectProductionAuthorityErrors({}, 'development')).toEqual([]);
  });

  it('test, missing RBAC, missing DB context → passes', () => {
    expect(collectProductionAuthorityErrors({}, 'test')).toEqual([]);
  });

  // find-902e12f6 (Wave 4): .github/workflows/staging.yml declares NODE_ENV=staging.
  // Before this fix the gate only triggered for the literal nodeEnv==='production',
  // letting the staging deploy inherit the silent defaults (RLS/RBAC off).
  it('staging, missing RBAC, missing DB context → fails (the same production gate now covers staging)', () => {
    const errors = collectProductionAuthorityErrors({}, 'staging');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('not declared'))).toBe(true);
    expect(errors.some((e) => e.includes('RBAC_PERSISTED_AUTHORITY') && e.includes('not declared'))).toBe(true);
  });

  it('staging, RBAC=ON, DB context=true, APP_DATABASE_URL present → passes', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'staging',
    )).toEqual([]);
  });

  it('production, missing RBAC, missing DB context → fails (both flags reported)', () => {
    const errors = collectProductionAuthorityErrors({}, 'production');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('not declared'))).toBe(true);
    expect(errors.some((e) => e.includes('RBAC_PERSISTED_AUTHORITY') && e.includes('not declared'))).toBe(true);
  });

  it('production, RBAC=SHADOW declared, DB context=true, no waiver → fails', () => {
    const errors = collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'SHADOW' },
      'production',
    );
    expect(errors.some((e) => e.includes('SHADOW') && e.includes('without waiver'))).toBe(true);
  });

  it('production, RBAC=SHADOW, DB context=true, with explicit waiver → passes temporarily', () => {
    const errors = collectProductionAuthorityErrors(
      {
        ...base,
        DATABASE_SESSION_CONTEXT_ENABLED: 'true',
        RBAC_PERSISTED_AUTHORITY: 'SHADOW',
        ALLOW_RBAC_SHADOW_IN_PRODUCTION: 'true',
      },
      'production',
    );
    expect(errors).toEqual([]);
  });

  it('production, RBAC=ON, DB context=true, APP_DATABASE_URL present → passes', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    )).toEqual([]);
  });

  it('production, RBAC=ON, DB context=false → fails (DB context)', () => {
    const errors = collectProductionAuthorityErrors(
      { DATABASE_SESSION_CONTEXT_ENABLED: 'false', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    );
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED=false'))).toBe(true);
  });

  it('production, RBAC=ON, missing DB context → fails (DB context not declared)', () => {
    const errors = collectProductionAuthorityErrors({ RBAC_PERSISTED_AUTHORITY: 'ON' }, 'production');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('not declared'))).toBe(true);
  });

  it('production, RBAC=OFF → fails, even with correct DB context', () => {
    const errors = collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'OFF' },
      'production',
    );
    expect(errors.some((e) => e.includes('OFF') && e.includes('forbidden'))).toBe(true);
  });

  it('production, DB context=true without APP_DATABASE_URL → fails (silent fallback to bypassrls)', () => {
    const errors = collectProductionAuthorityErrors(
      { DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    );
    expect(errors.some((e) => e.includes('APP_DATABASE_URL missing'))).toBe(true);
  });

  it('production, waiver=true but RBAC=ON → waiver is ignored (no longer SHADOW, nothing to forgive)', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON', ALLOW_RBAC_SHADOW_IN_PRODUCTION: 'true' },
      'production',
    )).toEqual([]);
  });
});
