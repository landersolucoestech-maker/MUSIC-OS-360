/**
 * STEP 4 — Global Error Hierarchy
 *
 * Typed error system for the whole application stack.
 * Services, use cases and integrations MUST throw only these types.
 * The UI can use `instanceof` to interpret errors safely.
 */

// ─── Base ────────────────────────────────────────────────────────────────────

/** Root domain error. Every business error extends it. */
export class DomainError extends Error {
  /** Machine code for i18n and structured logging. */
  readonly code: string;
  /** Severidade para logging. */
  readonly severity: "info" | "warn" | "error" | "fatal";

  constructor(
    message: string,
    code = "DOMAIN_ERROR",
    severity: "info" | "warn" | "error" | "fatal" = "error",
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.severity = severity;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Input data validation failure. */
export class ValidationError extends DomainError {
  /** field → error message map (to render in forms). */
  readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, "VALIDATION_ERROR", "warn");
    this.name = "ValidationError";
    this.fields = fields;
  }

  /** Factory for single-field errors. */
  static field(field: string, message: string): ValidationError {
    return new ValidationError(message, { [field]: message });
  }

  /** Factory for a list of errors without a specific field. */
  static list(errors: string[]): ValidationError {
    const fields = Object.fromEntries(errors.map((e, i) => [`_${i}`, e]));
    return new ValidationError(errors.join(", "), fields);
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
  ) {
    super(
      `[tenant] Cross-tenant access denied: ${context} — record org "${recordOrgId}" ≠ current org "${currentOrgId}"`,
      "TENANT_VIOLATION",
      "fatal",
    );
    this.name = "TenantError";
    this.currentOrgId = currentOrgId;
    this.recordOrgId = recordOrgId;
  }
}

// ─── Password change required ───────────────────────────────────────────────

/** The backend refused the request because the account has a pending mandatory password change (Part 74). */
export class PasswordChangeRequiredError extends DomainError {
  constructor(message = "Troca de senha obrigatória antes de continuar.") {
    super(message, "MUST_CHANGE_PASSWORD", "warn");
    this.name = "PasswordChangeRequiredError";
  }
}

// ─── Not Found ───────────────────────────────────────────────────────────────

/** Resource not found. */
export class NotFoundError extends DomainError {
  readonly entity: string;
  readonly id: string;

  constructor(entity: string, id: string) {
    super(`${entity} "${id}" não encontrado(a)`, "NOT_FOUND", "warn");
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
    const msg =
      cause instanceof Error ? cause.message : "Erro em operação transacional";
    super(`[tx] Transação abortada e revertida: ${msg}`, "TRANSACTION_ABORTED", "error");
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

  constructor(
    service: string,
    message: string,
    options: { statusCode?: number; retryable?: boolean } = {},
  ) {
    super(`[${service}] ${message}`, "INTEGRATION_ERROR", "error");
    this.name = "IntegrationError";
    this.service = service;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
  }

  static notConfigured(service: string): IntegrationError {
    return new IntegrationError(
      service,
      "Integração não configurada. Verifique as credenciais.",
      { retryable: false },
    );
  }

  static networkError(service: string): IntegrationError {
    return new IntegrationError(
      service,
      "Falha de rede. Tentativa de reconexão...",
      { retryable: true },
    );
  }
}

// ─── Not Implemented ─────────────────────────────────────────────────────────

/** Functionality not implemented yet (real integration stub). */
export class NotImplementedError extends DomainError {
  readonly feature: string;

  constructor(feature: string, hint = "Esta funcionalidade ainda não está disponível em produção.") {
    super(`[not-implemented] ${feature}: ${hint}`, "NOT_IMPLEMENTED", "warn");
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}

// ─── Conflict ────────────────────────────────────────────────────────────────

/** Data conflict — duplicate, concurrency, etc. */
export class ConflictError extends DomainError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, "CONFLICT", "warn");
    this.name = "ConflictError";
    this.field = field;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the error is a typed domain error (safe for the UI to interpret). */
export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

/** Extrai mensagem segura de qualquer erro. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Erro inesperado. Tente novamente.";
}
