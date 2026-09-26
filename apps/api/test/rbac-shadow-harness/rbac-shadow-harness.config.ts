/**
 * STEP 12-J.5 — Configuration of the RBAC SHADOW traffic E2E harness.
 *
 * Reads everything from environment variables (STAGING .env). NEVER commit secrets.
 * Fabricates no data: it only parameterizes real HTTP requests against the deployed API.
 */

export type HarnessRole =
  | 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'accounting' | 'artist';

export interface RoleCredential {
  role: HarnessRole;
  email: string;
  password: string;
}

export interface HarnessConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  tenants: string[]; // tenant_ids reais de staging
  credentials: RoleCredential[];
  targets: {
    requests: number;
    endpoints: number;
    resources: number;
    roles: number;
    tenants: number;
  };
}

const REQUIRED_ROLES: HarnessRole[] = ['owner', 'admin', 'manager', 'editor', 'viewer'];
const OPTIONAL_ROLES: HarnessRole[] = ['accounting', 'artist'];

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`[harness] variável obrigatória ausente: ${name}`);
  return v;
}

function credFor(role: HarnessRole, optional: boolean): RoleCredential | null {
  const key = role.toUpperCase();
  const email = env(`RBAC_HARNESS_${key}_EMAIL`);
  const password = env(`RBAC_HARNESS_${key}_PASSWORD`);
  if (!email || !password) {
    if (optional) return null;
    throw new Error(`[harness] credenciais obrigatórias ausentes para role '${role}'`);
  }
  return { role, email, password };
}

export function loadHarnessConfig(): HarnessConfig {
  const tenants = [
    requireEnv('RBAC_HARNESS_TENANT_A'),
    requireEnv('RBAC_HARNESS_TENANT_B'),
    requireEnv('RBAC_HARNESS_TENANT_C'),
  ];

  const credentials: RoleCredential[] = [];
  for (const role of REQUIRED_ROLES) {
    const c = credFor(role, false);
    if (c) credentials.push(c);
  }
  for (const role of OPTIONAL_ROLES) {
    const c = credFor(role, true);
    if (c) credentials.push(c);
  }

  return {
    apiUrl: requireEnv('STAGING_API_URL').replace(/\/+$/, ''),
    supabaseUrl: requireEnv('STAGING_SUPABASE_URL').replace(/\/+$/, ''),
    supabaseAnonKey: requireEnv('STAGING_SUPABASE_ANON_KEY'),
    tenants,
    credentials,
    targets: {
      requests: Number(env('RBAC_HARNESS_TARGET_REQUESTS') ?? 1000),
      endpoints: Number(env('RBAC_HARNESS_TARGET_ENDPOINTS') ?? 10),
      resources: Number(env('RBAC_HARNESS_TARGET_RESOURCES') ?? 5),
      roles: Number(env('RBAC_HARNESS_TARGET_ROLES') ?? 5),
      tenants: Number(env('RBAC_HARNESS_TARGET_TENANTS') ?? 3),
    },
  };
}

/** Hierarquia (espelha ROLE_HIERARCHY do backend) — usada para prever allow/deny. */
export const ROLE_LEVEL: Record<HarnessRole, number> = {
  owner: 90, admin: 80, manager: 70, editor: 60, accounting: 60, artist: 30, viewer: 10,
};
