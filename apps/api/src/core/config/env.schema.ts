import { z } from 'zod';

// ── Supabase environment guard ────────────────────────────────────────────────
// Fonte única de verdade dos refs permitidos por ambiente. O frontend espelha
// esta lista em apps/web/scripts/assert-supabase-env.mjs e o gate de repo em
// scripts/env-check.mjs — qualquer alteração deve ser feita nos três lugares.
//
// MATRIZ DE AMBIENTES (incidente de isolamento 2026-07-16/17):
//   development → SOMENTE DEV_REF; STAGING/PROD explicitamente proibidos.
//   test        → NENHUM projeto remoto (sem fallback silencioso para DEV).
//   staging     → SOMENTE STAGING_REF.
//   production  → SOMENTE PROD_REF.
// O projeto Supabase MAIN é o ambiente de produção e permanece intacto até a liberação formal.
export const SUPABASE_PROD_REF = 'sxmfeocztlztvpdnxayk';
/** Branch STAGING persistente do projeto Supabase MAIN, criada na Parte 65
 * (2026-08-01) via mcp__Supabase__create_branch. Substitui o valor reservado
 * anteriormente ('khnaxcgjnvhhtgkozsif') que nunca correspondeu a um recurso
 * real — o placeholder ficou sem uso até este ref ser confirmado. */
export const SUPABASE_STAGING_REF = 'jjnnjnxjkqipgqebijen';
/** Alias legado para guards operacionais que bloqueiam explicitamente produção. */
export const SUPABASE_MAIN_REF = SUPABASE_PROD_REF;
/** Branch DEV do projeto Supabase (único ref aceito em development). */
export const SUPABASE_DEV_REF = 'rypnevnfipygyhysqpdo';
/** Refs banidos de QUALQUER runtime (previews/branches excluídos). */
export const SUPABASE_REF_DENYLIST: readonly string[] = [
  'mkyvkciwyhfawmvluugb',
  'sxdhnhoupjrnntrmjtyn', // branch DEV antigo, excluído em 2026-07-17
];
export const SUPABASE_ALLOWED_REFS: readonly string[] = [
  SUPABASE_PROD_REF,
  SUPABASE_STAGING_REF,
  SUPABASE_DEV_REF,
];
/** Todos os refs conhecidos (para a denylist cruzada por ambiente). */
export const SUPABASE_KNOWN_REFS: readonly string[] = [
  SUPABASE_PROD_REF,
  SUPABASE_STAGING_REF,
  SUPABASE_DEV_REF,
];

/**
 * Ref esperado por NODE_ENV — isolamento absoluto: cada ambiente aceita SOMENTE
 * o seu projeto. `null` significa "nenhum projeto remoto é aceito" (test):
 * qualquer ref Supabase resolvido é erro, sem fallback silencioso.
 */
export function expectedSupabaseRef(nodeEnv: string | undefined): string | null {
  if (nodeEnv === 'production') return SUPABASE_PROD_REF;
  if (nodeEnv === 'staging') return SUPABASE_STAGING_REF;
  if (nodeEnv === 'test') return null;
  return SUPABASE_DEV_REF;
}

/**
 * Denylist cruzada explícita: refs conhecidos de OUTROS ambientes são proibidos
 * mesmo que uma allowlist tenha sido editada incorretamente. Prevalece sobre
 * qualquer configuração permissiva.
 */
export function forbiddenSupabaseRefs(nodeEnv: string | undefined): readonly string[] {
  const expected = expectedSupabaseRef(nodeEnv);
  return SUPABASE_KNOWN_REFS.filter((ref) => ref !== expected);
}

