jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

import { EVENT_LABELS } from './notification.handler';

/** Notification titles are end-user copy: no raw status enum, UUID or entity type. */
describe('notification titles carry no technical identifiers', () => {
  const payload: Record<string, unknown> = {
    nomeArtistico: 'Ana', title: 'Contrato X', numero: '123', valor: '1500.5', fileName: 'capa.png',
    newStatus: 'under_review', toStatus: 'distributed', entityType: 'release', type: 'income',
    transactionId: '7f3c9b2e-0000-4000-8000-000000000001',
    invoiceId: '7f3c9b2e-0000-4000-8000-000000000002',
    artistId: '7f3c9b2e-0000-4000-8000-000000000003',
    entityId: '7f3c9b2e-0000-4000-8000-000000000004',
    email: 'a@b.co', name: 'Conta', nome: 'Lead', daysLeft: 3, dataVencimento: '2026-10-01',
  };

  it.each(Object.keys(EVENT_LABELS))('%s', (event) => {
    const title = EVENT_LABELS[event](payload);
    expect(title).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(title).not.toMatch(/under_review|distributed|\bincome\b|\brelease\b| -> /);
    // Unformatted amounts ("R$1500.5") and ISO dates are raw technical values.
    expect(title).not.toMatch(/R\$\d|\d\.\d(?!\d{2}\b)|\d{4}-\d{2}-\d{2}/);
  });
});

describe('notification titles keep status information as PT-BR labels', () => {
  it('maps canonical statuses instead of dropping them', () => {
    expect(EVENT_LABELS['transaction.status_changed']({ newStatus: 'paid' })).toBe('Status da transação atualizado para Paga');
    expect(EVENT_LABELS['contract.status_changed']({ title: 'Acordo', newStatus: 'under_review' }))
      .toBe('Status do contrato Acordo atualizado para Em análise');
    expect(EVENT_LABELS['workflow.transitioned']({ entityType: 'release', toStatus: 'distributed' }))
      .toBe('Status do lançamento atualizado para Distribuído');
  });

  it('omits an unknown status instead of echoing it', () => {
    expect(EVENT_LABELS['transaction.status_changed']({ newStatus: 'weird_value' })).toBe('Status da transação atualizado');
    expect(EVENT_LABELS['workflow.transitioned']({ entityType: 'mystery', toStatus: 'x' })).toBe('Status do registro atualizado');
  });

  it('formats the invoice due date in pt-BR', () => {
    expect(EVENT_LABELS['invoice.overdue']({ invoiceNumber: '123', dueAt: '2026-10-01' }))
      .toBe('Nota fiscal vencida: 123 (vencimento em 01/10/2026)');
    expect(EVENT_LABELS['invoice.issued']({})).toBe('Nota fiscal emitida');
  });

  it('labels the transaction type in PT-BR', () => {
    expect(EVENT_LABELS['transaction.created']({ type: 'revenue', amount: '10' })).toBe('Receita registrada: R$ 10,00');
    expect(EVENT_LABELS['transaction.created']({ type: 'expense', amount: '1500.5' })).toBe('Despesa registrada: R$ 1.500,50');
    expect(EVENT_LABELS['transaction.created']({ type: 'transfer', amount: '5' })).toBe('Transferência registrada: R$ 5,00');
    expect(EVENT_LABELS['transaction.paid']({ amount: 'not-a-number' })).toBe('Pagamento baixado');
  });
});
