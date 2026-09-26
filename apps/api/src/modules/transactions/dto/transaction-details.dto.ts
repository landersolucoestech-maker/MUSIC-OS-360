/**
 * One concept, one canonical name (see docs/NAMING_NORMALIZATION_CANONICAL_MAP.md
 * and .claude/rules/naming-canonical.md). The INTERNAL TECHNICAL CONTRACT is always in
 * ENGLISH — this holds both for fields originating from a physical column and
 * for fields originating from `entity.metadata` (jsonb). The legacy
 * Portuguese-named database (`TransactionEntity`, `apps/api/src/database/entities.ts`) is an
 * EXTERNAL boundary: the PT (real column/key) <-> EN (field of this
 * DTO) mapping happens exclusively in `toTransactionDetails()` (read) and in
 * `buildPersistencePayload()` (write), both in `transactions.service.ts`.
 * No Portuguese column/key name may leak outside those two
 * translation points.
 *
 * Physical origin of each field (for whoever touches the mapper):
 *  - type, description, amount, transactionDate, category, artistId,
 *    contractId, projectId, created_at, updated_at: physical columns of
 *    `transactions` (`type`, `descricao`, `valor`, `data`, `categoria`,
 *    `artist_id`, `contrato_id`, `project_id`, `created_at`, `updated_at`).
 *  - note, paymentMethod, paymentType, installments, subcategory,
 *    supplierOrClient: keys of `entity.metadata`
 *    (`observacao`, `formaPagamento`, `tipoPagamento`, `quantidadeParcelas`,
 *    `subcategoria`, `fornecedorCliente`).
 *  - linkedEventId: the entity HAS a physical `evento_id` column, but it is never
 *    written nor read by this service — the real value always comes from
 *    `entity.metadata.eventoVinculado`. Keeping the name `evento_id`/`eventoId`
 *    in the DTO would be misleading (it implies an FK column), which is why the canonical name here
 *    is `linkedEventId`. The dead `evento_id` column is a matter for
 *    `entities.ts`, out of this change's scope.
 *  - `id`/`created_at`/`updated_at`: already physical columns with no PT equivalent
 *    different from the name itself, kept as they are (`created_at`/`updated_at`
 *    stay snake_case because they are audit timestamps already consumed that way
 *    by other parts of the system — not a Portuguese name, it is the audit
 *    column convention).
 *
 * Recorded naming decisions (to avoid future rework):
 *  - `data` (PT, physical column, entry date) -> `transactionDate`, and
 *    not `date`, because the DTO already has `dueDate`, `paidAt` and `competence` — a
 *    generic `date` field would be ambiguous among those four distinct dates.
 *  - `observacao` (PT, metadata) -> `note` (singular). There is no `notes` in the
 *    DTO, so there is no collision.
 *  - `quantidadeParcelas` (PT, metadata, TOTAL number of installments) ->
 *    `installments`. Kept distinct from `installmentCurrent` (which is already EN and
 *    represents the CURRENT installment, a different concept) — no collision.
 *  - `fornecedorCliente` (PT, metadata, free string filled in by the
 *    form) -> `supplierOrClient`. The pre-existing `supplier` field is
 *    ANOTHER metadata key (`metadata.supplier`) that no writer of this service
 *    ever populates — there is no write path for it in
 *    `buildPersistencePayload`. They are concepts that already lived decoupled in
 *    metadata; `supplier` is recorded here as dead/never-written data,
 *    not as a synonym of `supplierOrClient`. Renaming or removing `supplier`
 *    is out of this change's scope (no task asked for it).
 */
export interface TransactionDetailsDTO {
  id: string;
  type: string;
  status: string;
  description: string | null;
  note?: string | null;
  amount: number;
  grossAmount?: number | null;
  netAmount?: number | null;
  fees?: number | null;
  discount?: number | null;
  taxes?: number | null;
  interest?: number | null;
  fine?: number | null;
  currency?: string | null;
  transactionDate?: string | null;
  competence?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  recurrence?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  installments?: number | string | null;
  installmentCurrent?: number | null;
  bankAccount?: Record<string, unknown> | string | null;
  category?: string | null;
  subcategory?: string | null;
  costCenter?: Record<string, unknown> | string | null;
  tags?: string[];
  labels?: string[];
  attachments?: Array<Record<string, unknown>>;
  artist?: Record<string, unknown> | null;
  artistId?: string | null;
  project?: Record<string, unknown> | null;
  projectId?: string | null;
  campaign?: Record<string, unknown> | null;
  contract?: Record<string, unknown> | null;
  contractId?: string | null;
  release?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
  linkedEventId?: string | null;
  supplierOrClient?: string | null;
  supplier?: Record<string, unknown> | string | null;
  metadata: Record<string, unknown>;
  createdBy?: Record<string, unknown> | string | null;
  updatedBy?: Record<string, unknown> | string | null;
  created_at: string;
  updated_at: string;
}
