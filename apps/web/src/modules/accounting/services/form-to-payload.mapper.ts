/**
 * accounting/services/form-to-payload.mapper.ts
 * Form field values → DB/API payload. Source of truth for Transaction persistence.
 */

import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

/**
 * One field per concept (see .claude/rules/naming-canonical.md). The backend
 * (`POST/PUT/PATCH /transactions`, validated by createTransactionSchema in
 * apps/api/.../validators/transacao.validator.ts) only reads camelCase
 * PT-BR keys — the same as the form's own (`TransactionFormData`). Keeping a
 * snake_case/camelCase pair here was pure duplication for the fields that
 * also existed in camelCase (tipoTransacao, tipoCliente, dataTransacao,
 * observacao, artistaVinculado, projetoVinculado) — the snake_case was never
 * read by the schema and was only dead payload.
 *
 * For the fields that only existed in snake_case (contrato_id, evento_id,
 * fornecedor_cliente, orgao_arrecadador, item_investimento, motivo_viagem,
 * nome_publicidade, forma_pagamento, tipo_pagamento, quantidade_parcelas,
 * intervalo_parcelas, data_primeira_parcela, anexo_url, anexo_nome), the name
 * sent matched no schema key — the backend silently discarded
 * those values (zod strips unknown keys). That
 * included `forma_pagamento`, a mandatory field in createTransactionSchema.
 * Renaming to the real camelCase key fixes that silent discard;
 * it is not just a cosmetic rename.
 *
 * centro_custo/competencia/conta_origem/conta_destino have no camelCase
 * counterpart because the current schema does not declare those fields (neither as
 * snake_case nor as camelCase) — it is not duplication, it is a form field
 * without backend persistence today; out of scope for this
 * consolidation (record it as separate debt, do not invent a new field
 * in the schema here).
 */
export interface TransactionFormPayload {
  [key: string]: string | number | null;
  tipoTransacao: string | null;
  tipoCliente: string | null;
  category: string | null;
  subcategoria: string | null;
  description: string | null;
  amount: number | null;
  dataTransacao: string | null;
  status: string;
  observacao: string | null;
  artistaVinculado: string | null;
  projetoVinculado: string | null;
  contratoVinculado: string | null;
  eventoVinculado: string | null;
  fornecedorCliente: string | null;
  orgaoArrecadador: string | null;
  centro_custo: string | null;
  competencia: string | null;
  conta_origem: string | null;
  conta_destino: string | null;
  itemInvestimento: string | null;
  motivoViagem: string | null;
  advertisingName: string | null;
  formaPagamento: string | null;
  tipoPagamento: string | null;
  quantidadeParcelas: string | null;
  intervaloParcelas: string | null;
  dataPrimeiraParcela: string | null;
  anexoUrl: string | null;
  anexoNome: string | null;
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formToTransactionPayload(f: TransactionFormData): TransactionFormPayload {
  const str = (v: string): string | null => v.trim() || null;
  const attachmentUrl = str(f.anexoUrl);

  return {
    tipoTransacao:           str(f.tipoTransacao),
    tipoCliente:             str(f.tipoCliente),
    category:                str(f.category),
    subcategoria:            str(f.subcategoria),
    description:             str(f.description),
    amount:                  parseMoney(f.amount),
    dataTransacao:           str(f.dataTransacao),
    status:                  str(f.status) ?? "pending",
    observacao:              str(f.observacao),
    artistaVinculado:        str(f.artistaVinculado),
    projetoVinculado:        str(f.projetoVinculado),
    contratoVinculado:       str(f.contratoVinculado),
    eventoVinculado:         str(f.eventoVinculado),
    fornecedorCliente:       str(f.fornecedorCliente),
    orgaoArrecadador:        str(f.orgaoArrecadador),
    centro_custo:            str(f.centroCusto ?? ""),
    competencia:             str(f.competencia ?? ""),
    conta_origem:            str(f.contaOrigem ?? ""),
    conta_destino:           str(f.contaDestino ?? ""),
    itemInvestimento:        str(f.itemInvestimento),
    motivoViagem:            str(f.motivoViagem),
    advertisingName:         str(f.advertisingName),
    formaPagamento:          str(f.formaPagamento),
    tipoPagamento:           str(f.tipoPagamento),
    quantidadeParcelas:      str(f.quantidadeParcelas),
    intervaloParcelas:       str(f.intervaloParcelas),
    dataPrimeiraParcela:     str(f.dataPrimeiraParcela),
    anexoUrl:                attachmentUrl?.startsWith("blob:") ? null : attachmentUrl,
    anexoNome:               str(f.anexoNome),
  };
}
