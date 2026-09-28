/**
 * PT-BR end-user copy for transaction activity log entries and CRM tasks.
 * Enum values are rendered through the canonical labels, amounts as BRL and
 * dates as dd/mm/aaaa — never raw values or ids.
 */
import { TRANSACTION_TYPE_LABELS_PT_BR, statusLabelPtBr, transactionTypeRegisteredPtBr } from '@music-os-360/types';
import { formatBrlPtBr, formatDatePtBr } from '../../../core/i18n/copy-format.pt-br';

function amountSuffix(amount: unknown): string {
  const formatted = formatBrlPtBr(amount);
  return formatted ? ` de ${formatted}` : '';
}

export const TRANSACTION_ALREADY_CANCELLED = 'Esta transação já foi cancelada.';
export const TRANSACTION_CANCELLED_NOT_EDITABLE = 'Uma transação cancelada não pode ser editada.';

export function transactionCreatedCopy(type: unknown, amount: unknown): string {
  const label = TRANSACTION_TYPE_LABELS_PT_BR[type as keyof typeof TRANSACTION_TYPE_LABELS_PT_BR];
  if (!label) return 'Transação registrada';
  const [, participle] = transactionTypeRegisteredPtBr(type).split(' ');
  return `${label}${amountSuffix(amount)} ${participle}`;
}

export function transactionCancelledCopy(amount: unknown): string {
  return `Transação${amountSuffix(amount)} cancelada`;
}

export function transactionPaidCopy(amount: unknown): string {
  return `Transação${amountSuffix(amount)} paga`;
}

export function transactionStatusChangedCopy(fromStatus: unknown, toStatus: unknown): string {
  const from = statusLabelPtBr('transaction', fromStatus);
  const to = statusLabelPtBr('transaction', toStatus);
  if (from && to) return `Status da transação alterado de ${from} para ${to}`;
  if (to) return `Status da transação alterado para ${to}`;
  return 'Status da transação atualizado';
}

export function reconciliationTaskTitle(amount: unknown): string {
  return `Conciliação financeira — transação${amountSuffix(amount)}`;
}

export function reconciliationTaskDescription(amount: unknown, paidAt: unknown): string {
  const date = formatDatePtBr(paidAt);
  return `Confirmar a baixa e a conciliação bancária da transação${amountSuffix(amount)}${date ? ` (paga em ${date})` : ''}.`;
}
