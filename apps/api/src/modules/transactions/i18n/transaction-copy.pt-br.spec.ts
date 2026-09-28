import {
  reconciliationTaskDescription,
  reconciliationTaskTitle,
  transactionCancelledCopy,
  transactionCreatedCopy,
  transactionPaidCopy,
  transactionStatusChangedCopy,
} from './transaction-copy.pt-br';

const UUID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';

describe('transaction-copy.pt-br', () => {
  it('renders the type label and a BRL amount, never the raw enum or number', () => {
    expect(transactionCreatedCopy('revenue', '1500.5')).toBe('Receita de R$ 1.500,50 registrada');
    expect(transactionCreatedCopy('expense', 20)).toBe('Despesa de R$ 20,00 registrada');
    expect(transactionCreatedCopy('unknown-type', 'x')).toBe('Transação registrada');
    expect(transactionCreatedCopy('tax', 20)).toBe('Imposto de R$ 20,00 registrado');
  });

  it('maps status values to PT-BR labels', () => {
    expect(transactionStatusChangedCopy('pending', 'paid')).toBe('Status da transação alterado de Pendente para Paga');
    expect(transactionStatusChangedCopy('bogus', 'cancelled')).toBe('Status da transação alterado para Cancelada');
    expect(transactionStatusChangedCopy('bogus', 'bogus')).toBe('Status da transação atualizado');
  });

  it('cancel and paid copies use correct PT-BR (no "Transacção")', () => {
    expect(transactionCancelledCopy('10')).toBe('Transação de R$ 10,00 cancelada');
    expect(transactionPaidCopy(undefined)).toBe('Transação paga');
  });

  it('reconciliation task copy carries amount and date but no id', () => {
    expect(reconciliationTaskTitle('99.9')).toBe('Conciliação financeira — transação de R$ 99,90');
    const description = reconciliationTaskDescription('99.9', '2026-02-10T15:00:00.000Z');
    expect(description).toBe('Confirmar a baixa e a conciliação bancária da transação de R$ 99,90 (paga em 10/02/2026).');
    expect(description).not.toContain(UUID);
  });
});
