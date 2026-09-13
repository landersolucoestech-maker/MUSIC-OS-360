import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialFormRules } from "@/modules/accounting/components/transaction-form/rules/financial-form-rules";

export type ValidationErrors = Partial<Record<keyof TransactionFormData, string>>;

function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;

  return Number(normalized);
}

function parsePositiveInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) return Number.NaN;
  return Number(value);
}

export function validateTransactionForm(
  f: TransactionFormData,
  rules: FinancialFormRules,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!f.tipoTransacao) {
    errors.tipoTransacao = "Selecione o tipo de transação";
  }

  if (rules.exibirTipoCliente && !f.tipoCliente) {
    errors.tipoCliente = "Selecione o tipo de cliente";
  }

  if (rules.exibirCategoria && !f.categoria) {
    errors.categoria = "Selecione a categoria";
  }

  if (rules.exibirSubcategoria && !f.subcategoria) {
    errors.subcategoria = "Selecione a subcategoria";
  }

  if (!f.descricao?.trim()) {
    errors.descricao = "Informe a descrição";
  }

  const valor = parseMoney(f.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    errors.valor = "Informe um valor válido";
  }

  if (!f.dataTransacao) {
    errors.dataTransacao = "Informe a data da transação";
  }

  if (!f.formaPagamento) {
    errors.formaPagamento = "Selecione a forma de pagamento";
  }

  if (rules.exibirArtista && !f.artistaVinculado) {
    errors.artistaVinculado = "Selecione o artista";
  }

  if (rules.exibirProjeto && rules.projetoObrigatorio && f.artistaVinculado && !f.projetoVinculado) {
    errors.projetoVinculado = "Selecione o projeto";
  }

  if (rules.exibirEvento && f.artistaVinculado && !f.eventoVinculado) {
    errors.eventoVinculado = "Selecione o show/evento";
  }

  if (rules.exibirMotivoViagem && !f.motivoViagem?.trim()) {
    errors.motivoViagem = "Informe o motivo da viagem";
  }

  if (rules.exibirNomePublicidade && !f.nomePublicidade?.trim()) {
    errors.nomePublicidade = "Informe o nome da publicidade";
  }

  if (rules.exibirOrgaoArrecadador && !f.orgaoArrecadador) {
    errors.orgaoArrecadador = "Selecione o órgão arrecadador";
  }

  if (rules.exibirParcelamento) {
    const quantidadeParcelas = parsePositiveInteger(f.quantidadeParcelas);
    if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas < 2) {
      errors.quantidadeParcelas = "Mínimo 2 parcelas";
    }

    if (!f.dataPrimeiraParcela) {
      errors.dataPrimeiraParcela = "Informe a data da primeira parcela";
    }
  }

  return errors;
}