/**
 * Núcleo puro e testável do guard de bootstrap (consumido por main.ts).
 * Valida conjuntamente URLs, connection strings, JWTs e coerência entre elas.
 * Retorna a lista de erros (vazia = ambiente válido). Nunca expõe secrets.
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
      // Hostname Supabase malformado (presente mas sem ref extraível) é erro;
      // conexões não-Supabase (ex.: Postgres local em test) passam sem ref.
      if (/supabase\.(co|com)/i.test(raw)) {
        errors.push(`${key} tem hostname Supabase malformado — ref não extraível`);
      }
      continue;
    }
    resolved.push([key, ref]);
    if (SUPABASE_REF_DENYLIST.includes(ref)) {
      errors.push(`${key} aponta para o ref Supabase banido "${ref}"`);
      continue;
    }
    // Denylist cruzada: ref conhecido de OUTRO ambiente é sempre proibido.
    if (forbidden.includes(ref)) {
      errors.push(
        `${key} usa ref "${ref}" de OUTRO ambiente — proibido em NODE_ENV=${nodeEnv} (denylist cruzada)`,
      );
      continue;
    }
    if (expectedRef === null) {
      errors.push(
        `${key} usa ref remoto "${ref}" mas NODE_ENV=${nodeEnv} não aceita nenhum projeto Supabase remoto`,
      );
    } else if (ref !== expectedRef) {
      errors.push(
        `${key} usa ref "${ref}" mas NODE_ENV=${nodeEnv} exige o projeto "${expectedRef}"`,
      );
    }
  }

  // Coerência: todas as fontes resolvidas devem apontar para o MESMO projeto.
  const distinctRefs = new Set(resolved.map(([, ref]) => ref));
  if (distinctRefs.size > 1) {
    errors.push(
      `Refs Supabase divergentes entre variáveis: ${resolved
        .map(([key, ref]) => `${key}=${ref}`)
        .join(' · ')} — todas devem apontar para o mesmo projeto`,
    );
  }

  // Coerência ref × payload dos JWTs (sem expor o token).
  const jwtSources: Array<[string, string | undefined, string]> = [
    ['SUPABASE_ANON_KEY', env['SUPABASE_ANON_KEY'], 'anon'],
    ['VITE_SUPABASE_ANON_KEY', env['VITE_SUPABASE_ANON_KEY'], 'anon'],
    ['SUPABASE_SERVICE_ROLE_KEY', env['SUPABASE_SERVICE_ROLE_KEY'], 'service_role'],
  ];
  for (const [key, token, expectedRole] of jwtSources) {
    if (!token) continue;
    const claims = decodeSupabaseJwtClaims(token);
    if (!claims) {
      errors.push(`${key} nao e um JWT decodificavel`);
      continue;
    }
    if (claims.ref && forbidden.includes(claims.ref)) {
      errors.push(
        `${key} tem payload ref "${claims.ref}" de OUTRO ambiente — proibido em NODE_ENV=${nodeEnv}`,
      );
    } else if (claims.ref && expectedRef !== null && claims.ref !== expectedRef) {
      errors.push(`${key} tem payload ref "${claims.ref}" != projeto esperado "${expectedRef}"`);
    } else if (claims.ref && expectedRef === null) {
      errors.push(`${key} tem payload ref "${claims.ref}" mas NODE_ENV=${nodeEnv} não aceita projeto remoto`);
    }
    if (claims.role && claims.role !== expectedRole) {
      errors.push(`${key} tem role "${claims.role}" (esperado "${expectedRole}" — chaves invertidas?)`);
    }
  }

  if (prodLike) {
    for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const) {
      if (!env[key]) errors.push(`${key} e obrigatorio em NODE_ENV=${nodeEnv}`);
    }
  }

  return errors;
}

/** Decodifica só o payload público do JWT ({ ref, role }). Nunca expõe o token. */
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
 * Extrai o project ref de qualquer formato de conexão Supabase:
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

/** Hosts locais aceitos quando a URL não é Supabase (identificação inequívoca). */
const LOCAL_DB_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Guard de COMANDOS de banco (migrate/rollback/reset/seed/scripts): além da
 * matriz completa de collectSupabaseEnvErrors, exige DATABASE_URL presente e
 * identificável — Supabase do ambiente esperado ou Postgres local explícito.
 * Host remoto não-Supabase ou URL não parseável = bloqueio fail-closed.
 * Puro e testável; nunca inclui credenciais nas mensagens.
 */
export function collectDatabaseCommandErrors(
  env: Record<string, string | undefined>,
  nodeEnvInput?: string,
): string[] {
  const nodeEnv = nodeEnvInput ?? env['NODE_ENV'] ?? 'development';
  const errors = collectSupabaseEnvErrors(env, nodeEnv);
  const url = env['DATABASE_URL'];
  if (!url || url.trim() === '') {
    errors.push('DATABASE_URL ausente/vazia — comandos de banco exigem alvo explícito');
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
      errors.push('DATABASE_URL malformada — ambiente não identificável (bloqueio fail-closed)');
    } else if (!LOCAL_DB_HOSTS.includes(host.toLowerCase())) {
      errors.push(
        `DATABASE_URL aponta para host remoto não-Supabase "${host}" — ambiente não identificável (bloqueio fail-closed)`,
      );
    }
  }
  return errors;
}

/**
 * Aborta o processo ANTES de qualquer conexão quando o alvo de banco não é o
 * autorizado para o NODE_ENV. Usado por datasource.ts (nível de módulo — quem
 * importa o DataSource não consegue contornar), seed.ts e scripts de banco.
 * `envOverride` permite validar URLs obtidas fora de process.env (ex.: .env
 * parseado manualmente). Nunca imprime URL completa, usuário ou senha.
 */
