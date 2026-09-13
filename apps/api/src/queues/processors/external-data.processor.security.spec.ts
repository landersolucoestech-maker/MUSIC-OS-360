import { Test } from '@nestjs/testing';
import { ExternalDataProcessor } from './external-data.processor';
import { ExternalDataExchangeService } from '../../core/external-data/external-data-exchange.service';
import { DatabaseContextService } from '../../database/database-context.service';
import { WORKFLOW_JOB_NAMES } from '../queue.constants';

/**
 * find-657093f0: ExternalDataProcessor used to call ExternalDataExchangeService
 * (which persists via tenant-scoped repos: artists/releases/works/phonograms/
 * shares/webhookEvents/submissions) with no tenant DB context bound. This
 * proves every job branch now runs inside runInTenantContext with the job's
 * tenantId before the exchange service touches the database.
 */
describe('ExternalDataProcessor — tenant DB context', () => {
  it('wraps submitDistributor in runInTenantContext with the job tenantId', async () => {
    const exchange = { submitDistributor: jest.fn().mockResolvedValue(undefined) };
    const runInTenantContext = jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined));
    const dbContext = { runInTenantContext };

    const module = await Test.createTestingModule({
      providers: [
        ExternalDataProcessor,
        { provide: ExternalDataExchangeService, useValue: exchange },
        { provide: DatabaseContextService, useValue: dbContext },
      ],
    }).compile();
    const processor = module.get(ExternalDataProcessor);

    await processor.process({
      name: WORKFLOW_JOB_NAMES.DISTRIBUTOR_SUBMIT,
      id: 'job-1',
      data: { tenantId: 'tenant-a', providerId: 'p1', artistId: 'a1' },
    } as any);

    expect(runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', orgId: null, role: null },
      expect.any(Function),
    );
    expect(exchange.submitDistributor).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    );
  });

  it('rejects a job with no tenantId before any DB context is opened (fail-closed)', async () => {
    const exchange = { submitDistributor: jest.fn() };
    const runInTenantContext = jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined));
    const dbContext = { runInTenantContext };

    const module = await Test.createTestingModule({
      providers: [
        ExternalDataProcessor,
        { provide: ExternalDataExchangeService, useValue: exchange },
        { provide: DatabaseContextService, useValue: dbContext },
      ],
    }).compile();
    const processor = module.get(ExternalDataProcessor);

    await expect(processor.process({
      name: WORKFLOW_JOB_NAMES.DISTRIBUTOR_SUBMIT,
      id: 'job-1',
      data: { providerId: 'p1' },
    } as any)).rejects.toThrow('External data job missing tenantId');

    expect(runInTenantContext).not.toHaveBeenCalled();
  });
});
