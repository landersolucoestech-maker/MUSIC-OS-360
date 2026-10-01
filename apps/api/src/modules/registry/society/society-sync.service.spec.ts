import { SocietySyncJobStatus } from '@music-os-360/types';
import { SocietySyncService } from './society-sync.service';

describe('SocietySyncService.finish (R3-11 persisted error text)', () => {
  it('redacts secrets/PII and caps the persisted error_message', async () => {
    const save = jest.fn(async (j: unknown) => j);
    const repo = { save, create: (x: unknown) => ({ ...(x as object) }) };
    const ds = { getRepository: () => repo } as never;
    const svc = new SocietySyncService(ds, {} as never);
    const job = { metadata: {} } as never;
    const raw = `boom for a@b.com password=hunter2 ${'z'.repeat(2000)}`;
    const out = (await (svc as unknown as {
      finish: (j: unknown, s: unknown, e: string | null, m: object) => Promise<{ error_message: string }>;
    }).finish(job, SocietySyncJobStatus.FAILED, raw, {}));
    expect(out.error_message).not.toContain('a@b.com');
    expect(out.error_message).not.toContain('hunter2');
    expect(out.error_message.length).toBeLessThanOrEqual(500);
  });

  it('keeps a null error as null', async () => {
    const repo = { save: async (j: unknown) => j };
    const svc = new SocietySyncService({ getRepository: () => repo } as never, {} as never);
    const out = await (svc as unknown as {
      finish: (j: unknown, s: unknown, e: null, m: object) => Promise<{ error_message: null }>;
    }).finish({ metadata: {} }, SocietySyncJobStatus.SUCCESS, null, {});
    expect(out.error_message).toBeNull();
  });
});
