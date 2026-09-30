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
  DEFAULT_USER_ERROR_MESSAGE,
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
  artists: "/artists",
  works: "/works",
  phonograms: "/phonograms",
  shares: "/shares",
  contracts: "/contracts",
  contract_templates: "/contract-templates",
  transactions: "/transactions",
  leads: "/leads",
  clients: "/clients",
  campaigns: "/campaigns",
  marketing_projects: "/marketing/projects",
  marketing_contents: "/marketing/contents",
  briefings: "/briefings",
  takedowns: "/takedowns",
  projects: "/projects",
  events: "/events",
  employees: "/hr/employees",
  payroll_entries: "/hr/payroll",
  leave_requests: "/hr/leave-requests",
  users: "/users",
  org_members: "/users",
  releases: "/releases",
  invoices: "/invoices",
  proposals: "/proposals",
  proposal_items: "/proposal-items",
  followups: "/followups",
  lead_interactions: "/lead-interactions",
  artist_goals: "/artist-goals",
  ecad_reports: "/ecad-reports",
  content_detections: "/content-detections",
  employee_documents: "/hr/employees",
  support_tickets: "/support-tickets",
  audit_logs: "/audit-logs",
  inventory_items: "/inventory",
  licenses: "/licenses",
  financial_rules: "/financial-rules",
  financial_categories: "/financial-categories",
  contract_service_types: "/contract-service-types",
} as const satisfies Record<string, string>;

export const PENDING_TABLES = {
  rules: "Rules UI storage table has no backend controller",
  marketing_tasks: "Marketing tasks have no backend controller",
  monitoring: "Monitoring table has no backend controller",
  roles: "RBAC is currently exposed through /users and auth context, not a /roles CRUD",
  permissions: "Permissions are computed server-side, not exposed as a /permissions CRUD",
  integrations: "Integrations are exposed via sub-routes (integrations/autentique, integrations/external-data), not a flat /integrations CRUD",
} as const satisfies Record<string, string>;

/** Every table key the storage layer resolves (a typo or a removed key fails typecheck). */
export type StorageTable = keyof typeof TABLE_ENDPOINT | keyof typeof PENDING_TABLES;

/**
 * Stable machine codes the API puts in the `error` field, each with the PT-BR
 * default copy the UI falls back to when the server text is missing or unsafe.
 * Keep in sync with the API's `error: 'CODE'` producers (canonical map).
 */
export const KNOWN_API_ERROR_CODES: Readonly<Record<string, string>> = {
  VALIDATION_FAILED: "Os dados enviados são inválidos. Revise os campos e tente novamente.",
  MUST_CHANGE_PASSWORD: "Troca de senha obrigatória antes de continuar.",
  TENANT_SUSPENDED: "O workspace está suspenso. Entre em contato com o suporte.",
  TENANT_READ_ONLY: "O workspace está em modo somente leitura.",
  PERMISSION_DENIED: "Você não tem permissão para realizar esta ação.",
  PLAN_LIMIT_REACHED: "O limite do seu plano foi atingido.",
  R2_NOT_CONFIGURED: "O envio de arquivos não está disponível no momento.",
  INVITE_CREATE_FAILED: "Não foi possível criar o convite. Tente novamente.",
  INVITE_METADATA_FAILED: "Não foi possível criar o convite. Tente novamente.",
  INVITE_RESEND_FAILED: "Não foi possível reenviar o convite. Tente novamente.",
  SESSION_UPDATE_FAILED: "Não foi possível atualizar a sessão. Tente novamente.",
  ROLE_UNKNOWN: "Papel desconhecido. Não é possível atribuí-lo.",
  SYNC_QUEUE_UNAVAILABLE: "A sincronização está indisponível no momento. Tente novamente.",
  PROFILE_NOT_FOUND: "Perfil não encontrado.",
  INVALID_XLSX_WORKBOOK: "A planilha enviada é inválida.",
  SINGLE_SHEET_REQUIRED: "A planilha deve conter uma única aba.",
  UNSUPPORTED_IMPORT_FORMAT: "Formato de importação não suportado.",
  UNSUPPORTED_EXPORT_FORMAT: "Formato de exportação não suportado.",
  INVALID_IMPORT_SIZE: "O arquivo de importação excede o tamanho permitido.",
  INVALID_IMPORT_ENCODING: "A codificação do arquivo de importação é inválida.",
  IMPORT_PARSER_BUSY: "A importação está ocupada. Tente novamente em instantes.",
  REPORT_ENTITY_NOT_AVAILABLE: "Este relatório não está disponível.",
  REPORT_CONTRACT_REQUIRED: "Selecione um contrato para gerar este relatório.",
  REPORT_EXPORT_TOO_LARGE: "O relatório é grande demais para exportar. Refine os filtros.",
};

