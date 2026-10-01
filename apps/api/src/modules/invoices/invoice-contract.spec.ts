import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/invoices.dto';
import { CANONICAL_INVOICE_PAYMENT_METHODS, INVOICE_PAYMENT_METHODS, canonicalInvoicePaymentMethod } from './invoice-legacy-fields';
import { PAYMENT_METHODS } from '../transactions/transaction-legacy-fields';

/**
 * CZ-036: generic invoice fields are English (NFS-e fiscal terms kept).
 * LEGACY_WEB_INVOICE is the payload a pre-CZ-036 web build sends; it must
 * validate and persist with canonical columns and item keys only.
 */
const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateInvoiceDto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_INVOICE = {
  numero: '123',
  serie: '1',
  tipo_nota: 'nfse',
  data_emissao: '2026-09-01',
  vencimento: '2026-10-01',
  tomador_cnpj: '12.345.678/0001-90',
  tomador_razao_social: 'Cliente LTDA',
  service_amount: 1000,
  forma_pagamento: 'pix',
  condicao_pagamento: 'à vista',
  itens: [{ description: 'Show', codigo_servico: '12.01', quantidade: 2, unit_price: 500, total_amount: 1000 }],
};

function makeService() {
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'inv-1', ...(v as object) })),
    manager: { connection: { query: jest.fn(async () => [{ exists: 1 }]) } },
  };
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = { encryptNullable: jest.fn((v: unknown) => (v == null ? null : `enc(${String(v)})`)), decryptNullable: jest.fn(() => null) };
  const events = { emitTyped: jest.fn() };
  const service = new InvoicesService(ds as never, enc as never, events as never);
  return { service, repo, events };
}

describe('Invoice request contract (CZ-036)', () => {
  it('the pre-CZ-036 web payload validates (items included)', () => {
    expect(errorsFor(LEGACY_WEB_INVOICE)).toEqual([]);
  });

  it('an item needs a quantity under either name', () => {
    expect(errorsFor({ items: [{ description: 'x', unit_price: 1, total_amount: 1 }] })).toContain('items');
  });

  it('persists the pre-CZ-036 payload with canonical columns and item keys only', async () => {
    const { service, repo, events } = makeService();
    await service.create('tenant-1', 'user-1', LEGACY_WEB_INVOICE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      invoice_number: '123', issued_at: '2026-09-01', due_at: '2026-10-01', tomador_legal_name: 'Cliente LTDA',
      payment_method: 'pix', payment_terms: 'à vista',
      items: [{ description: 'Show', service_code: '12.01', quantity: 2, unit_price: 500, total_amount: 1000 }],
    });
    for (const legacy of ['numero', 'data_emissao', 'vencimento', 'tomador_razao_social', 'forma_pagamento', 'condicao_pagamento', 'itens']) {
      expect(row).not.toHaveProperty(legacy);
    }
    expect(events.emitTyped).toHaveBeenCalledWith('invoice.created', expect.objectContaining({
      payload: expect.objectContaining({ invoiceNumber: '123', amount: '1000' }),
    }));
  });
});

describe('Invoice payment_method vocabulary (chk_invoices_payment_method)', () => {
  const persistedMethod = async (payload: Record<string, unknown>) => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', payload as never);
    return (repo.create.mock.calls[0][0] as Record<string, unknown>)['payment_method'];
  };

  it('reuses the transactions payment method vocabulary, adds bank_transfer, and still accepts legacy transferencia', () => {
    expect(CANONICAL_INVOICE_PAYMENT_METHODS).toEqual([...PAYMENT_METHODS, 'bank_transfer']);
    expect(INVOICE_PAYMENT_METHODS).toEqual([...PAYMENT_METHODS, 'bank_transfer', 'transferencia']);
  });

  it.each([
    ['dinheiro', 'cash'], ['cartao_credito', 'credit_card'], ['cartao_debito', 'debit_card'], ['cheque', 'check'],
    ['Cartao_Credito', 'credit_card'], [' dinheiro ', 'cash'],
    ['pix', 'pix'], ['boleto', 'boleto'], ['cash', 'cash'], ['credit_card', 'credit_card'], ['ted', 'ted'], ['PIX', 'pix'],
  ])('a pre-change web build sending payment_method=%j persists %s', async (sent, stored) => {
    expect(await persistedMethod({ payment_method: sent })).toBe(stored);
  });

  it.each(['transferencia', ' Transferencia ', 'TRANSFERENCIA'])('legacy %j is canonicalized to bank_transfer (never guessed as ted)', async (sent) => {
    expect(canonicalInvoicePaymentMethod(sent)).toBe('bank_transfer');
    expect(await persistedMethod({ payment_method: sent })).toBe('bank_transfer');
  });

  it('bank_transfer is accepted and persisted as-is', async () => {
    expect(await persistedMethod({ payment_method: 'bank_transfer' })).toBe('bank_transfer');
  });

  it('the deprecated key forma_pagamento carries deprecated values too', async () => {
    expect(await persistedMethod({ forma_pagamento: 'cartao_debito' })).toBe('debit_card');
  });

  it('the canonical key wins over the deprecated key (value then mapped)', async () => {
    expect(await persistedMethod({ payment_method: 'cash', forma_pagamento: 'pix' })).toBe('cash');
    expect(await persistedMethod({ payment_method: 'dinheiro', forma_pagamento: 'pix' })).toBe('cash');
  });

  it.each([null, '', '  '])('%j clears the method', async (blank) => {
    expect(await persistedMethod({ payment_method: blank })).toBeNull();
  });

  it('an absent method is not written (update patches stay partial)', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { invoice_number: '1' } as never);
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty('payment_method');
  });

  it.each(['alien', 'cartao', 'Transferência', 42, {}])('rejects %j before it can reach the CHECK', async (bad) => {
    const { service, repo } = makeService();
    await expect(service.create('tenant-1', 'user-1', { payment_method: bad } as never)).rejects.toThrow('Forma de pagamento inválida.');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update maps and rejects the same way', async () => {
    const found = { id: 'inv-1', status: 'draft', type: 'nfse' };
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn(async () => found) };
    const update = jest.fn(async () => ({ affected: 1 }));
    const repo = { createQueryBuilder: jest.fn(() => qb), update, manager: { connection: { query: jest.fn() } } };
    const ds = { getRepository: jest.fn(() => repo) };
    const enc = { encryptNullable: jest.fn(), decryptNullable: jest.fn(() => null) };
    const service = new InvoicesService(ds as never, enc as never);
    await expect(service.update('t', 'u', 'inv-1', { payment_method: 'alien' } as never)).rejects.toThrow('Forma de pagamento inválida.');
    expect(update).not.toHaveBeenCalled();
  });

  it('the Stripe subscription barrier is unchanged: list/findById still exclude type=stripe_subscription', async () => {
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn(async () => [[], 0]), getOne: jest.fn(async () => ({ id: 'i' })) };
    const ds = { getRepository: jest.fn(() => ({ createQueryBuilder: jest.fn(() => qb) })) };
    const service = new InvoicesService(ds as never, { decryptNullable: jest.fn(() => null) } as never);
    await service.list('t', {} as never);
    await service.findById('t', 'i');
    expect(qb.andWhere.mock.calls.filter(([sql]) => sql === "i.type != 'stripe_subscription'")).toHaveLength(2);
  });
});
