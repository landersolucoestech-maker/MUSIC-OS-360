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

/** "MM/AAAA" (what the "Competência" input asks for) or the wire form "YYYY-MM". */
const REFERENCE_MONTH_PATTERN = /^(?:(?:0[1-9]|1[0-2])\/\d{4}|\d{4}-(?:0[1-9]|1[0-2]))$/;

function parsePositiveInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) return Number.NaN;
  return Number(value);
}

export function validateTransactionForm(
  f: TransactionFormData,
  rules: FinancialFormRules,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!f.transactionType) {
    errors.transactionType = "Selecione o tipo de transação";
  }

  if (rules.showClientType && !f.counterpartyType) {
    errors.counterpartyType = "Selecione o tipo de cliente";
  }

  if (rules.showCategory && !f.category) {
    errors.category = "Selecione a categoria";
  }

  if (rules.showSubcategory && !f.subcategory) {
    errors.subcategory = "Selecione a subcategoria";
  }

  if (!f.description?.trim()) {
    errors.description = "Informe a descrição";
  }

  const amount = parseMoney(f.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Informe um valor válido";
  }

  if (!f.transactionDate) {
    errors.transactionDate = "Informe a data da transação";
  }

  if (!f.paymentMethod) {
    errors.paymentMethod = "Selecione a forma de pagamento";
  }

  if (rules.showArtist && !f.artistId) {
    errors.artistId = "Selecione o artista";
  }

  if (rules.showProject && rules.projectRequired && f.artistId && !f.projectId) {
    errors.projectId = "Selecione o projeto";
  }

  if (rules.showEvent && f.artistId && !f.eventId) {
    errors.eventId = "Selecione o show/evento";
  }

  if (rules.showTravelReason && !f.travelReason?.trim()) {
    errors.travelReason = "Informe o motivo da viagem";
  }

  if (rules.showAdvertisingName && !f.advertisingName?.trim()) {
    errors.advertisingName = "Informe o nome da publicidade";
  }

  if (rules.showCollectingAgency && !f.taxAuthority) {
    errors.taxAuthority = "Selecione o órgão arrecadador";
  }

  const referenceMonth = f.referenceMonth?.trim();
  if (referenceMonth && !REFERENCE_MONTH_PATTERN.test(referenceMonth)) {
    errors.referenceMonth = "Informe a competência no formato MM/AAAA";
  }

  if (rules.showInstallments) {
    const installmentCount = parsePositiveInteger(f.installmentCount);
    if (!Number.isInteger(installmentCount) || installmentCount < 2) {
      errors.installmentCount = "Mínimo 2 parcelas";
    }

    if (!f.firstInstallmentDate) {
      errors.firstInstallmentDate = "Informe a data da primeira parcela";
    }
  }

  return errors;
}