export function assertDatabaseCommandEnv(
  context: string,
  envOverride?: Record<string, string | undefined>,
): void {
  const env = envOverride ?? (process.env as Record<string, string | undefined>);
  const errors = collectDatabaseCommandErrors(env, env['NODE_ENV']);
  if (errors.length > 0) {
    console.error(`\n[${context}] BLOQUEADO — alvo de banco não autorizado para este ambiente:`);
    for (const err of errors) console.error(`  • ${err}`);
    console.error(
      'Nenhuma conexão foi aberta. Matriz de ambientes: docs/SUPABASE_ENVIRONMENTS.md\n',
    );
    process.exit(1);
  }
}

/**
 * RELEASE-01/RBAC-SHADOW-01/DBCTX-01: em produção, estas duas flags nunca podem
 * ficar no default silencioso do zod. Precisam ser declaradas explicitamente no
 * ambiente. RBAC_PERSISTED_AUTHORITY só pode permanecer em SHADOW mediante waiver
 * explícito e temporário (ALLOW_RBAC_SHADOW_IN_PRODUCTION=true) enquanto o rollout
 * do harness (test/rbac-shadow-harness) não foi aprovado; OFF é sempre proibido.
 * DATABASE_SESSION_CONTEXT_ENABLED=true sem APP_DATABASE_URL não falha aqui por
 * acidente — o DatabaseModule cai silenciosamente para a conexão bypassrls
 * (ver database.module.ts), então essa combinação também é bloqueada.
 * Recebe o env CRU (não o objeto já parseado pelo zod) porque só assim é possível
 * distinguir "declarado explicitamente" de "ausente e coberto pelo default".
 *
 * find-902e12f6 (Wave 4): o gate cobria apenas nodeEnv==='production' literal.
 * .github/workflows/staging.yml declara NODE_ENV=staging — um ambiente
 * deployado e publicamente alcançável (não um developer loopback) — que
 * caía fora do gate e herdava os defaults silenciosos (RLS/RBAC desligados).
 * `envSchema.NODE_ENV` só reconhece 4 valores; 'staging' é tratado como
 * "deployed" junto de 'production', deixando apenas 'development'/'test'
 * fora do gate.
 */
