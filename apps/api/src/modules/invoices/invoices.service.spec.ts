import 'reflect-metadata';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

/**
 * REM-06 (Remaining Product Completion Backlog): `invoices` mixes service
 * invoices (the tenant bills ITS clients) with Stripe invoices of the tenant's own
 * SaaS subscription (billing.service.ts upsertStripeInvoice,
 * type='stripe_subscription'). GET /invoices and GET /invoices/:id (
 * RequireRole('viewer')) leaked those Stripe invoices — the same data should
 * only be reachable via /billing/subscription (RequireRole('admin')).
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

describe('InvoicesService.list — excludes SaaS subscription Stripe invoices (REM-06)', () => {
  it('filters type != stripe_subscription by default', async () => {
    const { svc, qb } = makeService();
    await svc.list('tenant-1', {} as any);

    expect(qb.andWhere).toHaveBeenCalledWith("i.type != 'stripe_subscription'");
  });
});

describe('InvoicesService.findById — excludes SaaS subscription Stripe invoices (REM-06)', () => {
  it('filters type != stripe_subscription when looking up by id', async () => {
    const { svc, qb } = makeService([], { id: 'inv-1', type: 'nfse' });
    await svc.findById('tenant-1', 'inv-1');

    expect(qb.andWhere).toHaveBeenCalledWith("i.type != 'stripe_subscription'");
  });

  it('throws NotFoundException when the Stripe invoice is the only match (excluded by the query)', async () => {
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
      svc.update('tenant-1', 'user-1', 'invoice-1', { notes: 'x' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});

/**
 * LC1: the web form no longer sends legacy_amount; the API derives the NOT NULL mirror from the
 * canonical service_amount (staged retirement, docs/engineering/legacy-column-drop-plan.md).
 */
describe('InvoicesService.create - legacy_amount mirror derived from service_amount (LC1)', () => {
  function setup() {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'invoice-1', ...(v as object) })),
      manager: { connection: { query: jest.fn(async () => []) } },
    };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const enc = { decryptNullable: jest.fn(() => null), encryptNullable: jest.fn(() => null) } as any;
    return { svc: new InvoicesService(ds, enc), repo };
  }

  it('a payload with service_amount only (the new web form) persists legacy_amount = service_amount', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { service_amount: 1234.5 } as any);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ service_amount: 1234.5, legacy_amount: 1234.5 }));
  });

  it('a payload without any amount leaves both columns to the DB (no invented legacy value)', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { notes: 'x' } as any);
    const created = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created).not.toHaveProperty('legacy_amount');
    expect(created).not.toHaveProperty('service_amount');
  });
});

/**
 * R2 (legacy_amount -> service_amount), R5 (url_pdf -> file_url), R4 (tomador_name read fallback).
 * Expand window: legacy_amount stays a NOT NULL column derived from service_amount; url_pdf is
 * mirrored from file_url on write.
 */
describe('InvoicesService - legacy names accepted, canonical persisted (R2/R5)', () => {
  function setup() {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'invoice-1', ...(v as object) })),
      manager: { connection: { query: jest.fn(async () => []) } },
    };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const enc = { decryptNullable: jest.fn(() => null), encryptNullable: jest.fn(() => null) } as any;
    return { svc: new InvoicesService(ds, enc), repo };
  }

  it('R2: a legacy_amount-only payload persists service_amount (and the derived legacy_amount mirror)', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { legacy_amount: 500 } as any);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ service_amount: 500, legacy_amount: 500 }));
  });

  it('R2: the canonical service_amount wins when both are sent', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { legacy_amount: 500, service_amount: 700 } as any);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ service_amount: 700, legacy_amount: 700 }));
  });

  it('R5: a url_pdf-only payload persists file_url and mirrors url_pdf', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { url_pdf: 'https://x.test/a.pdf' } as any);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ file_url: 'https://x.test/a.pdf', url_pdf: 'https://x.test/a.pdf' }));
  });

  it('R5: file_url wins over url_pdf and is mirrored into url_pdf', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { file_url: 'https://x.test/new.pdf', url_pdf: 'https://x.test/old.pdf' } as any);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ file_url: 'https://x.test/new.pdf', url_pdf: 'https://x.test/new.pdf' }));
  });

  it('R5: neither name sent leaves both columns untouched', async () => {
    const { svc, repo } = setup();
    await svc.create('tenant-1', 'user-1', { notes: 'x' } as any);
    const created = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created).not.toHaveProperty('file_url');
    expect(created).not.toHaveProperty('url_pdf');
  });

  it('R5: reads return both names with file_url ?? url_pdf', async () => {
    const legacyRow = makeService([], { id: 'i', type: 'nfse', file_url: null, url_pdf: 'https://x.test/old.pdf' });
    expect(await legacyRow.svc.findById('t', 'i')).toMatchObject({ file_url: 'https://x.test/old.pdf', url_pdf: 'https://x.test/old.pdf' });
    const canonicalRow = makeService([], { id: 'i', type: 'nfse', file_url: 'https://x.test/new.pdf', url_pdf: 'https://x.test/old.pdf' });
    expect(await canonicalRow.svc.findById('t', 'i')).toMatchObject({ file_url: 'https://x.test/new.pdf', url_pdf: 'https://x.test/new.pdf' });
  });

  it('R4: reads return tomador_legal_name ?? tomador_name (canonical wins)', async () => {
    const legacyRow = makeService([], { id: 'i', type: 'nfse', tomador_legal_name: null, tomador_name: 'Antigo LTDA' });
    expect(await legacyRow.svc.findById('t', 'i')).toMatchObject({ tomador_legal_name: 'Antigo LTDA' });
    const both = makeService([], { id: 'i', type: 'nfse', tomador_legal_name: 'Novo LTDA', tomador_name: 'Antigo LTDA' });
    expect(await both.svc.findById('t', 'i')).toMatchObject({ tomador_legal_name: 'Novo LTDA' });
  });
});
