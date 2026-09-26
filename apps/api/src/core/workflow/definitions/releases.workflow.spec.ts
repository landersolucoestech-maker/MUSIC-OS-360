import { ReleaseStatus } from '@music-os-360/types';
import { WorkflowEngine } from '../workflow.engine';
import { RELEASES_WORKFLOW } from './releases.workflow';

/**
 * find-ed7823e9: o frontend forçava PATCH status 'distributed' logo após
 * criar um lançamento (que o backend cria sempre em DRAFT). Este spec fixa o
 * contrato real do workflow: DRAFT -> DISTRIBUTED não existe; só
 * SCHEDULED -> DISTRIBUTED. Qualquer atalho de "criar e distribuir" precisa
 * passar pelo workflow, nunca por um PATCH direto de status.
 */
describe('RELEASES_WORKFLOW — distribuição', () => {
  const engine = new WorkflowEngine<string>(RELEASES_WORKFLOW);
  const base = { entityType: 'release', entityId: 'r1', tenantId: 't1', actorId: 'u1', actorRole: 'admin', entity: {} };

  it('estado inicial do domínio para um lançamento não distribuído é DRAFT', () => {
    expect(RELEASES_WORKFLOW.initialState).toBe(ReleaseStatus.DRAFT);
  });

  it('rejeita DRAFT -> DISTRIBUTED (transition_not_defined)', async () => {
    await expect(
      engine.transition({ ...base, fromStatus: ReleaseStatus.DRAFT, toStatus: ReleaseStatus.DISTRIBUTED } as never),
    ).rejects.toThrow(/Transição inválida/);
  });

  it('permite SCHEDULED -> DISTRIBUTED para admin', async () => {
    await expect(
      engine.transition({ ...base, fromStatus: ReleaseStatus.SCHEDULED, toStatus: ReleaseStatus.DISTRIBUTED } as never),
    ).resolves.toBeUndefined();
  });
});

describe('RELEASES_WORKFLOW — round-trips com perda que o formulário antigo gerava', () => {
  const engine = new WorkflowEngine<string>(RELEASES_WORKFLOW);
  const base = { entityType: 'release', entityId: 'r1', tenantId: 't1', actorId: 'u1', actorRole: 'admin', entity: {} };
  const lossy: Array<[string, string]> = [
    [ReleaseStatus.DISTRIBUTED, ReleaseStatus.SCHEDULED],
    [ReleaseStatus.ARCHIVED, ReleaseStatus.RELEASED],
    [ReleaseStatus.ASSETS_PENDING, ReleaseStatus.METADATA_PENDING],
  ];
  for (const [from, to] of lossy) {
    it(`${from} -> ${to} não existe (editar metadados não pode reenviar status)`, async () => {
      await expect(engine.transition({ ...base, fromStatus: from, toStatus: to } as never)).rejects.toThrow(/Transição inválida/);
    });
  }
});
