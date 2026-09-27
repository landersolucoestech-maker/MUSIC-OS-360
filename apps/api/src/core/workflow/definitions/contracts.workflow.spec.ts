import { ContractStatus } from '@music-os-360/types';
import { CONTRACTS_WORKFLOW } from './contracts.workflow';

/**
 * CZ-026: contracts.arquivo_url became file_url (migration 20260928000004).
 * The signing guard reads the entity directly, so a stale column name would
 * silently block every AWAITING_SIGNATURE -> SIGNED transition.
 */
describe('CONTRACTS_WORKFLOW — AWAITING_SIGNATURE -> SIGNED guard', () => {
  const transition = CONTRACTS_WORKFLOW.transitions.find(
    (t) => t.from === ContractStatus.AWAITING_SIGNATURE && t.to === ContractStatus.SIGNED,
  )!;
  const run = (entity: Record<string, unknown>) =>
    transition.guard!({ entity } as unknown as Parameters<NonNullable<typeof transition.guard>>[0]);

  it('allows signing when the contract file is attached (file_url)', async () => {
    await expect(run({ file_url: 'https://files.example/contract.pdf' })).resolves.toEqual({ allowed: true });
  });

  it('blocks signing without an attached file', async () => {
    await expect(run({ file_url: null })).resolves.toMatchObject({ allowed: false });
  });
});
