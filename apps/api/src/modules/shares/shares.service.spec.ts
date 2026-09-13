/**
 * shares.service.spec.ts
 *
 * Fase 5 / C6: prova que holder_name/percentage (campos de titularidade —
 * submissão ABRAMUS/ECAD) nunca são derivados de holder/artista_externo/
 * pagador/recipient (campos do share financeiro — conceito distinto),
 * nem preenchidos com default artificial ('N/D' / 0). Testado no nível do
 * serviço — decorators class-validator NÃO rodam aqui (ver shares.dto.spec.ts
 * para a validação de payload via ValidationPipe).
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

describe('SharesService.create — isolamento holder_name/percentage (Fase 5 / C6)', () => {
  it('não popula holder_name/percentage quando apenas campos financeiros são enviados', async () => {
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

  it('nunca deriva holder_name de holder/artista_externo/pagador/recipient', async () => {
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

  it('nunca aplica default artificial ("N/D" ou 0) quando o campo está ausente', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holder: 'João' } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).not.toBe('N/D');
    expect(row['percentage']).not.toBe(0);
    expect(row['holder_name']).toBeUndefined();
    expect(row['percentage']).toBeUndefined();
  });

  it('grava holder_name/percentage quando holderName/percentage são enviados explicitamente', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'Maria Autora', percentage: 50 } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['holder_name']).toBe('Maria Autora');
    expect(row['percentage']).toBe(50);
  });

  it('persiste percentage: 0 explícito como 0, não como ausente', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'Autor Zero', percentage: 0 } as unknown as CreateShareDto);

    const row = created(repo);
    expect(row['percentage']).toBe(0);
  });

  it('grava tenant_id no registro criado', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'X' } as unknown as CreateShareDto);
    expect(created(repo)['tenant_id']).toBe('tenant-1');
  });
});

describe('SharesService.update — patch parcial não contamina campos de registro (Fase 5 / C6)', () => {
  it('atualizar apenas campos financeiros nunca contamina holder_name/percentage', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', {
      holder: 'Novo Detentor', pagador: 'Novo Pagador',
    } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeUndefined();
    expect(row['percentage']).toBeUndefined();
    expect(row['holder']).toBe('Novo Detentor');
  });

  it('envio explícito de holderName: null limpa a coluna holder_name (não é tratado como ausente)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { holderName: null } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeNull();
  });

  it('envio explícito de percentage: null limpa a coluna percentage', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { percentage: null } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['percentage']).toBeNull();
  });

  it('patch parcial nunca restaura o antigo fallback (holder não vira holder_name mesmo em update)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { holder: 'Só Detentor' } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['holder_name']).toBeUndefined();
  });
});

/**
 * Task T (continuidade) — "Registrar Recebimento"/"Registrar Envio" em
 * GestaoShares.tsx envia { status, valor_liquidado, expectedUpdatedAt } mas
 * valor_liquidado (e valor_total) nunca existiram como coluna: a mudança de
 * status persistia, o valor liquidado era descartado silenciosamente. Prova
 * que ambos os campos agora chegam ao UPDATE/INSERT gerado.
 */
describe('SharesService — persistência de valor_total/valor_liquidado (Task T)', () => {
  it('create: grava valor_total quando enviado', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', { holderName: 'X', valor_total: 1500.5 } as unknown as CreateShareDto);
    expect(created(repo)['valor_total']).toBe(1500.5);
  });

  it('update: grava valor_liquidado ao registrar recebimento/envio (mesmo payload do quick-action da página)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', {
      status: 'recebido',
      valor_liquidado: 800,
    } as unknown as UpdateShareDto);

    const row = updated(repo);
    expect(row['status']).toBe('recebido');
    expect(row['valor_liquidado']).toBe(800);
  });

  it('update: valor_liquidado: 0 explícito persiste como 0, não como ausente', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'share-1', { valor_liquidado: 0 } as unknown as UpdateShareDto);
    expect(updated(repo)['valor_liquidado']).toBe(0);
  });
});
