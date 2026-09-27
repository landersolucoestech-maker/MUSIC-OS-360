/**
 * PT-BR end-user copy for invoice activity log entries and follow-up tasks.
 * Status values go through the canonical labels, amounts as BRL, dates as
 * dd/mm/aaaa — never raw enum values, numbers or ISO dates.
 */
import { statusLabelPtBr } from '@music-os-360/types';
import { formatBrlPtBr, formatDatePtBr } from '../../../core/i18n/copy-format.pt-br';

function invoiceRef(invoiceNumber: unknown): string {
  const n = invoiceNumber === null || invoiceNumber === undefined ? '' : String(invoiceNumber).trim();
  return n ? `Nota fiscal nº ${n}` : 'Nota fiscal';
}

function amountPart(amount: unknown): string {
  const formatted = formatBrlPtBr(amount);
  return formatted ? ` — ${formatted}` : '';
}

export function invoiceCreatedCopy(invoiceNumber: unknown, amount?: unknown): string {
  return `${invoiceRef(invoiceNumber)} criada${amountPart(amount)}`;
}

export function invoiceCancelledCopy(invoiceNumber: unknown): string {
  return `${invoiceRef(invoiceNumber)} cancelada`;
}

export function invoiceIssuedCopy(invoiceNumber: unknown, amount: unknown): string {
  return `${invoiceRef(invoiceNumber)} emitida${amountPart(amount)}`;
}

export function invoiceStatusChangedCopy(invoiceNumber: unknown, fromStatus: unknown, toStatus: unknown): string {
  const from = statusLabelPtBr('invoice', fromStatus);
  const to = statusLabelPtBr('invoice', toStatus);
  if (from && to) return `${invoiceRef(invoiceNumber)}: status alterado de ${from} para ${to}`;
  if (to) return `${invoiceRef(invoiceNumber)}: status alterado para ${to}`;
  return `${invoiceRef(invoiceNumber)}: status atualizado`;
}

export function invoiceOverdueCopy(invoiceNumber: unknown, amount: unknown, dueDate: unknown): string {
  const due = formatDatePtBr(dueDate);
  return `${invoiceRef(invoiceNumber)} vencida${amountPart(amount)}${due ? ` (vencimento em ${due})` : ''}`;
}

export function overdueFollowUpTaskTitle(invoiceNumber: unknown): string {
  const n = invoiceNumber === null || invoiceNumber === undefined ? '' : String(invoiceNumber).trim();
  return `Cobrança: nota fiscal${n ? ` nº ${n}` : ''} vencida`;
}

export function overdueFollowUpTaskDescription(amount: unknown, dueDate: unknown): string {
  const due = formatDatePtBr(dueDate);
  const formatted = formatBrlPtBr(amount);
  return `Nota fiscal vencida${due ? ` em ${due}` : ''}${formatted ? ` no valor de ${formatted}` : ''}. Contatar o cliente e regularizar a cobrança.`;
}
