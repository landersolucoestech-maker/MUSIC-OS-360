import * as fs from 'fs';
import * as path from 'path';
import { WorkflowQueueService } from './services/workflow-queue.service';
import { ExternalDataProcessor } from './processors/external-data.processor';
import { QUEUE_NAMES, UNCONSUMED_QUEUE_JOBS, WORKFLOW_JOB_NAMES, SPOTIFY_JOB_NAMES } from './queue.constants';

/**
 * find-721c845e — producer/consumer topology of the BullMQ queues.
 *
 * Invariant: every job actually enqueued has a real consumer that handles it
 * (not `default`), and every job without a consumer is in
 * UNCONSUMED_QUEUE_JOBS and is NEVER enqueued. Before: onboarding-check /
 * workflow-followup grew without bound in integrations-sync (no
 * @Processor) and distribution-sync / spotify:sync were "completed" without
 * work by ExternalDataProcessor's silent default branch.
 */
const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('queue topology — static', () => {
  const sources = walk(SRC).map((f) => ({ f, src: fs.readFileSync(f, 'utf8') }));
  const processed = new Set<string>();
  for (const { src } of sources) {
    for (const m of src.matchAll(/@Processor\(\s*QUEUE_NAMES\.([A-Z_]+)\s*\)/g)) processed.add(QUEUE_NAMES[m[1] as keyof typeof QUEUE_NAMES]);
  }

  it('every queue has a @Processor except integrations-sync (contained)', () => {
    const missing = Object.values(QUEUE_NAMES).filter((q) => !processed.has(q));
    expect(missing).toEqual([QUEUE_NAMES.INTEGRATIONS_SYNC]);
  });

  it('no production file calls .add() with a contained job', () => {
    const offenders: string[] = [];
    for (const { f, src } of sources) {
      for (const job of Object.keys(UNCONSUMED_QUEUE_JOBS)) {
        const literal = new RegExp(`\\.add\\(\\s*['"\`]${job.replace(/[.:]/g, '\\$&')}['"\`]`);
        if (literal.test(src)) offenders.push(`${path.relative(SRC, f)} -> ${job}`);
      }
      if (/\.add\(\s*(WORKFLOW_JOB_NAMES\.(ONBOARDING_CHECK|WORKFLOW_FOLLOWUP|DISTRIBUTION_SYNC)|SPOTIFY_JOB_NAMES\.ACCOUNT_SYNC)/.test(src)) {
        offenders.push(`${path.relative(SRC, f)} -> constant`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('queue topology — WorkflowQueueService (behavioral)', () => {
  function build() {
    const integrations = { add: jest.fn(async (name: string) => ({ id: `i-${name}` })) };
    const streaming = { add: jest.fn(async (name: string) => ({ id: `s-${name}` })) };
    const svc = new WorkflowQueueService(integrations as never, streaming as never);
    return { svc, integrations, streaming };
  }

  it('contained jobs are enqueued on no queue', async () => {
    const { svc, integrations, streaming } = build();
    await svc.enqueueOnboardingCheck({ tenantId: 't1', artistId: 'a1', tasks: ['x'] });
    await svc.enqueueWorkflowFollowup({ tenantId: 't1', entityType: 'contract', entityId: 'c1', trigger: 'contract.signed' });
    await svc.enqueueDistributionSync({ tenantId: 't1', artistId: 'a1', contractId: null, providerHint: null });
    expect(integrations.add).not.toHaveBeenCalled();
    expect(streaming.add).not.toHaveBeenCalled();
  });

  it('every job still enqueued on streaming-sync has a real handler in ExternalDataProcessor', async () => {
    const { svc, streaming } = build();
    await svc.enqueueExternalDataSync({ tenantId: 't1', artistId: 'a1', workIds: [], societyHint: 'abramus' });
    await svc.enqueueDistributorSubmit({ tenantId: 't1', userId: 'u', providerId: 'p', artistId: 'a1', releaseId: null, phonogramIds: [] });
    await svc.enqueueDistributorStatusCheck({ tenantId: 't1', userId: 'u', providerId: 'p', submissionId: 's', entityType: null, entityId: null });
    await svc.enqueueSocietySubmit({ tenantId: 't1', userId: 'u', providerId: 'p', artistId: null, workIds: [], phonogramIds: [] });
    await svc.enqueueSocietyStatusCheck({ tenantId: 't1', userId: 'u', providerId: 'p', submissionId: 's', entityType: null, entityId: null });

    const exchange = {
      submitDistributor: jest.fn(), checkDistributorStatus: jest.fn(),
      submitSociety: jest.fn(), checkSocietyStatus: jest.fn(),
    };
    const processor = new ExternalDataProcessor(exchange as never, { runInTenantContext: (_c: unknown, w: () => unknown) => w() } as never);
    for (const [name, data] of streaming.add.mock.calls as unknown as Array<[string, Record<string, unknown>]>) {
      await expect(processor.process({ name, id: 'j', data } as never)).resolves.toBeUndefined();
    }
    expect(streaming.add).toHaveBeenCalledTimes(5);
  });
});

describe('ExternalDataProcessor — unknown job fails visibly', () => {
  const processor = new ExternalDataProcessor({} as never, { runInTenantContext: (_c: unknown, w: () => unknown) => w() } as never);

  for (const name of [WORKFLOW_JOB_NAMES.DISTRIBUTION_SYNC, SPOTIFY_JOB_NAMES.ACCOUNT_SYNC, 'qualquer-outro']) {
    it(`'${name}' throws instead of completing without doing any work`, async () => {
      await expect(processor.process({ name, id: 'j', data: { tenantId: 't1' } } as never)).rejects.toThrow(/without a handler/);
    });
  }
});
