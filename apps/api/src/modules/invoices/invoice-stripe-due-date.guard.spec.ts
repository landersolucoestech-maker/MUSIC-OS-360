import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * R6: `invoices.due_date` is owned by the Stripe billing invoice (billing.service.ts
 * upsertStripeInvoice); `invoices.due_at` is the NFS-e due date owned by InvoicesService.
 * The two writers must never cross over. Source-text guard (billing.service.ts is only read).
 */
const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

function methodBody(source: string, name: string): string {
  const start = source.indexOf(`private async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf('\n  private async ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('invoice due_date / due_at ownership guard (R6)', () => {
  it('InvoicesService never writes the Stripe-owned due_date', () => {
    const src = read('./invoices.service.ts');
    expect(src).not.toMatch(/\bdue_date\b/);
  });

  it('the invoice DTO does not accept due_date', () => {
    expect(read('./dto/invoices.dto.ts')).not.toMatch(/\bdue_date\b/);
  });

  it('billing upsertStripeInvoice writes due_date and never due_at', () => {
    const body = methodBody(read('../billing/billing.service.ts'), 'upsertStripeInvoice');
    expect(body).toMatch(/\bdue_date\b/);
    expect(body).not.toMatch(/\bdue_at\b/);
  });
});