/** PT-BR defaults by HTTP status, used when the server text cannot be trusted. */
const STATUS_DEFAULT_COPY: Readonly<Record<number, string>> = {
  400: "Os dados enviados são inválidos. Revise e tente novamente.",
  401: "Sua sessão expirou. Entre novamente.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "Não encontramos o recurso solicitado.",
  409: "Não foi possível concluir a operação por conflito com outros dados.",
  413: "O conteúdo enviado excede o limite permitido.",
  422: "Os dados enviados são inválidos. Revise e tente novamente.",
  429: "Muitas tentativas. Aguarde um instante e tente novamente.",
};
const SERVER_ERROR_COPY = "O servidor encontrou um problema. Tente novamente em instantes.";

/** Provider / database / runtime vocabulary that is never end-user copy. */
const TECHNICAL_TEXT = new RegExp(
  [
    String.raw`\b(?:ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|SQLSTATE)\b`,
    String.raw`duplicate key|violates|unique constraint|foreign key|null value in column|syntax error at`,
    String.raw`password authentication|authentication failed|permission denied for|relation ".*" (?:does not|already)`,
    String.raw`\b(?:TypeError|ReferenceError|RangeError|SyntaxError|QueryFailedError|EntityNotFound\w*)\b`,
    String.raw`^\s*(?:[A-Z]\w*)?Error:`,
    String.raw`\bat\s+\S+.*:\d+(?::\d+)?\)?`,
    String.raw`node_modules|\.(?:ts|js|mjs):\d+`,
    String.raw`\b\d{1,3}(?:\.\d{1,3}){3}\b`,
    String.raw`:\d{4,5}\b`,
    String.raw`\b(?:postgres(?:ql)?|mysql|redis|amqp|mongodb):\/\/`,
    String.raw`\b(?:supabase|typeorm|bullmq|pg_|gotrue)\b`,
    String.raw`[\r\n]`,
  ].join("|"),
  "i",
);

/** PT-BR signal: accented letters or common PT-BR function words. English provider text has neither. */
const PT_BR_SIGNAL =
  /[áàâãéêíóôõúç]|(?<![\p{L}])(?:não|para|com|deve|devem|informe|seu|sua|você|já|está|foi|uma|dos|das|pelo|pela|inválid\w*|obrigat\w*|suspenso|permitid\w*|encontrad\w*)(?![\p{L}])/iu;

const MAX_COPY_LENGTH = 300;

/** Own-property check: `constructor`/`__proto__` are not codes. */
function isKnownApiErrorCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(KNOWN_API_ERROR_CODES, code);
}

function isSafeCopy(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0 && text.length <= MAX_COPY_LENGTH && !TECHNICAL_TEXT.test(text);
}

function defaultCopyFor(status: number, code: string | undefined): string {
  if (code && isKnownApiErrorCode(code)) return KNOWN_API_ERROR_CODES[code];
  if (status >= 500) return SERVER_ERROR_COPY;
  return STATUS_DEFAULT_COPY[status] ?? DEFAULT_USER_ERROR_MESSAGE;
}

/**
 * Decides which text of an API error body may become end-user copy.
 *
 * The server's `message` is used only when it is the API's own PT-BR copy:
 *  - the body carries a KNOWN stable code (VALIDATION_FAILED shape included) and the text is
 *    free of technical vocabulary; or
 *  - the text is free of technical vocabulary AND carries a PT-BR signal (the API's own
 *    HttpException copy is PT-BR by contract, enforced by http-exception-copy.guard.spec).
 * Everything else (English/raw provider or database text, stack lines, oversized text) is
 * replaced by PT-BR copy mapped from the code or the HTTP status.
 */
export function resolveApiUserMessage(
  status: number,
  body: { message?: unknown; error?: unknown },
): string {
  const code = typeof body.error === "string" ? body.error : undefined;
  const known = code !== undefined && isKnownApiErrorCode(code);
  const candidates = (Array.isArray(body.message) ? body.message : [body.message]).filter(isSafeCopy);
  const trusted = candidates.filter((text) => known || PT_BR_SIGNAL.test(text));
  // A partly-unsafe validation list still shows its safe entries; nothing safe -> mapped default.
  if (trusted.length > 0) return trusted.join("; ");
  return defaultCopyFor(status, code);
}

async function mapError(res: Response): Promise<never> {
  let body: { message?: string | string[]; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {}

  // `userMessage` is end-user copy (PT-BR); it is never the raw server text unless it passes
  // resolveApiUserMessage. `technical` is the internal diagnostic and never rendered.
  const userMessage = resolveApiUserMessage(res.status, body);
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
