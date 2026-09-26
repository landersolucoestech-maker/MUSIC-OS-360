/**
 * shares.service.spec.ts
 *
 * Phase 5 / C6: proves that holder_name/percentage (ownership fields —
 * ABRAMUS/ECAD submission) are never derived from holder/artista_externo/
 * pagador/recipient (financial share fields — a distinct concept),
 * nor filled with an artificial default ('N/D' / 0). Tested at the service
 * level — class-validator decorators do NOT run here (see shares.dto.spec.ts
 * for payload validation via ValidationPipe).
 */
import 'reflect-metadata';
import { SharesService } from './shares.service';
import type { CreateShareDto, UpdateShareDto } from './dto/shares.dto';

function makeRepo() {
  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'share-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      const chain = () => qb;
      qb['where'] = jest.fn(chain);
      qb['getOne'] = jest.fn(async () => ({ id: 'share-1', tenant_id: 'tenant-1' }));
      return qb;
    }),
  };
}

function makeService() {
  const repo = makeRepo();
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const ds = {
    getRepository: jest.fn(() => repo),
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  } as never;
  const svc = new SharesService(ds);
  return { svc, repo };
}

function created(repo: ReturnType<typeof makeRepo>) {
  return (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
}

function updated(repo: ReturnType<typeof makeRepo>) {
  return (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
}

describe('SharesService.create — holder_name/percentage isolation (Phase 5 / C6)', () => {
  it('does not populate holder_name/percentage when only financial fields are sent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', {
      holder: 'João', artista_externo: 'Banda X', pagador: 'Gravadora Y', recipient: 'Z',
      share_type: 'pendente', percentage: undefined,
    } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).toBeUndefined();
    expect(row['percentage']).toBeUndefined();
    expect(row['holder']).toBe('João');
  });

  it('never derives holder_name from holder/artista_externo/pagador/recipient', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', {
      holder: 'D', artista_externo: 'AE', pagador: 'P', recipient: 'DEST',
    } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).not.toBe('D');
    expect(row['holder_name']).not.toBe('AE');
    expect(row['holder_name']).not.toBe('P');
    expect(row['holder_name']).not.toBe('DEST');
    expect(row['holder_name']).toBeUndefined();
  });

  it('never applies an artificial default ("N/D" or 0) when the field is absent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holder: 'João' } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).not.toBe('N/D');
    expect(row['percentage']).not.toBe(0);
    expect(row['holder_name']).toBeUndefined();
    expect(row['percentage']).toBeUndefined();
  });

  it('writes holder_name/percentage when holderName/percentage are sent explicitly', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'Maria Autora', percentage: 50 } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).toBe('Maria Autora');
    expect(row['percentage']).toBe(50);
  });

  it('persists explicit percentage: 0 as 0, not as absent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'Autor Zero', percentage: 0 } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['percentage']).toBe(0);
  });

  it('writes tenant_id on the created record', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'X' } as unknown as CreateShareDto);
    expect(created(repo)['tenant_id']).toBe('tenant-1');
  });
});

describe('SharesService.update — partial patch does not contaminate registry fields (Phase 5 / C6)', () => {
  it('updating only financial fields never contaminates holder_name/percentage', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', {
      holder: 'Novo Detentor', pagador: 'Novo Pagador',
    } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeUndefined();
    expect(row['percentage']).toBeUndefined();
    expect(row['holder']).toBe('Novo Detentor');
  });

  it('explicit holderName: null clears the holder_name column (not treated as absent)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { holderName: null } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeNull();
  });

  it('explicit percentage: null clears the percentage column', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { percentage: null } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['percentage']).toBeNull();
  });

  it('partial patch never restores the old fallback (holder does not become holder_name even on update)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { holder: 'Só Detentor' } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeUndefined();
  });
});

/**
 * Task T (continuation) — "Registrar Recebimento"/"Registrar Envio" in
 * GestaoShares.tsx sends { status, settled_amount, expectedUpdatedAt } but
 * valor_liquidado (and valor_total) never existed as a column: the status
 * change persisted, the settled value was silently discarded. Proves
 * that both fields now reach the generated UPDATE/INSERT.
 *
 * Cluster G (naming-normalization mandate) renamed valor_total ->
 * total_amount and valor_liquidado -> settled_amount; fixtures updated
 * in lockstep.
 */
describe('SharesService — total_amount/settled_amount persistence (Task T)', () => {
  it('create: writes total_amount when sent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'X', total_amount: 1500.5 } as unknown as CreateShareDto);
    expect(created(repo)['total_amount']).toBe(1500.5);
  });

  it('update: writes settled_amount when registering receipt/payment (same payload as the page quick-action)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', {
      status: 'recebido',
      settled_amount: 800,
    } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['status']).toBe('recebido');
    expect(row['settled_amount']).toBe(800);
  });

  it('update: explicit settled_amount: 0 persists as 0, not as absent', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { settled_amount: 0 } as unknown as UpdateShareDto);
    expect(updated(repo)['settled_amount']).toBe(0);
  });
});
