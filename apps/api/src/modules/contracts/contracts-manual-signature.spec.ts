/**
 * A contract can be signed outside the platform (manual or external signature): the platform never fakes an
 * electronic envelope. Registering that signature needs the signed document attached and a role allowed to do it;
 * the server records how it entered (origin, who, when) and a client cannot forge that record.
 */
import 'reflect-metadata';
import { ContractStatus } from '@music-os-360/types';
import { ContractsService } from './contracts.service';
import { CONTRACTS_WORKFLOW } from '../../core/workflow/definitions/contracts.workflow';
import type { UpdateContractDto } from './dto/update-contract.dto';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'contract-1', tenant_id: 'tenant-1', title: 'Contrato', type: 'recording', status: 'awaiting_signature',
  artist_id: null, client_id: null, fixed_value: null, start_date: null, end_date: null, file_url: 'https://r2/signed.pdf',
  signers: [], documents: [], versions: [], exclusive: false, metadata: { note: 'kept', provider_doc_id: 'prov-1' },
  updated_at: new Date('2026-01-01T00:00:00Z'), deleted_at: null, ...overrides,
});

function build(current: Record<string, unknown>) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['leftJoinAndMapOne', 'select', 'where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb['getOne'] = jest.fn(async () => current);
  const repo = { createQueryBuilder: jest.fn(() => qb), update: jest.fn(async () => ({ affected: 1 })) };
  const ds = {
    getRepository: jest.fn(() => repo),
    query: jest.fn(async () => [{ exists: 1 }]),
    transaction: jest.fn(async (cb: (em: unknown) => unknown) => cb({ getRepository: () => repo })),
  } as never;
  const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn(async () => undefined) };
  const events = { emitTyped: jest.fn() };
  const planLimit = { enforce: jest.fn(async () => undefined) } as never;
  return { svc: new ContractsService(ds, workflow as never, events as never, planLimit), repo, events };
}

const written = (repo: { update: jest.Mock }) => repo.update.mock.calls[0][1] as Record<string, unknown>;

describe('manual signature registration', () => {
  it('stamps the origin, the actor and the time on the contract, next to the metadata already stored', async () => {
    const { svc, repo } = build(row());
    await svc.update('tenant-1', 'user-7', 'contract-1', { status: ContractStatus.SIGNED } as unknown as UpdateContractDto, 'owner');
    const metadata = written(repo)['metadata'] as Record<string, Record<string, unknown>>;
    expect(written(repo)['status']).toBe(ContractStatus.SIGNED);
    expect(metadata['signature_registration']).toMatchObject({ origin: 'manual_registration', registered_by: 'user-7' });
    expect(typeof metadata['signature_registration']['registered_at']).toBe('string');
    expect(metadata).toMatchObject({ note: 'kept', provider_doc_id: 'prov-1' });
  });

  it('ignores a signature_registration forged by the client', async () => {
    const { svc, repo } = build(row());
    await svc.update('tenant-1', 'user-7', 'contract-1', {
      status: ContractStatus.SIGNED,
      metadata: { signature_registration: { origin: 'provider', registered_by: 'someone-else' }, other: 1 },
    } as unknown as UpdateContractDto, 'owner');
    const metadata = written(repo)['metadata'] as Record<string, Record<string, unknown>>;
    expect(metadata['signature_registration']).toMatchObject({ origin: 'manual_registration', registered_by: 'user-7' });
    expect(metadata).toMatchObject({ other: 1 });
  });

  it('a forged signature_registration cannot be planted by an ordinary edit either', async () => {
    const { svc, repo } = build(row({ status: 'draft' }));
    await svc.update('tenant-1', 'user-7', 'contract-1', { metadata: { signature_registration: { origin: 'provider' }, other: 1 } } as unknown as UpdateContractDto, 'owner');
    expect(written(repo)['metadata']).not.toHaveProperty('signature_registration');
  });

  it('other transitions do not stamp a signature record', async () => {
    const { svc, repo } = build(row({ status: 'draft' }));
    await svc.update('tenant-1', 'user-7', 'contract-1', { status: ContractStatus.UNDER_REVIEW } as unknown as UpdateContractDto, 'owner');
    expect(written(repo)['metadata']).toBeUndefined();
  });
});

describe('the contracts workflow guard for registering a signature', () => {
  const transition = CONTRACTS_WORKFLOW.transitions.find((t) => t.to === ContractStatus.SIGNED)!;
  const run = (entity: Record<string, unknown>) => transition.guard!({ entity } as never);

  it('rejects a signature registered without the signed document attached', async () => {
    await expect(run({ file_url: null })).resolves.toMatchObject({ allowed: false });
    await expect(run({})).resolves.toMatchObject({ allowed: false });
  });

  it('accepts it with the document attached', async () => {
    await expect(run({ file_url: 'https://r2/signed.pdf' })).resolves.toMatchObject({ allowed: true });
  });

  it('is limited to management roles and starts only from awaiting_signature', () => {
    expect(transition.from).toBe(ContractStatus.AWAITING_SIGNATURE);
    expect(transition.roles).not.toContain('viewer');
    expect(transition.roles).not.toContain('artist');
  });
});
