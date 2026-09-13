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

describe('env.schema — matriz de isolamento de ambientes Supabase (incidente 2026-07-16/17)', () => {
  describe('expectedSupabaseRef / forbiddenSupabaseRefs', () => {
    it('development → DEV_REF; test → null (nenhum remoto); staging → STAGING_REF; production → PROD_REF', () => {
      expect(expectedSupabaseRef('development')).toBe(SUPABASE_DEV_REF);
      expect(expectedSupabaseRef(undefined)).toBe(SUPABASE_DEV_REF);
      expect(expectedSupabaseRef('test')).toBeNull();
      expect(expectedSupabaseRef('staging')).toBe(SUPABASE_STAGING_REF);
      expect(expectedSupabaseRef('production')).toBe(SUPABASE_PROD_REF);
    });

    it('MAIN_REF é alias do projeto de produção real', () => {
      expect(SUPABASE_MAIN_REF).toBe(SUPABASE_PROD_REF);
      expect(SUPABASE_PROD_REF).toBe('sxmfeocztlztvpdnxayk');
      expect(expectedSupabaseRef('production')).toBe(SUPABASE_MAIN_REF);
      expect(forbiddenSupabaseRefs('production')).not.toContain(SUPABASE_MAIN_REF);
    });
  });

  describe('collectSupabaseEnvErrors — matriz obrigatória', () => {
    it('development + DEV_REF → passa', () => {
      expect(collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF), DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'development')).toEqual([]);
    });

    it('development + MAIN_REF → falha (denylist cruzada)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('OUTRO ambiente') && e.includes(SUPABASE_MAIN_REF))).toBe(true);
    });

    it('development + DEV antigo excluído (sxdhnhoupjrnntrmjtyn) → falha (denylist absoluta)', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url('sxdhnhoupjrnntrmjtyn') }, 'development');
      expect(errors.some((e) => e.includes('banido'))).toBe(true);
    });

    it('development + PROD_REF → falha', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_PROD_REF) }, 'development');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('development + STAGING_REF → falha', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_STAGING_REF) }, 'development');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('production + PROD_REF → passa (com variáveis obrigatórias presentes)', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_PROD_REF),
        DATABASE_URL: pooler(SUPABASE_PROD_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_PROD_REF, 'anon'),
      }, 'production');
      expect(errors).toEqual([]);
    });

    it('production + MAIN_REF → passa porque MAIN é produção', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_MAIN_REF),
        DATABASE_URL: pooler(SUPABASE_MAIN_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_MAIN_REF, 'anon'),
      }, 'production');
      expect(errors).toEqual([]);
    });

    it('production + DEV_REF → falha', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF) }, 'production');
      expect(errors.some((e) => e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('staging + STAGING_REF → passa', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_STAGING_REF),
        DATABASE_URL: pooler(SUPABASE_STAGING_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_STAGING_REF, 'anon'),
      }, 'staging');
      expect(errors).toEqual([]);
    });

    it('staging + DEV_REF → falha', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(SUPABASE_DEV_REF) }, 'staging');
      expect(errors.some((e) => e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('test + qualquer ref remoto → falha (sem fallback silencioso)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'test');
      expect(errors.some((e) => e.includes('não aceita nenhum projeto Supabase remoto') || e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('test + Postgres local (não-Supabase) → passa', () => {
      expect(collectSupabaseEnvErrors({ DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/test' }, 'test')).toEqual([]);
    });

    it('SUPABASE_URL e DATABASE_URL com refs diferentes → falha por divergência', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        DATABASE_URL: pooler(SUPABASE_STAGING_REF),
      }, 'development');
      expect(errors.some((e) => e.includes('divergentes'))).toBe(true);
    });

    it('URL e JWT com refs diferentes → falha', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_MAIN_REF, 'anon'),
      }, 'development');
      expect(errors.some((e) => e.includes('SUPABASE_ANON_KEY') && e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('variável obrigatória ausente em production → falha', () => {
      const errors = collectSupabaseEnvErrors({}, 'production');
      expect(errors).toEqual(expect.arrayContaining([
        expect.stringContaining('DATABASE_URL e obrigatorio'),
        expect.stringContaining('SUPABASE_URL e obrigatorio'),
        expect.stringContaining('SUPABASE_ANON_KEY e obrigatorio'),
      ]));
    });

    it('ref desconhecido (fora dos KNOWN_REFS) → falha em qualquer ambiente', () => {
      const stranger = 'aaaabbbbccccddddeeee';
      for (const env of ['development', 'staging', 'production']) {
        const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url(stranger) }, env);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('denylist absoluta (branch preview banido) prevalece em qualquer ambiente', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: url('mkyvkciwyhfawmvluugb') }, 'development');
      expect(errors.some((e) => e.includes('banido'))).toBe(true);
    });

    it('hostname Supabase malformado (ref não extraível) → falha', () => {
      const errors = collectSupabaseEnvErrors({ SUPABASE_URL: 'https://.supabase.co' }, 'development');
      expect(errors.some((e) => e.includes('malformado'))).toBe(true);
    });

    it('ref extraído do pooler é validado (denylist cruzada via connection string)', () => {
      const errors = collectSupabaseEnvErrors({ DATABASE_URL: pooler(SUPABASE_PROD_REF) }, 'development');
      expect(errors.some((e) => e.includes('DATABASE_URL') && e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('ref extraído da URL direta (db.<ref>) é validado, incluindo DIRECT_DATABASE_URL', () => {
      const errors = collectSupabaseEnvErrors({ DIRECT_DATABASE_URL: direct(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('DIRECT_DATABASE_URL') && e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('JWT com role invertida (service_role em ANON_KEY) → falha', () => {
      const errors = collectSupabaseEnvErrors({
        SUPABASE_URL: url(SUPABASE_DEV_REF),
        SUPABASE_ANON_KEY: jwtFor(SUPABASE_DEV_REF, 'service_role'),
      }, 'development');
      expect(errors.some((e) => e.includes('chaves invertidas'))).toBe(true);
    });
  });

  describe('extractSupabaseRef — formatos suportados', () => {
    it('extrai de URL https, host direto db.<ref> e usuário do pooler', () => {
      expect(extractSupabaseRef(url(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef(direct(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef(pooler(SUPABASE_DEV_REF))).toBe(SUPABASE_DEV_REF);
      expect(extractSupabaseRef('postgresql://postgres:pw@localhost:5432/x')).toBeNull();
    });
  });

  describe('collectDatabaseCommandErrors — guard de comandos de banco (fail-closed)', () => {
    it('development + DATABASE_URL do novo DEV → permitido', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'development')).toEqual([]);
    });

    it('development + MAIN → bloqueado', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_MAIN_REF) }, 'development');
      expect(errors.some((e) => e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('development + PROD → bloqueado', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: direct(SUPABASE_PROD_REF) }, 'development').length).toBeGreaterThan(0);
    });

    it('development + DEV antigo excluído → bloqueado (denylist)', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: direct('sxdhnhoupjrnntrmjtyn') }, 'development');
      expect(errors.some((e) => e.includes('banido'))).toBe(true);
    });

    it('development + ref aleatório desconhecido → bloqueado', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: direct('aaaabbbbccccddddeeee') }, 'development').length).toBeGreaterThan(0);
    });

    it('DATABASE_URL ausente → bloqueado', () => {
      expect(collectDatabaseCommandErrors({}, 'development').some((e) => e.includes('ausente'))).toBe(true);
    });

    it('DATABASE_URL vazia → bloqueado', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: '   ' }, 'development').some((e) => e.includes('ausente'))).toBe(true);
    });

    it('DATABASE_URL malformada (não parseável) → bloqueado', () => {
      const errors = collectDatabaseCommandErrors({ DATABASE_URL: 'not a url at all' }, 'development');
      expect(errors.some((e) => e.includes('não identificável') || e.includes('malformada'))).toBe(true);
    });

    it('host remoto não-Supabase → bloqueado (ambiente não identificável)', () => {
      const errors = collectDatabaseCommandErrors(
        { DATABASE_URL: 'postgresql://user:pw@db.example-somewhere.com:5432/postgres' },
        'development',
      );
      expect(errors.some((e) => e.includes('não identificável'))).toBe(true);
    });

    it('URL e ref divergentes (SUPABASE_URL=DEV, DATABASE_URL=MAIN) → bloqueado', () => {
      const errors = collectDatabaseCommandErrors(
        { SUPABASE_URL: url(SUPABASE_DEV_REF), DATABASE_URL: pooler(SUPABASE_MAIN_REF) },
        'development',
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('divergentes') || e.includes('OUTRO ambiente'))).toBe(true);
    });

    it('senha com caracteres especiais no pooler do DEV → parse seguro, permitido', () => {
      const weird = `postgresql://musicos_migrator.${SUPABASE_DEV_REF}:p%40s$!x*(1)@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
      expect(collectDatabaseCommandErrors({ DATABASE_URL: weird }, 'development')).toEqual([]);
    });

    it('test + Postgres local (com senha especial) → permitido', () => {
      expect(collectDatabaseCommandErrors(
        { DATABASE_URL: 'postgresql://postgres:p%23w!x@localhost:5432/musicos_test' },
        'test',
      )).toEqual([]);
    });

    it('test + remoto (mesmo o DEV autorizado de development) → bloqueado', () => {
      expect(collectDatabaseCommandErrors({ DATABASE_URL: pooler(SUPABASE_DEV_REF) }, 'test').length).toBeGreaterThan(0);
    });
  });
});

describe('collectProductionAuthorityErrors — RBAC-SHADOW-01 / DBCTX-01 (Parte 45)', () => {
  const base = { APP_DATABASE_URL: 'postgresql://musicos_app@host/db' };

  it('development, RBAC ausente, DB context ausente → passa (flags só se aplicam em produção/staging)', () => {
    expect(collectProductionAuthorityErrors({}, 'development')).toEqual([]);
  });

  it('test, RBAC ausente, DB context ausente → passa', () => {
    expect(collectProductionAuthorityErrors({}, 'test')).toEqual([]);
  });

  // find-902e12f6 (Wave 4): .github/workflows/staging.yml declara NODE_ENV=staging.
  // Antes desta correção o gate só disparava para nodeEnv==='production' literal,
  // deixando o deploy de staging herdar os defaults silenciosos (RLS/RBAC desligados).
  it('staging, RBAC ausente, DB context ausente → falha (mesmo gate de produção agora cobre staging)', () => {
    const errors = collectProductionAuthorityErrors({}, 'staging');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('não declarado'))).toBe(true);
    expect(errors.some((e) => e.includes('RBAC_PERSISTED_AUTHORITY') && e.includes('não declarado'))).toBe(true);
  });

  it('staging, RBAC=ON, DB context=true, APP_DATABASE_URL presente → passa', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'staging',
    )).toEqual([]);
  });

  it('production, RBAC ausente, DB context ausente → falha (ambas as flags reportadas)', () => {
    const errors = collectProductionAuthorityErrors({}, 'production');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('não declarado'))).toBe(true);
    expect(errors.some((e) => e.includes('RBAC_PERSISTED_AUTHORITY') && e.includes('não declarado'))).toBe(true);
  });

  it('production, RBAC=SHADOW declarado, DB context=true, sem waiver → falha', () => {
    const errors = collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'SHADOW' },
      'production',
    );
    expect(errors.some((e) => e.includes('SHADOW') && e.includes('sem waiver'))).toBe(true);
  });

  it('production, RBAC=SHADOW, DB context=true, com waiver explícito → passa temporariamente', () => {
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

  it('production, RBAC=ON, DB context=true, APP_DATABASE_URL presente → passa', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    )).toEqual([]);
  });

  it('production, RBAC=ON, DB context=false → falha (DB context)', () => {
    const errors = collectProductionAuthorityErrors(
      { DATABASE_SESSION_CONTEXT_ENABLED: 'false', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    );
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED=false'))).toBe(true);
  });

  it('production, RBAC=ON, DB context ausente → falha (DB context não declarado)', () => {
    const errors = collectProductionAuthorityErrors({ RBAC_PERSISTED_AUTHORITY: 'ON' }, 'production');
    expect(errors.some((e) => e.includes('DATABASE_SESSION_CONTEXT_ENABLED') && e.includes('não declarado'))).toBe(true);
  });

  it('production, RBAC=OFF → falha, mesmo com DB context correto', () => {
    const errors = collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'OFF' },
      'production',
    );
    expect(errors.some((e) => e.includes('OFF') && e.includes('proibido'))).toBe(true);
  });

  it('production, DB context=true sem APP_DATABASE_URL → falha (fallback silencioso para bypassrls)', () => {
    const errors = collectProductionAuthorityErrors(
      { DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON' },
      'production',
    );
    expect(errors.some((e) => e.includes('APP_DATABASE_URL ausente'))).toBe(true);
  });

  it('production, waiver=true mas RBAC=ON → waiver é ignorado (não é mais SHADOW, nada a perdoar)', () => {
    expect(collectProductionAuthorityErrors(
      { ...base, DATABASE_SESSION_CONTEXT_ENABLED: 'true', RBAC_PERSISTED_AUTHORITY: 'ON', ALLOW_RBAC_SHADOW_IN_PRODUCTION: 'true' },
      'production',
    )).toEqual([]);
  });
});
