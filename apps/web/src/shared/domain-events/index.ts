/**
 * STEP 1 — Domain Events System
 *
 * Lightweight, typed domain event bus.
 * Decouples modules: use cases emit, any module can react
 * without importing the emitter directly.
 *
 * API:
 *   emit(event, payload)       — fires an event
 *   subscribe(event, handler)  — registers a listener; returns unsubscribe()
 *   subscribeOnce(event, h)    — one-shot listener
 *   clearAll()                 — clears every listener (tests)
 */

// ─── Event catalog ───────────────────────────────────────────────────────────

export const DomainEvents = {
  // Artists
  ARTIST_CREATED: "ARTIST_CREATED",
  ARTIST_UPDATED: "ARTIST_UPDATED",
  ARTIST_DELETED: "ARTIST_DELETED",

  // Catalog
  MUSIC_REGISTERED:    "MUSIC_REGISTERED",
  MUSIC_UPDATED:       "MUSIC_UPDATED",
  MUSIC_DELETED:       "MUSIC_DELETED",
  PHONOGRAM_REGISTERED: "PHONOGRAM_REGISTERED",
  PHONOGRAM_UPDATED:   "PHONOGRAM_UPDATED",
  PHONOGRAM_DELETED:   "PHONOGRAM_DELETED",

  // Contracts
  CONTRACT_CREATED:          "CONTRACT_CREATED",
  CONTRACT_UPDATED:          "CONTRACT_UPDATED",
  CONTRACT_DELETED:          "CONTRACT_DELETED",
  CONTRACT_SIGNED:           "CONTRACT_SIGNED",
  CONTRACT_SENT_FOR_SIGNING:  "contrato.sent_for_signing",
  CONTRACT_SIGNING_CANCELLED: "contrato.signing_cancelled",
  CONTRACT_TEMPLATE_CREATED: "CONTRACT_TEMPLATE_CREATED",
  CONTRACT_TEMPLATE_UPDATED: "CONTRACT_TEMPLATE_UPDATED",
  CONTRACT_TEMPLATE_DELETED: "CONTRACT_TEMPLATE_DELETED",

  // Releases
  RELEASE_CREATED: "RELEASE_CREATED",
  RELEASE_UPDATED: "RELEASE_UPDATED",
  RELEASE_DELETED: "RELEASE_DELETED",
  RELEASE_APPROVED: "release.approved",
  RELEASE_REJECTED: "release.rejected",

  // Shares (ownership management of works/sound recordings)
  SHARE_CREATED: "SHARE_CREATED",
  SHARE_UPDATED: "SHARE_UPDATED",
  SHARE_DELETED: "SHARE_DELETED",

  // Utilizadores / Tenant
  USER_INVITED: "user.invited",

  // CRM / Leads
  LEAD_CAPTURED:  "LEAD_CAPTURED",
  LEAD_CONVERTED: "LEAD_CONVERTED",

  // Finance
  TRANSACTION_CREATED: "TRANSACTION_CREATED",
  TRANSACTION_UPDATED: "TRANSACTION_UPDATED",
  TRANSACTION_DELETED: "TRANSACTION_DELETED",
  FINANCE_CALCULATED:  "FINANCE_CALCULATED",

  // Invoices (Notas Fiscais)
  INVOICE_CREATED: "INVOICE_CREATED",
  INVOICE_UPDATED: "INVOICE_UPDATED",
  INVOICE_DELETED: "INVOICE_DELETED",

  // System
  AUDIT_ENTRY_CREATED: "AUDIT_ENTRY_CREATED",
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

// ─── Payload types per event ─────────────────────────────────────────────────

export interface ArtistCreatedPayload {
  id: string;
  nome_artistico: string;
  org_id: string;
}

export interface MusicRegisteredPayload {
  work_id: string;
  fonograma_id?: string;
  title: string;
  org_id: string;
}

export interface ContractCreatedPayload {
  id: string;
  artist_id?: string;
  valor?: number;
  org_id: string;
}

export interface ReleaseCreatedPayload {
  id: string;
  title: string;
  artist_id?: string;
  org_id: string;
}

export interface LeadCapturedPayload {
  id: string;
  nome: string;
  org_id: string;
}

export interface TransactionCreatedPayload {
  id: string;
  type: "receita" | "despesa";
  valor: number;
  artist_id?: string;
  project_id?: string;
  org_id: string;
}

export interface AuditEntryCreatedPayload {
  entity: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  org_id: string | null;
  timestamp: string;
}

export type DomainEventPayloads = {
  ARTIST_CREATED:        ArtistCreatedPayload;
  ARTIST_UPDATED:        Partial<ArtistCreatedPayload> & { id: string };
  ARTIST_DELETED:        { id: string; org_id: string };
  MUSIC_REGISTERED:      MusicRegisteredPayload;
  MUSIC_UPDATED:         Partial<MusicRegisteredPayload> & { work_id: string };
  MUSIC_DELETED:         { work_id: string; org_id: string };
  PHONOGRAM_REGISTERED:  { id: string; work_id: string; org_id: string };
  PHONOGRAM_UPDATED:     { id: string; work_id: string; org_id: string };
  PHONOGRAM_DELETED:     { id: string; org_id: string };
  CONTRACT_CREATED:          ContractCreatedPayload;
  CONTRACT_UPDATED:          Partial<ContractCreatedPayload> & { id: string };
  CONTRACT_DELETED:          { id: string; org_id: string };
  CONTRACT_SIGNED:           { id: string; org_id: string };
  CONTRACT_TEMPLATE_CREATED: { id: string; name?: string; type?: string; org_id: string };
  CONTRACT_TEMPLATE_UPDATED: { id: string; name?: string; type?: string; org_id: string };
  CONTRACT_TEMPLATE_DELETED: { id: string; org_id: string };
  RELEASE_CREATED:       ReleaseCreatedPayload;
  RELEASE_UPDATED:       Partial<ReleaseCreatedPayload> & { id: string };
  RELEASE_DELETED:       { id: string; org_id: string };
  SHARE_CREATED:         { id: string; work_id?: string; artist_id?: string; percentage?: number; org_id: string };
  SHARE_UPDATED:         { id: string; work_id?: string; artist_id?: string; percentage?: number; org_id: string };
  SHARE_DELETED:         { id: string; org_id: string };
  LEAD_CAPTURED:         LeadCapturedPayload;
  LEAD_CONVERTED:        { id: string; artist_id?: string; org_id: string };
  TRANSACTION_CREATED:   TransactionCreatedPayload;
  TRANSACTION_UPDATED:   Partial<TransactionCreatedPayload> & { id: string };
  TRANSACTION_DELETED:   { id: string; org_id: string };
  FINANCE_CALCULATED:    { artist_id: string; valor: number; org_id: string };
  INVOICE_CREATED:       { id: string; numero?: string; client_id?: string; valor?: number; org_id: string };
  INVOICE_UPDATED:       { id: string; numero?: string; client_id?: string; valor?: number; org_id: string };
  INVOICE_DELETED:       { id: string; org_id: string };
  AUDIT_ENTRY_CREATED:   AuditEntryCreatedPayload;
  "user.invited":               { tenantId: string; email: string; role: string };
  "contrato.sent_for_signing":  { contratoId: string; signers: unknown[]; org_id?: string };
  "contrato.signing_cancelled": { contratoId: string; reason?: string; org_id?: string };
  "release.approved":           { releaseId: string; reason?: string };
  "release.rejected":           { releaseId: string; reason?: string };
};

// ─── Event Bus ───────────────────────────────────────────────────────────────

type Handler<T> = (payload: T) => void | Promise<void>;

const _listeners = new Map<string, Handler<unknown>[]>();

/**
 * Emits a domain event to every registered subscriber.
 * Handler errors are caught and logged without interrupting other handlers.
 */
export function emit<K extends DomainEventName>(
  event: K,
  payload: DomainEventPayloads[K],
): void {
  const handlers = _listeners.get(event) ?? [];
  for (const handler of handlers) {
    try {
      const result = handler(payload as unknown);
      if (result instanceof Promise) {
        result.catch((err) =>
          console.error(`[domain-events] Handler error for ${event}:`, err),
        );
      }
    } catch (err) {
      console.error(`[domain-events] Sync handler error for ${event}:`, err);
    }
  }

  // Also dispatches as a CustomEvent on window for native listeners (devtools, etc.)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(`musicos360:${event}`, { detail: payload }),
    );
  }
}

/**
 * Registers a handler for a domain event.
 * Returns a cleanup function (unsubscribe).
 */
export function subscribe<K extends DomainEventName>(
  event: K,
  handler: Handler<DomainEventPayloads[K]>,
): () => void {
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event)!.push(handler as Handler<unknown>);

  return () => {
    const list = _listeners.get(event);
    if (list) {
      const idx = list.indexOf(handler as Handler<unknown>);
      if (idx !== -1) list.splice(idx, 1);
    }
  };
}

/**
 * One-shot handler — removes itself after the first execution.
 */
export function subscribeOnce<K extends DomainEventName>(
  event: K,
  handler: Handler<DomainEventPayloads[K]>,
): () => void {
  const unsub = subscribe(event, (payload) => {
    unsub();
    return handler(payload);
  });
  return unsub;
}

/**
 * Removes every listener (useful in tests).
 */
export function clearAll(): void {
  _listeners.clear();
}

/**
 * Returns the number of listeners registered for an event.
 */
export function listenerCount(event: DomainEventName): number {
  return _listeners.get(event)?.length ?? 0;
}