export function collectProductionAuthorityErrors(
  env: Record<string, string | undefined>,
  nodeEnvInput?: string,
): string[] {
  const nodeEnv = nodeEnvInput ?? env['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'production' && nodeEnv !== 'staging') return [];

  const errors: string[] = [];
  const envLabel = nodeEnv === 'staging' ? 'staging' : 'produção';

  const dbCtxRaw = env['DATABASE_SESSION_CONTEXT_ENABLED'];
  if (dbCtxRaw === undefined || dbCtxRaw === '') {
    errors.push(
      `DATABASE_SESSION_CONTEXT_ENABLED não declarado em ${envLabel} — o default silencioso ` +
        '("false") desliga o isolamento de sessão por tenant no DataSource de app (DBCTX-01).',
    );
  } else if (dbCtxRaw !== 'true') {
    errors.push(
      `DATABASE_SESSION_CONTEXT_ENABLED=false em ${envLabel} — isolamento de sessão por tenant desligado (DBCTX-01).`,
    );
  } else {
    const appUrl = env['APP_DATABASE_URL'];
    if (!appUrl || appUrl.trim() === '') {
      errors.push(
        'DATABASE_SESSION_CONTEXT_ENABLED=true mas APP_DATABASE_URL ausente — o DatabaseModule ' +
          'cai silenciosamente de volta para DATABASE_URL (bypassrls), anulando o isolamento de ' +
          'sessão por tenant que a flag deveria garantir (DBCTX-01).',
      );
    }
  }

  const rbacRaw = env['RBAC_PERSISTED_AUTHORITY'];
  if (rbacRaw === undefined || rbacRaw === '') {
    errors.push(
      `RBAC_PERSISTED_AUTHORITY não declarado em ${envLabel} — o default silencioso ("SHADOW") ` +
        'significa que a autorização real ainda roda apenas no motor legado (RBAC-SHADOW-01).',
    );
  } else if (rbacRaw === 'OFF') {
    errors.push(`RBAC_PERSISTED_AUTHORITY=OFF é proibido em ${envLabel} (RBAC-SHADOW-01).`);
  } else if (rbacRaw === 'SHADOW') {
    const waiver = env['ALLOW_RBAC_SHADOW_IN_PRODUCTION'] === 'true';
    if (!waiver) {
      errors.push(
        `RBAC_PERSISTED_AUTHORITY=SHADOW em ${envLabel} sem waiver — defina ` +
          'ALLOW_RBAC_SHADOW_IN_PRODUCTION=true apenas como exceção temporária formal enquanto o ' +
          'harness (test/rbac-shadow-harness) ainda não aprovou a promoção a ON (RBAC-SHADOW-01).',
      );
    }
  } else if (rbacRaw !== 'ON') {
    errors.push(`RBAC_PERSISTED_AUTHORITY="${rbacRaw}" não é um valor reconhecido (RBAC-SHADOW-01).`);
  }

  return errors;
}

// Exportado (Parte 76) só para testes diretos do superRefine (ex.: AUTH_DISABLED
// proibido fora de development) sem precisar acionar validateEnv()'s process.exit.
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
  // Waiver temporário e explícito (RBAC-SHADOW-01): permite RBAC_PERSISTED_AUTHORITY=SHADOW
  // em produção enquanto o rollout do harness (test/rbac-shadow-harness) ainda não foi
  // aprovado. Nunca deixar "true" permanentemente — remover assim que a flag for promovida a ON.
  // Validado por collectProductionAuthorityErrors, não pelo zod (precisa do valor cru, não do default).
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
  // Preços/planos NÃO vêm mais do env. Fonte primária = tabela billing_plans (admin),
  // e cada plano guarda seu stripe_price_id sincronizado. (STRIPE_PRICE_* removido.)

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
  // STAGING-01: em NODE_ENV=staging, MailService só envia para estes domínios
  // (lista separada por vírgulas) — protege contra envio acidental para
  // endereços reais durante testes manuais em staging. Sem efeito fora de staging.
  STAGING_MAIL_ALLOWLIST_DOMAINS: z.string().default('example.com'),

  // Platform Commercial Contact (decisão de produto 2026-08-22): destino do
  // formulário de contato institucional da landing do próprio Music OS 360
  // (empresas interessadas em contratar a plataforma) — NUNCA um endereço
  // inventado no código. Opcional: se ausente, o endpoint responde
  // honestamente indisponível (503) em vez de fingir que enviou.
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

  // Soundcharts — fonte de métricas públicas de audiência (backend-only,
  // client_credentials). Nunca expor via VITE_* — client_secret não pode
  // chegar ao navegador (ver SoundchartsService).
  SOUNDCHARTS_CLIENT_ID: z.string().optional(),
  SOUNDCHARTS_CLIENT_SECRET: z.string().optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),

  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().optional(),

  // WhatsApp Cloud API (Meta) — phoneNumberId/accessToken/wabaId são por
  // tenant (ver WhatsAppCloudProvider.configure, mesmo padrão do Apple Music).
  // O verify token é único por app Meta (um webhook para todas as WABAs).
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_CLIENT_SECRET: z.string().optional(),
  DOCUSIGN_AUTH_BASE_URL: z.string().url().default('https://account-d.docusign.com'),
  // HMAC key configurada no DocuSign Connect. Sem ela o webhook é rejeitado
  // fail-closed (mesma regra do AUTENTIQUE_WEBHOOK_SECRET) — nunca processar
  // um callback de assinatura sem verificar a assinatura HMAC.
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

  // Flags de conveniência LOCAL — bloqueadas fora de development pelo superRefine.
  USE_MOCK: z.string().optional(),
  MOCK_MODE: z.string().optional(),
  AUTH_DISABLED: z.string().optional(),
}).superRefine((cfg, ctx) => {
  const isProdLike = cfg.NODE_ENV === 'production' || cfg.NODE_ENV === 'staging';

  // 1) Denylist: branch preview proibido em qualquer ambiente.
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
        message: `${key} aponta para o ref Supabase banido "${ref}" (branch preview sem tabelas públicas)`,
      });
    }
  }

  // 2) Coerência: API inteira (auth + banco) deve usar UM único projeto Supabase.
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

  // 3) Produção/staging: apenas refs da allowlist; produção exige o ref de produção.
  if (isProdLike) {
    for (const [key, ref] of resolved) {
      if (!SUPABASE_ALLOWED_REFS.includes(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} usa ref "${ref}" fora da allowlist [${SUPABASE_ALLOWED_REFS.join(', ')}] em ${cfg.NODE_ENV}`,
        });
      }
      if (cfg.NODE_ENV === 'production' && ref !== SUPABASE_PROD_REF) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} deve usar o ref de produção "${SUPABASE_PROD_REF}" quando NODE_ENV=production (encontrado "${ref}")`,
        });
      }
    }

    // 4) Mock e bypass de auth são exclusivos de development.
    for (const flag of ['USE_MOCK', 'MOCK_MODE', 'AUTH_DISABLED'] as const) {
      if (cfg[flag] === 'true') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [flag],
          message: `${flag}=true é proibido em ${cfg.NODE_ENV} (permitido apenas em development)`,
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
