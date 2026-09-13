/**
 * accounting/services/form-to-payload.mapper.ts
 * Form field values → DB/API payload. Source of truth for Transaction persistence.
 */

import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

/**
 * Um campo por conceito (ver .claude/rules/naming-canonical.md). O backend
 * (`POST/PUT/PATCH /transactions`, validado por createTransactionSchema em
 * apps/api/.../validators/transacao.validator.ts) só lê chaves camelCase
 * PT-BR — as mesmas do próprio formulário (`TransactionFormData`). Manter um
 * par snake_case/camelCase aqui era duplicação pura para os campos que
 * também existiam em camelCase (tipoTransacao, tipoCliente, dataTransacao,
 * observacao, artistaVinculado, projetoVinculado) — o snake_case nunca era
 * lido pelo schema e era só payload morto.
 *
 * Para os campos que só existiam em snake_case (contrato_id, evento_id,
 * fornecedor_cliente, orgao_arrecadador, item_investimento, motivo_viagem,
 * nome_publicidade, forma_pagamento, tipo_pagamento, quantidade_parcelas,
 * intervalo_parcelas, data_primeira_parcela, anexo_url, anexo_nome), o nome
 * enviado não batia com nenhuma chave do schema — o backend descartava
 * silenciosamente esses valores (zod strip de chave desconhecida). Isso
 * incluía `forma_pagamento`, campo obrigatório em createTransactionSchema.
 * Renomear para a chave camelCase real corrige esse descarte silencioso,
 * não é só rename cosmético.
 *
 * centro_custo/competencia/conta_origem/conta_destino não têm contraparte
 * camelCase porque o schema atual não declara esses campos (nem como
 * snake_case, nem como camelCase) — não é uma duplicação, é um campo do
 * formulário sem persistência no backend hoje; fora do escopo desta
 * consolidação (registrar como débito à parte, não inventar um campo novo
 * no schema aqui).
 */
export interface TransactionFormPayload {
  [key: string]: string | number | null;
  tipoTransacao: string | null;
  tipoCliente: string | null;
  categoria: string | null;
  subcategoria: string | null;
  descricao: string | null;
  valor: number | null;
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
  nomePublicidade: string | null;
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
    categoria:               str(f.categoria),
    subcategoria:            str(f.subcategoria),
    descricao:               str(f.descricao),
    valor:                   parseMoney(f.valor),
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
    nomePublicidade:         str(f.nomePublicidade),
    formaPagamento:          str(f.formaPagamento),
    tipoPagamento:           str(f.tipoPagamento),
    quantidadeParcelas:      str(f.quantidadeParcelas),
    intervaloParcelas:       str(f.intervaloParcelas),
    dataPrimeiraParcela:     str(f.dataPrimeiraParcela),
    anexoUrl:                attachmentUrl?.startsWith("blob:") ? null : attachmentUrl,
    anexoNome:               str(f.anexoNome),
  };
}
