/**
 * Um conceito, um nome canônico (ver docs/NAMING_NORMALIZATION_CANONICAL_MAP.md
 * e .claude/rules/naming-canonical.md). O CONTRATO TÉCNICO INTERNO é sempre em
 * INGLÊS — isso vale tanto para campos originados de uma coluna física quanto
 * para campos originados de `entity.metadata` (jsonb). O banco de dados legado
 * em português (`TransactionEntity`, `apps/api/src/database/entities.ts`) é uma
 * fronteira EXTERNA: o mapeamento PT (coluna/chave real) <-> EN (campo deste
 * DTO) acontece exclusivamente em `toTransactionDetails()` (leitura) e em
 * `buildPersistencePayload()` (escrita), ambos em `transactions.service.ts`.
 * Nenhum nome de coluna/chave em português deve vazar para fora desses dois
 * pontos de tradução.
 *
 * Origem física de cada campo (para quem for mexer no mapper):
 *  - type, description, amount, transactionDate, category, artistId,
 *    contractId, projectId, created_at, updated_at: colunas físicas de
 *    `transactions` (`type`, `descricao`, `valor`, `data`, `categoria`,
 *    `artist_id`, `contrato_id`, `project_id`, `created_at`, `updated_at`).
 *  - note, paymentMethod, paymentType, installments, subcategory,
 *    supplierOrClient: chaves de `entity.metadata`
 *    (`observacao`, `formaPagamento`, `tipoPagamento`, `quantidadeParcelas`,
 *    `subcategoria`, `fornecedorCliente`).
 *  - linkedEventId: a entity TEM uma coluna física `evento_id`, mas ela nunca
 *    é escrita nem lida por este service — o valor real sempre vem de
 *    `entity.metadata.eventoVinculado`. Manter o nome `evento_id`/`eventoId`
 *    no DTO seria enganoso (implica coluna FK), por isso o nome canônico aqui
 *    é `linkedEventId`. A coluna `evento_id` morta é uma questão de
 *    `entities.ts`, fora do escopo desta mudança.
 *  - `id`/`created_at`/`updated_at`: já colunas físicas sem equivalente PT
 *    diferente do próprio nome, mantidos como estão (`created_at`/`updated_at`
 *    seguem snake_case por serem timestamps de auditoria já consumidos assim
 *    por outros pontos do sistema — não é um nome em português, é convenção
 *    de coluna de auditoria).
 *
 * Decisões de nomenclatura registradas (para não haver retrabalho futuro):
 *  - `data` (PT, coluna física, data do lançamento) -> `transactionDate`, e
 *    não `date`, porque o DTO já tem `dueDate`, `paidAt` e `competence` — um
 *    campo genérico `date` seria ambíguo entre essas quatro datas distintas.
 *  - `observacao` (PT, metadata) -> `note` (singular). Não existe `notes` no
 *    DTO, então não há colisão.
 *  - `quantidadeParcelas` (PT, metadata, número TOTAL de parcelas) ->
 *    `installments`. Mantido distinto de `installmentCurrent` (que já é EN e
 *    representa a parcela ATUAL, um conceito diferente) — nenhuma colisão.
 *  - `fornecedorCliente` (PT, metadata, string livre preenchida pelo
 *    formulário) -> `supplierOrClient`. O campo `supplier` pré-existente é
 *    OUTRO metadata key (`metadata.supplier`) que nenhum writer deste service
 *    jamais popula — não há nenhum caminho de escrita para ele em
 *    `buildPersistencePayload`. São conceitos que já viviam desacoplados no
 *    metadata; `supplier` fica registrado aqui como dado morto/nunca escrito,
 *    não como sinônimo de `supplierOrClient`. Renomear ou remover `supplier`
 *    está fora do escopo desta mudança (nenhuma tarefa pediu isso).
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
