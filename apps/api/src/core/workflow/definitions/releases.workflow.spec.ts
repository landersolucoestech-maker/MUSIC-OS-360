import { ReleaseStatus } from '@music-os-360/types';
import { WorkflowEngine } from '../workflow.engine';
import { RELEASES_WORKFLOW } from './releases.workflow';

/**
 * find-ed7823e9: the frontend used to force a PATCH to status 'distributed'
 * right after creating a release (which the backend always creates in DRAFT).
 * This spec pins the real workflow contract: DRAFT -> DISTRIBUTED does not
 * exist; only SCHEDULED -> DISTRIBUTED. Any "create and distribute" shortcut
 * must go through the workflow, never through a direct status PATCH.
 */
describe('RELEASES_WORKFLOW — distribution', () => {
  const engine = new WorkflowEngine<string>(RELEASES_WORKFLOW);
  const base = { entityType: 'release', entityId: 'r1', tenantId: 't1', actorId: 'u1', actorRole: 'admin', entity: {} };

  it('the initial domain state for a non-distributed release is DRAFT', () => {
    expect(RELEASES_WORKFLOW.initialState).toBe(ReleaseStatus.DRAFT);
  });

  it('rejects DRAFT -> DISTRIBUTED (transition_not_defined)', async () => {
    await expect(
      engine.transition({ ...base, fromStatus: ReleaseStatus.DRAFT, toStatus: ReleaseStatus.DISTRIBUTED } as never),
    ).rejects.toThrow(/Invalid transition/);
  });

  it('allows SCHEDULED -> DISTRIBUTED for admin', async () => {
    await expect(
      engine.transition({ ...base, fromStatus: ReleaseStatus.SCHEDULED, toStatus: ReleaseStatus.DISTRIBUTED } as never),
    ).resolves.toBeUndefined();
  });
});

describe('RELEASES_WORKFLOW — lossy round-trips that the old form used to generate', () => {
  const engine = new WorkflowEngine<string>(RELEASES_WORKFLOW);
  const base = { entityType: 'release', entityId: 'r1', tenantId: 't1', actorId: 'u1', actorRole: 'admin', entity: {} };
  const lossy: Array<[string, string]> = [
    [ReleaseStatus.DISTRIBUTED, ReleaseStatus.SCHEDULED],
    [ReleaseStatus.ARCHIVED, ReleaseStatus.RELEASED],
    [ReleaseStatus.ASSETS_PENDING, ReleaseStatus.METADATA_PENDING],
  ];
  for (const [from, to] of lossy) {
    it(`${from} -> ${to} does not exist (editing metadata cannot resubmit status)`, async () => {
      await expect(engine.transition({ ...base, fromStatus: from, toStatus: to } as never)).rejects.toThrow(/Invalid transition/);
    });
  }
});

/**
 * CZ-038: the cover column is `cover_url` (formerly capa_url). The guard reads
 * the persisted entity row, so a release with a cover must pass and one
 * without a cover must be blocked — a stale column name would block every
 * release silently.
 */
describe('RELEASES_WORKFLOW — cover guard (ASSETS_PENDING -> REVIEW)', () => {
  const engine = new WorkflowEngine<string>(RELEASES_WORKFLOW);
  const base = {
    entityType: 'release', entityId: 'r1', tenantId: 't1', actorId: 'u1', actorRole: 'admin',
    fromStatus: ReleaseStatus.ASSETS_PENDING, toStatus: ReleaseStatus.REVIEW,
  };

  it('allows the transition when the persisted row has cover_url', async () => {
    await expect(
      engine.transition({ ...base, entity: { cover_url: 'https://cdn/x.png' } } as never),
    ).resolves.toBeUndefined();
  });

  it('blocks the transition when there is no cover (legacy capa_url is not read)', async () => {
    await expect(
      engine.transition({ ...base, entity: { capa_url: 'https://cdn/x.png' } } as never),
    ).rejects.toThrow(/Guard rejected transition/);
  });
});
