import 'reflect-metadata';
import { LeadInteractionsService } from './lead-interactions.service';
import type { CreateLeadInteractionDto, QueryLeadInteractionDto } from './dto/lead-interactions.dto';

/**
 * REM-04 (Remaining Product Completion Backlog): two real bugs discovered
 * while wiring `historicoInteracoes` (always []) to the real endpoint:
 * - list() read `query.lead_id`, but the DTO exposes `leadId` — the per-lead
 *   filter never worked (it returned interactions of every lead in the tenant).
 * - create() spread the DTO (leadId/type/notes) straight into the entity, whose
 *   real columns are lead_id/type/notes — every POST violated NOT NULL
 *   on lead_id/type.
 */
function makeQb(rows: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => [rows, rows.length]),
  };
}

function makeService(rows: unknown[] = []) {
  const qb = makeQb(rows);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'interaction-1', ...(entity as object) })),
  };
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const svc = new LeadInteractionsService(ds);
  return { svc, repo, qb };
}

describe('LeadInteractionsService.list — filtro por leadId (REM-04)', () => {
  it('filters by lead_id when leadId is sent in the query', async () => {
    const { svc, qb } = makeService();
    await svc.list('tenant-1', { leadId: 'lead-1' } as unknown as QueryLeadInteractionDto);

    expect(qb.andWhere).toHaveBeenCalledWith('i.lead_id = :leadId', { leadId: 'lead-1' });
  });

  it('without leadId, does not filter by lead (lists every tenant interaction)', async () => {
    const { svc, qb } = makeService();
    await svc.list('tenant-1', {} as unknown as QueryLeadInteractionDto);

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('LeadInteractionsService.create — mapeamento DTO → colunas reais (REM-04)', () => {
  it('writes lead_id/type/notes to the entity\'s real columns', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      leadId: 'lead-1', type: 'call', notes: 'Ligação de follow-up',
    } as CreateLeadInteractionDto);

    const created = (repo.create as jest.Mock).mock.calls[0][0];
    expect(created.lead_id).toBe('lead-1');
    expect(created.type).toBe('call');
    expect(created.notes).toBe('Ligação de follow-up');
    expect(created.leadId).toBeUndefined();
  });

  it('absent notes persists notes as null (not undefined)', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      leadId: 'lead-1', type: 'note',
    } as CreateLeadInteractionDto);

    expect((repo.create as jest.Mock).mock.calls[0][0].notes).toBeNull();
  });
});
