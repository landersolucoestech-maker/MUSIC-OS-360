/**
 * HTTP API Client — singleton that manages tokens and makes requests to the backend.
 *
 * - Injects Authorization: Bearer <token> automatically
 * - Injects X-Tenant-ID automatically
 * - Converts HTTP errors into DomainError subclasses (instanceof works)
 * - Token lifecycle managed by the Supabase SDK via AuthContext.tsx
 *   (auto-refresh, persistence and rotation are the SDK's responsibility)
 * - Tables without a backend endpoint → fallback to in-memory data (mock)
 */
import {
  ValidationError,
  TenantError,
  NotFoundError,
  ConflictError,
  IntegrationError,
  PasswordChangeRequiredError,
} from "./errors";
import { API_BASE_URL, DEV_AUTH_BYPASS } from "./env";

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

let _accessToken: string | null = null;
let _tenantId: string | null = null;

export function setAccessToken(t: string | null): void {
  _accessToken = t;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setTenantId(tenantId: string | null): void {
  _tenantId = tenantId;
}

export function getTenantId(): string | null {
  return _tenantId;
}

export const TABLE_ENDPOINT = {
  artistas: "/artists",
  artists: "/artists",
  obras: "/works",
  fonogramas: "/phonograms",
  shares: "/shares",
  contracts: "/contracts",
  templates_contratos: "/contract-templates",
  contract_templates: "/contract-templates",
  transactions: "/transactions",
  leads: "/leads",
  clientes: "/clients",
  contatos: "/clients",
  campanhas: "/campaigns",
  marketing_projects: "/marketing/projects",
  conteudos: "/marketing/contents",
  briefings: "/briefings",
  takedowns: "/takedowns",
  projects: "/projects",
  events: "/events",
  funcionarios: "/hr/employees",
  folha_pagamento: "/hr/payroll",
  afastamentos: "/hr/leave-requests",
  ferias_ausencias: "/hr/leave-requests",
  usuarios: "/users",
  users: "/users",
  org_members: "/users",
  lancamentos: "/releases",
  invoices: "/invoices",
  proposals: "/proposals",
  proposal_items: "/proposal-items",
  followups: "/followups",
  lead_interactions: "/lead-interactions",
  metas_artistas: "/artist-goals",
  relatorios_ecad: "/ecad-reports",
  ecad_reports: "/ecad-reports",
  deteccoes: "/content-detections",
  content_detections: "/content-detections",
  documentos_funcionario: "/hr/employees",
  support_tickets: "/support-tickets",
  audit_logs: "/audit-logs",
  inventario: "/inventory",
  licencas: "/licenses",
  regras_financeiras: "/financial-rules",
  financial_categories: "/financial-categories",
  categorias_financeiras: "/financial-categories",
  contract_service_types: "/contract-service-types",
} as const satisfies Record<string, string>;

export const PENDING_TABLES = {
  regras: "Rules UI storage table has no backend controller",
  tarefas_marketing: "Marketing tasks have no backend controller",
  monitoramentos: "Monitoring table has no backend controller",
  roles: "RBAC is currently exposed through /users and auth context, not a /roles CRUD",
  permissions: "Permissions are computed server-side, not exposed as a /permissions CRUD",
  integrations: "Integrations are exposed via sub-routes (integrations/autentique, integrations/external-data), not a flat /integrations CRUD",
} as const satisfies Record<string, string>;

/** Every table key the storage layer resolves (a typo or a removed key fails typecheck). */
export type StorageTable = keyof typeof TABLE_ENDPOINT | keyof typeof PENDING_TABLES;

async function mapError(res: Response): Promise<never> {
  let body: { message?: string | string[]; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {}

  const rawMsg = body.message;
  // The API's HTTP exception messages are end-user copy (PT-BR) by contract;
  // they become `userMessage`. `technical` is the internal diagnostic.
  const userMessage = Array.isArray(rawMsg) ? rawMsg.join("; ") : rawMsg;
  const technical = `API responded ${res.status}${body.error ? ` (${body.error})` : ""}`;

  switch (res.status) {
    case 400:
      throw new ValidationError(technical, {}, { userMessage });
    case 403:
      // GlobalExceptionFilter preserves the `error` code of guards such as
      // MustChangePasswordGuard (see apps/api/.../global-exception.filter.ts) —
      // without it, every 403 became a generic TenantError and the frontend had
      // no way to know it needed to show the password change screen.
      if (body.error === "MUST_CHANGE_PASSWORD") {
        throw new PasswordChangeRequiredError(userMessage);
      }
      throw new TenantError("", "", technical, { userMessage });
    case 404:
      throw new NotFoundError("resource", res.url, { userMessage });
    case 409:
      throw new ConflictError(technical, undefined, { userMessage });
    default:
      throw new IntegrationError("api", technical, { statusCode: res.status, userMessage, errorCode: body.error });
  }
}

// ── 401 circuit-breaker — stops polling/request storms when auth is invalid ──
// After a 401 we short-circuit further requests for AUTH_BACKOFF_MS so 30+ background
// pollers don't flood the API while React Query/etc. realise auth is gone.
const AUTH_BACKOFF_MS = 30_000;
let _authFailUntil = 0;
const _authBus = new EventTarget();

export function onAuthInvalidated(listener: () => void): () => void {
  const fn = () => listener();
  _authBus.addEventListener('invalid', fn);
  return () => _authBus.removeEventListener('invalid', fn);
}

export function clearAuthBackoff(): void {
  _authFailUntil = 0;
}

// Network timeout: without it, an unavailable backend whose connection hangs
// in SYN (dropped instead of refused — behavior observed in some
// environments/proxies) makes `fetch()` hang for dozens of seconds without
// ever resolving or rejecting, keeping React Query's `isLoading` stuck
// indefinitely (the UI never reaches the already planned error state). A
// finite timeout ensures every call always resolves or rejects in
// bounded time, letting the query settle (success or error) normally.
const REQUEST_TIMEOUT_MS = 10_000;

// Combines the external AbortSignal (e.g. React Query's — it fires when the
// query becomes obsolete: component unmounted, queryKey changed) with the internal
// timeout, without depending on AbortSignal.any (avoids a compatibility risk
// given the project's current lib/target). Either one aborting aborts
// the fetch; the timeout keeps working even without an external signal.
function combineSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  if (a.aborted || b.aborted) {
    const already = new AbortController();
    already.abort();
    return already.signal;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Short-circuit during auth backoff window — don't hit network.
  if (Date.now() < _authFailUntil) {
    throw new IntegrationError('api', 'Auth invalidated — request paused', { statusCode: 401 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined ?? {}),
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  if (_tenantId) {
    headers["X-Tenant-ID"] = _tenantId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = combineSignals(controller.signal, init.signal ?? undefined);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new IntegrationError("api", "API request timed out", {
        statusCode: 0,
        retryable: true,
        userMessage: "O servidor não respondeu a tempo. Tente novamente.",
      });
    }
    throw new IntegrationError("api", "API connection failure", {
      statusCode: 0,
      retryable: true,
      userMessage: "Falha de conexão com o servidor. Verifique sua internet e tente novamente.",
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    setAccessToken(null);
    // DEV ONLY (VITE_DISABLE_AUTH=true): under the frontend bypass, authenticated
    // calls without a real token get 401 expectedly and repeatedly (the
    // backend was not changed). We do not arm the 30s circuit breaker here —
    // it exists to stop poller storms when a REAL session
    // dropped, not for the case where we already know, by design, that there is no session
    // at all. Each call still returns its own 401 error mapped
    // below (mapError) — nothing is hidden, we only avoid the whole navigation
    // being paused for 30s on every authenticated request.
    if (!DEV_AUTH_BYPASS && _authFailUntil < Date.now()) {
      _authFailUntil = Date.now() + AUTH_BACKOFF_MS;
      _authBus.dispatchEvent(new Event('invalid'));
    }
  }

  if (!res.ok) {
    return mapError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const payload = (await res.json()) as ApiResponse<T>;
  return payload.data;
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined ?? {}),
    },
  });
  if (!res.ok) return mapError(res);
  if (res.status === 204) return undefined as T;
  const payload = (await res.json()) as ApiResponse<T>;
  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: { signal?: AbortSignal }) => request<T>(path, { signal: options?.signal }),
  post: <T>(path: string, body: unknown, options?: { headers?: Record<string, string> }) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: options?.headers,
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (path: string) =>
    request<void>(path, {
      method: "DELETE",
    }),
};

export const publicApi = {
  get: <T>(path: string) => publicRequest<T>(path),
  post: <T>(path: string, body: unknown) =>
    publicRequest<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
