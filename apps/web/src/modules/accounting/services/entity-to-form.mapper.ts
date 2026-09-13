/**
 * accounting/services/entity-to-form.mapper.ts
 * Entity → form field values. Source of truth for Transaction hydration.
 */

import { initialFormData } from "@/modules/accounting/constants/transaction-constants";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

export interface TransactionFormEntity {
  id?: string;
  updated_at?: unknown;
  updatedAt?: unknown;
  type?: unknown;
  tipoTransacao?: unknown;
  tipo_transacao?: unknown;
  tipoCliente?: unknown;
  tipo_cliente?: unknown;
  categoria?: unknown;
  subcategoria?: unknown;
  descricao?: unknown;
  valor?: unknown;
  data?: unknown;
  dataTransacao?: unknown;
  data_transacao?: unknown;
  status?: unknown;
  observacao?: unknown;
  observacoes?: unknown;
  artistaVinculado?: unknown;
  artist_id?: unknown;
  projetoVinculado?: unknown;
  project_id?: unknown;
  contratoVinculado?: unknown;
  contrato_id?: unknown;
  eventoVinculado?: unknown;
  evento_id?: unknown;
  fornecedorCliente?: unknown;
  fornecedor_cliente?: unknown;
  orgaoArrecadador?: unknown;
  orgao_arrecadador?: unknown;
  centroCusto?: unknown;
  centro_custo?: unknown;
  competencia?: unknown;
  contaOrigem?: unknown;
  conta_origem?: unknown;
  contaDestino?: unknown;
  conta_destino?: unknown;
  itemInvestimento?: unknown;
  item_investimento?: unknown;
  motivoViagem?: unknown;
  motivo_viagem?: unknown;
  nomePublicidade?: unknown;
  nome_publicidade?: unknown;
  formaPagamento?: unknown;
  forma_pagamento?: unknown;
  tipoPagamento?: unknown;
  tipo_pagamento?: unknown;
  quantidadeParcelas?: unknown;
  quantidade_parcelas?: unknown;
  intervaloParcelas?: unknown;
  intervalo_parcelas?: unknown;
  dataPrimeiraParcela?: unknown;
  data_primeira_parcela?: unknown;
  anexoUrl?: unknown;
  anexo_url?: unknown;
  anexoNome?: unknown;
  anexo_nome?: unknown;
  entityLinks?: unknown;
}

export function transactionToFormFields(t: TransactionFormEntity | null | undefined): TransactionFormData {
  if (!t) return { ...initialFormData };
  const str = (v: unknown): string => (v == null ? "" : String(v).trim());
  return {
    ...initialFormData,
    entityLinks: Array.isArray(t.entityLinks) ? (t.entityLinks as TransactionFormData["entityLinks"]) : [],
    tipoTransacao:       str(t.tipoTransacao      ?? t.tipo_transacao ?? t.type),
    tipoCliente:         str(t.tipoCliente        ?? t.tipo_cliente),
    categoria:           str(t.categoria),
    subcategoria:        str(t.subcategoria),
    descricao:           str(t.descricao),
    valor:               str(t.valor),
    dataTransacao:       str(t.dataTransacao      ?? t.data_transacao ?? t.data),
    status:              str(t.status)            || "pending",
    observacao:          str(t.observacao         ?? t.observacoes),
    artistaVinculado:    str(t.artistaVinculado   ?? t.artist_id),
    projetoVinculado:    str(t.projetoVinculado   ?? t.project_id),
    contratoVinculado:   str(t.contratoVinculado  ?? t.contrato_id),
    eventoVinculado:     str(t.eventoVinculado    ?? t.evento_id),
    fornecedorCliente:   str(t.fornecedorCliente  ?? t.fornecedor_cliente),
    orgaoArrecadador:    str(t.orgaoArrecadador   ?? t.orgao_arrecadador),
    centroCusto:         str(t.centroCusto        ?? t.centro_custo),
    competencia:         str(t.competencia),
    contaOrigem:         str(t.contaOrigem        ?? t.conta_origem),
    contaDestino:        str(t.contaDestino       ?? t.conta_destino),
    itemInvestimento:    str(t.itemInvestimento   ?? t.item_investimento),
    motivoViagem:        str(t.motivoViagem       ?? t.motivo_viagem),
    nomePublicidade:     str(t.nomePublicidade    ?? t.nome_publicidade),
    formaPagamento:      str(t.formaPagamento     ?? t.forma_pagamento),
    tipoPagamento:       str(t.tipoPagamento      ?? t.tipo_pagamento)     || "avista",
    quantidadeParcelas:  str(t.quantidadeParcelas ?? t.quantidade_parcelas),
    intervaloParcelas:   str(t.intervaloParcelas  ?? t.intervalo_parcelas) || "mensal",
    dataPrimeiraParcela: str(t.dataPrimeiraParcela?? t.data_primeira_parcela),
    anexoUrl:            str(t.anexoUrl           ?? t.anexo_url),
    anexoNome:           str(t.anexoNome          ?? t.anexo_nome),
  };
}
