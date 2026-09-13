import 'reflect-metadata';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

/**
 * REM-06 (Remaining Product Completion Backlog): `invoices` mistura Notas
 * Fiscais (o tenant fatura os SEUS clientes) com faturas Stripe da própria
 * assinatura SaaS do tenant (billing.service.ts upsertStripeInvoice,
 * type='stripe_subscription'). GET /invoices e GET /invoices/:id (
 * RequireRole('viewer')) vazavam essas faturas Stripe — o mesmo dado só
 * deveria ser acessível via /billing/subscription (RequireRole('admin')).
 */
function makeQb(rows: unknown[], one: unknown = null) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => [rows, rows.length]),
    getOne: jest.fn(async () => one),
  };
}

function makeService(rows: unknown[] = [], one: unknown = null) {
  const qb = makeQb(rows, one);
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const enc = { decryptNullable: jest.fn(() => null), encryptNullable: jest.fn(() => null) } as any;
  const svc = new InvoicesService(ds, enc);
  return { svc, qb };
}

describe('InvoicesService.list — exclui faturas Stripe da assinatura SaaS (REM-06)', () => {
  it('filtra type != stripe_subscription por padrão', async () => {
    const { svc, qb } = makeService();
    await svc.list('tenant-1', {} as any);

    expect(qb.andWhere).toHaveBeenCalledWith("i.type != 'stripe_subscription'");
  });
});

describe('InvoicesService.findById — exclui faturas Stripe da assinatura SaaS (REM-06)', () => {
  it('filtra type != stripe_subscription na busca por id', async () => {
    const { svc, qb } = makeService([], { id: 'inv-1', type: 'nfse' });
    await svc.findById('tenant-1', 'inv-1');

    expect(qb.andWhere).toHaveBeenCalledWith("i.type != 'stripe_subscription'");
  });

  it('lança NotFoundException quando a fatura Stripe é a única correspondência (excluída pela query)', async () => {
    const { svc } = makeService([], null);
    await expect(svc.findById('tenant-1', 'inv-stripe-1')).rejects.toThrow(NotFoundException);
  });
});

/**
 * find-99749ea0: client_id had no cross-tenant ownership check — an invoice
 * could silently reference another tenant's client.
 */
describe('InvoicesService.create — cross-tenant FK ownership (find-99749ea0)', () => {
  function makeCreateService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'invoice-1', ...(v as object) })),
      manager: { connection: { query: queryImpl } },
    };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const enc = { decryptNullable: jest.fn(() => null), encryptNullable: jest.fn(() => null) } as any;
    const svc = new InvoicesService(ds, enc);
    return { svc, repo };
  }

  it('rejects a client_id belonging to another tenant', async () => {
    const { svc } = makeCreateService(jest.fn(async () => []));
    await expect(
      svc.create('tenant-1', 'user-1', { client_id: '323e4567-e89b-12d3-a456-426614174000' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a client_id that belongs to the same tenant', async () => {
    const { svc, repo } = makeCreateService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      svc.create('tenant-1', 'user-1', { client_id: '223e4567-e89b-12d3-a456-426614174000' } as any),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  function makeUpdateService(queryImpl: jest.Mock) {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => ({ id: 'invoice-1', tenant_id: 'tenant-1', status: 'issued', type: 'nfse' })),
    };
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: { connection: { query: queryImpl } },
    };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const enc = { decryptNullable: jest.fn(() => null), encryptNullable: jest.fn(() => null) } as any;
    const svc = new InvoicesService(ds, enc);
    return { svc, repo };
  }

  it('update: rejects changing client_id to another tenant\'s client', async () => {
    const { svc } = makeUpdateService(jest.fn(async () => []));
    await expect(
      svc.update('tenant-1', 'user-1', 'invoice-1', {
        client_id: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate client_id when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { svc } = makeUpdateService(query);
    await expect(
      svc.update('tenant-1', 'user-1', 'invoice-1', { observacoes: 'x' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
