import {
  invoiceCancelledCopy,
  invoiceCreatedCopy,
  invoiceIssuedCopy,
  invoiceOverdueCopy,
  invoiceStatusChangedCopy,
  overdueFollowUpTaskDescription,
  overdueFollowUpTaskTitle,
} from './invoice-copy.pt-br';

describe('invoice-copy.pt-br', () => {
  it('maps status values to PT-BR labels, never the raw enum', () => {
    expect(invoiceStatusChangedCopy('123', 'issued', 'paid')).toBe('Nota fiscal nº 123: status alterado de Emitida para Paga');
    expect(invoiceStatusChangedCopy(null, 'bogus', 'overdue')).toBe('Nota fiscal: status alterado para Vencida');
    expect(invoiceStatusChangedCopy(null, 'bogus', 'bogus')).toBe('Nota fiscal: status atualizado');
  });

  it('formats amounts and due dates in pt-BR', () => {
    expect(invoiceIssuedCopy('7', '2500')).toBe('Nota fiscal nº 7 emitida — R$ 2.500,00');
    expect(invoiceOverdueCopy('7', 99.5, '2026-04-30')).toBe('Nota fiscal nº 7 vencida — R$ 99,50 (vencimento em 30/04/2026)');
    expect(invoiceCreatedCopy(undefined, 'n/a')).toBe('Nota fiscal criada');
    expect(invoiceCancelledCopy('8')).toBe('Nota fiscal nº 8 cancelada');
  });

  it('follow-up task copy is PT-BR with formatted values', () => {
    expect(overdueFollowUpTaskTitle('7')).toBe('Cobrança: nota fiscal nº 7 vencida');
    expect(overdueFollowUpTaskDescription('10', '2026-04-30')).toBe(
      'Nota fiscal vencida em 30/04/2026 no valor de R$ 10,00. Contatar o cliente e regularizar a cobrança.',
    );
  });
});
