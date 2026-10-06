import { Test } from '@nestjs/testing';
import { AiJobsProcessor } from './ai-jobs.processor';
import { AiService } from '../../modules/ai/ai.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { DatabaseContextService } from '../../database/database-context.service';

/**
 * find-657093f0: AiJobsProcessor used to call AiService.complete() (which
 * persists to the tenant-scoped ai_jobs table) with no tenant DB context
 * bound, unlike NotificationsProcessor/MarketingPublishingProcessor/etc.
 * This proves the job's tenantId is now threaded through
 * DatabaseContextService.runInTenantContext before AiService runs.
 */
describe('AiJobsProcessor — tenant DB context', () => {
  it('wraps AiService.complete in runInTenantContext with the job tenantId', async () => {
    const ai = { complete: jest.fn().mockResolvedValue({
      content: 'ok', provider: 'openai', model: 'gpt', inputTokens: 1, outputTokens: 1,
    }) };
    const ws = { sendToUser: jest.fn() };
    const runInTenantContext = jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined));
    const dbContext = { runInTenantContext };

    const module = await Test.createTestingModule({
      providers: [
        AiJobsProcessor,
        { provide: AiService, useValue: ai },
        { provide: RealtimeService, useValue: ws },
        { provide: DatabaseContextService, useValue: dbContext },
      ],
    }).compile();
    const processor = module.get(AiJobsProcessor);

    await processor.process({
      name: 'complete',
      id: 'job-1',
      data: { tenantId: 'tenant-a', userId: 'user-1', skill: 'x', prompt: 'p' },
    } as any);

    expect(runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', orgId: null, role: null },
      expect.any(Function),
    );
    expect(ai.complete).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
  });

  // find-2ed4c244: fail-closed on a missing tenantId, matching every sibling processor.
  it('aborts (fail-closed) a job without tenantId, without calling runInTenantContext', async () => {
    const ai = { complete: jest.fn() };
    const ws = { sendToUser: jest.fn() };
    const runInTenantContext = jest.fn();
    const dbContext = { runInTenantContext };

    const module = await Test.createTestingModule({
      providers: [
        AiJobsProcessor,
        { provide: AiService, useValue: ai },
        { provide: RealtimeService, useValue: ws },
        { provide: DatabaseContextService, useValue: dbContext },
      ],
    }).compile();
    const processor = module.get(AiJobsProcessor);

    await processor.process({
      name: 'complete',
      id: 'job-2',
      data: { userId: 'user-1', skill: 'x', prompt: 'p' },
    } as any);

    expect(runInTenantContext).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
  });
});
