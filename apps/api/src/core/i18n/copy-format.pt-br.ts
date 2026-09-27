/**
 * pt-BR formatting of values interpolated into end-user copy (notifications,
 * activity log descriptions, CRM task titles). Raw numbers ("R$1500.5") and
 * ISO timestamps must never reach the user.
 *
 * Timestamps are rendered in America/Sao_Paulo, the product's default time zone
 * (per-tenant time zones are not resolved in event handlers).
 */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "R$ 1.500,50", or null when the value is not a finite number. */
export function formatBrlPtBr(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? BRL.format(n).replace(/\u00a0/g, ' ') : null;
}

/** "05/01/2026" from a Date, an ISO timestamp or a date-only string; null when unparseable. */
export function formatDatePtBr(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const dateOnly = DATE_ONLY.exec(value);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
}
