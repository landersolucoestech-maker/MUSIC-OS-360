import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/invoices.dto';

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
