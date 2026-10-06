import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, QueryInvoiceDto, UpdateInvoiceDto } from './dto/invoices.dto';

/**
 * `fiscal_document_type` (nfse | nfe | nfce) is the canonical API name of the fiscal note kind;
 * `tipo_nota` is a DEPRECATED alias (body and query). The persisted column stays `tipo_nota`
 * (no rename: owner decision R1) and `invoices.type` keeps its row-kind semantics.
 * Validation runs through the same ValidationPipe options as create-app.ts.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const run = <T>(metatype: new () => T, value: unknown) => pipe.transform(value, { type: 'body', metatype });
const runQuery = <T>(metatype: new () => T, value: unknown) => pipe.transform(value, { type: 'query', metatype });

function makeCreateService() {
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'inv-1', ...(v as object) })),
    manager: { connection: { query: jest.fn(async () => [{ exists: 1 }]) } },
  };
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = { encryptNullable: jest.fn(() => null), decryptNullable: jest.fn(() => null) };
  return { service: new InvoicesService(ds as never, enc as never, { emitTyped: jest.fn() } as never), repo };
}

function makeListService(rows: unknown[] = []) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => [rows, rows.length]),
  };
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = { encryptNullable: jest.fn(), decryptNullable: jest.fn(() => null) };
  return { service: new InvoicesService(ds as never, enc as never), qb };
}

const persisted = async (body: unknown) => {
  const { service, repo } = makeCreateService();
  const dto = (await run(CreateInvoiceDto, body)) as CreateInvoiceDto;
  await service.create('tenant-1', 'user-1', dto);
  return repo.create.mock.calls[0][0] as Record<string, unknown>;
};

describe('fiscal_document_type body contract (through the ValidationPipe)', () => {
  it('accepts the canonical name and persists it in the existing column tipo_nota', async () => {
    const row = await persisted({ fiscal_document_type: 'nfe', service_amount: 10 });
    expect(row['tipo_nota']).toBe('nfe');
    expect(row).not.toHaveProperty('fiscal_document_type');
    expect(row['type']).toBe('fiscal');
  });

  it('accepts the deprecated alias tipo_nota and maps it (deprecated key never persisted as an alias)', async () => {
    const row = await persisted({ tipo_nota: 'nfce' });
    expect(row['tipo_nota']).toBe('nfce');
    expect(row).not.toHaveProperty('fiscal_document_type');
    expect(row['type']).toBe('fiscal');
  });

  it('the canonical value wins when both names are sent with different values', async () => {
    const row = await persisted({ fiscal_document_type: 'nfse', tipo_nota: 'nfe' });
    expect(row['tipo_nota']).toBe('nfse');
    expect(row).not.toHaveProperty('fiscal_document_type');
  });

  it('an empty deprecated alias is dropped, never written', async () => {
    const row = await persisted({ tipo_nota: null });
    expect(row).not.toHaveProperty('tipo_nota');
  });

  it('rejects an unknown field and an out-of-vocabulary value under either name', async () => {
    await expect(run(CreateInvoiceDto, { fiscal_type: 'nfse' })).rejects.toBeDefined();
    await expect(run(CreateInvoiceDto, { fiscal_document_type: 'xyz' })).rejects.toBeDefined();
    await expect(run(CreateInvoiceDto, { tipo_nota: 'xyz' })).rejects.toBeDefined();
    await expect(run(CreateInvoiceDto, { fiscalDocumentType: 'nfse' })).rejects.toBeDefined();
  });

  it('update accepts both names, canonical wins, and never touches `type`', async () => {
    const { service } = makeCreateService();
    const canonical = (await run(UpdateInvoiceDto, { fiscal_document_type: 'nfe' })) as UpdateInvoiceDto;
    const both = (await run(UpdateInvoiceDto, { fiscal_document_type: 'nfe', tipo_nota: 'nfce' })) as UpdateInvoiceDto;
    const alias = (await run(UpdateInvoiceDto, { tipo_nota: 'nfce' })) as UpdateInvoiceDto;
    const normalize = (dto: UpdateInvoiceDto) => (service as any).normalizePayload(dto) as Record<string, unknown>;
    expect(normalize(canonical)['tipo_nota']).toBe('nfe');
    expect(normalize(both)['tipo_nota']).toBe('nfe');
    expect(normalize(alias)['tipo_nota']).toBe('nfce');
    for (const dto of [canonical, both, alias]) {
      expect(normalize(dto)).not.toHaveProperty('fiscal_document_type');
      expect(normalize(dto)).not.toHaveProperty('type');
    }
    await expect(run(UpdateInvoiceDto, { fiscal_document_type: 'xyz' })).rejects.toBeDefined();
  });
});

describe('fiscal_document_type list filter (through the ValidationPipe)', () => {
  const filterParam = async (query: unknown) => {
    const { service, qb } = makeListService();
    await service.list('tenant-1', (await runQuery(QueryInvoiceDto, query)) as QueryInvoiceDto);
    const call = qb.andWhere.mock.calls.find(([sql]) => String(sql).includes('i.tipo_nota ='));
    return call as [string, { fiscalDocumentType: string }] | undefined;
  };

  it('filters by the canonical query name', async () => {
    const call = await filterParam({ fiscal_document_type: 'nfe' });
    expect(call?.[1]).toEqual({ fiscalDocumentType: 'nfe' });
  });

  it('filters by the deprecated alias tipo_nota', async () => {
    const call = await filterParam({ tipo_nota: 'nfce' });
    expect(call?.[1]).toEqual({ fiscalDocumentType: 'nfce' });
  });

  it('canonical wins over the alias when both are sent', async () => {
    const call = await filterParam({ fiscal_document_type: 'nfse', tipo_nota: 'nfe' });
    expect(call?.[1]).toEqual({ fiscalDocumentType: 'nfse' });
  });

  it('rows whose `type` still holds the note kind stay found (OR i.type) and the row-kind exclusion is kept', async () => {
    const { service, qb } = makeListService();
    await service.list('tenant-1', (await runQuery(QueryInvoiceDto, { fiscal_document_type: 'nfse' })) as QueryInvoiceDto);
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(i.tipo_nota = :fiscalDocumentType OR i.type = :fiscalDocumentType)',
      { fiscalDocumentType: 'nfse' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("i.type != 'stripe_subscription'");
  });

  it('the older `type` query alias still works, and no filter is added without any of them', async () => {
    expect((await filterParam({ type: 'nfse' }))?.[1]).toEqual({ fiscalDocumentType: 'nfse' });
    expect(await filterParam({})).toBeUndefined();
  });

  it('rejects an out-of-vocabulary value and an unknown query key', async () => {
    await expect(runQuery(QueryInvoiceDto, { fiscal_document_type: 'xyz' })).rejects.toBeDefined();
    await expect(runQuery(QueryInvoiceDto, { tipo_nota: 'xyz' })).rejects.toBeDefined();
    await expect(runQuery(QueryInvoiceDto, { fiscalDocumentType: 'nfse' })).rejects.toBeDefined();
  });
});

describe('fiscal_document_type response', () => {
  it('exposes canonical fiscal_document_type with tipo_nota kept as deprecated mirror; legacy rows with no tipo_nota give null', async () => {
    const { service, qb } = makeListService([
      { id: 'a', type: 'fiscal', tipo_nota: 'nfe' },
      { id: 'b', type: 'nfse', tipo_nota: null },
    ]);
    const { data } = await service.list('tenant-1', {} as QueryInvoiceDto);
    expect(data[0]).toMatchObject({ fiscal_document_type: 'nfe', tipo_nota: 'nfe' });
    expect(data[1]).toMatchObject({ fiscal_document_type: null, type: 'nfse' });
    expect(qb.getManyAndCount).toHaveBeenCalled();
  });
});

describe('fiscal_document_type in domain events (persisted column tipo_nota is the source)', () => {
  it('INVOICE_CREATED payload type is the persisted fiscal kind of the saved row', async () => {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'inv-1', ...(v as object) })),
      manager: { connection: { query: jest.fn(async () => [{ exists: 1 }]) } },
    };
    const emitTyped = jest.fn();
    const service = new InvoicesService(
      { getRepository: jest.fn(() => repo) } as never,
      { encryptNullable: jest.fn(() => null), decryptNullable: jest.fn(() => null) } as never,
      { emitTyped } as never,
    );
    const dto = (await run(CreateInvoiceDto, { fiscal_document_type: 'nfce' })) as CreateInvoiceDto;
    await service.create('tenant-1', 'user-1', dto);
    const created = emitTyped.mock.calls.find(([name]) => String(name).includes('created'));
    expect(created).toBeDefined();
    expect(created![1].payload.type).toBe('nfce');
  });

  it('INVOICE_ISSUED payload type is the persisted fiscal kind of the updated row', async () => {
    const rows = [
      { id: 'inv-1', tenant_id: 'tenant-1', status: 'draft', type: 'fiscal', tipo_nota: 'nfe' },
      { id: 'inv-1', tenant_id: 'tenant-1', status: 'issued', type: 'fiscal', tipo_nota: 'nfe' },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementationOnce(async () => rows[0]).mockImplementation(async () => rows[1]),
    };
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: { connection: { query: jest.fn(async () => [{ exists: 1 }]) } },
    };
    const emitTyped = jest.fn();
    const service = new InvoicesService(
      { getRepository: jest.fn(() => repo) } as never,
      { encryptNullable: jest.fn(() => null), decryptNullable: jest.fn(() => null) } as never,
      { emitTyped } as never,
    );
    await service.update('tenant-1', 'user-1', 'inv-1', { status: 'issued' } as never);
    const issued = emitTyped.mock.calls.find(([name]) => String(name).includes('issued'));
    expect(issued).toBeDefined();
    expect(issued![1].payload.type).toBe('nfe');
  });
});
