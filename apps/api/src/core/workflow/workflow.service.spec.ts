import { BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import type { WorkflowDefinition } from './workflow.types';

const DEFINITION: WorkflowDefinition<string> = {
  name: 'demo_workflow',
  entityType: 'demo',
  initialState: 'draft',
  states: ['draft', 'review', 'signed'],
  transitions: [
    { from: 'draft', to: 'review', roles: ['admin'] },
    {
      from: 'review',
      to: 'signed',
      guard: async () => ({ allowed: false, reason: 'Anexe o documento antes de assinar.' }),
    },
  ],
};

function service(): WorkflowService {
  const svc = new WorkflowService(null);
  svc.register(DEFINITION);
  return svc;
}

async function rejection(req: { fromStatus: string; toStatus: string; actorRole?: string }) {
  try {
    await service().transition({ entityType: 'demo', entityId: 'e1', tenantId: 't1', actorId: 'u1', entity: {}, ...req });
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).getResponse() as { error: string; message: string };
  }
  throw new Error('expected the transition to be rejected');
}

describe('WorkflowService — rejected transition → end-user copy boundary', () => {
  it('undefined transition: PT-BR copy, machine code, no raw states or workflow name', async () => {
    const body = await rejection({ fromStatus: 'draft', toStatus: 'signed', actorRole: 'admin' });
    expect(body.error).toBe('WORKFLOW_TRANSITION_NOT_DEFINED');
    expect(body.message).toBe('Esta mudança de status não é permitida.');
    expect(body.message).not.toMatch(/draft|signed|demo_workflow/);
  });

  it('role not authorized: never echoes the role slug', async () => {
    const body = await rejection({ fromStatus: 'draft', toStatus: 'review', actorRole: 'viewer' });
    expect(body.error).toBe('WORKFLOW_ROLE_NOT_AUTHORIZED');
    expect(body.message).not.toContain('viewer');
  });

  it('missing actor role: authentication copy', async () => {
    const body = await rejection({ fromStatus: 'draft', toStatus: 'review' });
    expect(body.error).toBe('WORKFLOW_ACTOR_ROLE_MISSING');
    expect(body.message).toBe('Você precisa estar autenticado para realizar esta ação.');
  });

  it('guard rejection: returns the guard PT-BR copy as-is', async () => {
    const body = await rejection({ fromStatus: 'review', toStatus: 'signed', actorRole: 'admin' });
    expect(body.error).toBe('WORKFLOW_GUARD_REJECTED');
    expect(body.message).toBe('Anexe o documento antes de assinar.');
  });
});
