/**
 * STEP 4 — Global Error Hierarchy
 *
 * Typed error system for the whole application stack.
 * Services, use cases and integrations MUST throw only these types.
 * The UI can use `instanceof` to interpret errors safely.
 *
 * Language/boundary contract:
 *   - `message` is an INTERNAL technical diagnostic (English). It goes to logs
 *     and error reporting and is NEVER rendered to the end user.
 *   - `userMessage` is optional end-user copy (PT-BR). It exists only when the
 *     producer deliberately wrote a message for the end user (e.g. the API's
 *     HTTP exception messages, or a `UserFacingError` thrown by a hook).
 *   - The UI renders errors exclusively through `toUserMessage()`, which
 *     returns `userMessage` or a PT-BR fallback — never the raw `message`.
 */

type Severity = "info" | "warn" | "error" | "fatal";

/** Options shared by every domain error. */
export interface DomainErrorOptions {
  /** End-user copy (PT-BR). Omit when the error carries no user-facing text. */
  userMessage?: string;
}

// ─── Base ────────────────────────────────────────────────────────────────────

/** Root domain error. Every business error extends it. */
export class DomainError extends Error {
  /** Machine code for i18n and structured logging. */
  readonly code: string;
  /** Logging severity. */
  readonly severity: Severity;
  /** End-user copy (PT-BR), when the producer wrote one. */
  readonly userMessage?: string;

  constructor(
    message: string,
    code = "DOMAIN_ERROR",
    severity: Severity = "error",
    options: DomainErrorOptions = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.severity = severity;
    this.userMessage = options.userMessage;
  }
}

// ─── User-facing ─────────────────────────────────────────────────────────────

/**
 * An error whose purpose is to tell the end user something actionable
 * (e.g. "Usuário e senha são obrigatórios."). The technical `message` stays
 * English; the PT-BR copy lives in `userMessage`.
 */
export class UserFacingError extends DomainError {
  declare readonly userMessage: string;

  constructor(technicalMessage: string, userMessage: string, code = "USER_FACING") {
    super(technicalMessage, code, "warn", { userMessage });
    this.name = "UserFacingError";
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Input data validation failure. */
export class ValidationError extends DomainError {
  /** field → error message map (to render in forms). */
  readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}, options: DomainErrorOptions = {}) {
    super(message, "VALIDATION_ERROR", "warn", options);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

/** Multi-tenant isolation violation. */
export class TenantError extends DomainError {
  readonly currentOrgId: string;
  readonly recordOrgId: string | null;

  constructor(
    currentOrgId: string,
    recordOrgId: string | null,
    context = "operation",
    options: DomainErrorOptions = {},
  ) {
    super(
      `[tenant] Cross-tenant access denied: ${context} — record org "${recordOrgId}" ≠ current org "${currentOrgId}"`,
      "TENANT_VIOLATION",
      "fatal",
      options,
    );
    this.name = "TenantError";
    this.currentOrgId = currentOrgId;
    this.recordOrgId = recordOrgId;
  }
}

// ─── Password change required ───────────────────────────────────────────────

/** The backend refused the request because the account has a pending mandatory password change (Part 74). */
export class PasswordChangeRequiredError extends DomainError {
  constructor(userMessage = "Troca de senha obrigatória antes de continuar.") {
    super("Mandatory password change pending", "MUST_CHANGE_PASSWORD", "warn", { userMessage });
    this.name = "PasswordChangeRequiredError";
  }
}

// ─── Not Found ───────────────────────────────────────────────────────────────

/** Resource not found. */
export class NotFoundError extends DomainError {
  readonly entity: string;
  readonly id: string;

  constructor(entity: string, id: string, options: DomainErrorOptions = {}) {
    super(`${entity} "${id}" not found`, "NOT_FOUND", "warn", options);
    this.name = "NotFoundError";
    this.entity = entity;
    this.id = id;
  }
}

// ─── Transaction ─────────────────────────────────────────────────────────────

/** Transactional operation failure — a rollback was executed. */
export class TransactionError extends DomainError {
  readonly cause: unknown;

  constructor(cause: unknown) {
    const msg = cause instanceof Error ? cause.message : "Transactional operation error";
    super(`[tx] Transaction aborted and rolled back: ${msg}`, "TRANSACTION_ABORTED", "error");
    this.name = "TransactionError";
    this.cause = cause;
  }
}

// ─── Integration ─────────────────────────────────────────────────────────────

/** Integration failure with an external service. */
export class IntegrationError extends DomainError {
  readonly service: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  /** Machine error code sent by the API in the `error` field (e.g. "R2_NOT_CONFIGURED"). */
  readonly errorCode?: string;

  constructor(
    service: string,
    message: string,
    options: { statusCode?: number; retryable?: boolean; errorCode?: string } & DomainErrorOptions = {},
  ) {
    super(`[${service}] ${message}`, "INTEGRATION_ERROR", "error", { userMessage: options.userMessage });
    this.name = "IntegrationError";
    this.service = service;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.errorCode = options.errorCode;
  }

  static notConfigured(service: string): IntegrationError {
    return new IntegrationError(service, "Integration not configured", {
      retryable: false,
      userMessage: "Integração não configurada. Verifique as credenciais.",
    });
  }

  static networkError(service: string): IntegrationError {
    return new IntegrationError(service, "Network failure; reconnecting", {
      retryable: true,
      userMessage: "Falha de rede. Tentando reconectar...",
    });
  }
}

// ─── Not Implemented ─────────────────────────────────────────────────────────

/** Functionality not implemented yet (real integration stub). */
export class NotImplementedError extends DomainError {
  readonly feature: string;

  constructor(feature: string, userMessage = "Esta funcionalidade ainda não está disponível em produção.") {
    super(`[not-implemented] ${feature}`, "NOT_IMPLEMENTED", "warn", { userMessage });
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}

// ─── Conflict ────────────────────────────────────────────────────────────────

/** Data conflict — duplicate, concurrency, etc. */
export class ConflictError extends DomainError {
  readonly field?: string;

  constructor(message: string, field?: string, options: DomainErrorOptions = {}) {
    super(message, "CONFLICT", "warn", options);
    this.name = "ConflictError";
    this.field = field;
  }
}

// ─── Presentation boundary ───────────────────────────────────────────────────

/** Generic PT-BR copy used when an error carries no user-facing message. */
export const DEFAULT_USER_ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";

/** Returns true if the error is a typed domain error (safe for the UI to interpret). */
export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

/**
 * The ONLY way the UI turns an error into text for the end user.
 * Returns the producer's PT-BR `userMessage` when present, otherwise the
 * PT-BR `fallback`. A raw technical `message` (provider internals, HTTP
 * status, payload details, `Failed to fetch`, ...) is never returned.
 */
export function toUserMessage(err: unknown, fallback: string = DEFAULT_USER_ERROR_MESSAGE): string {
  if (err instanceof DomainError && err.userMessage) return err.userMessage;
  return fallback;
}
