import { ExportAuditService } from './export-audit.service';

describe('ExportAuditService', () => {
  it('redacts raw exception text before emitting the failed-export event', () => {
    const emit = jest.fn();
    const svc = new ExportAuditService({ emit } as never);
    svc.record({
      userId: 'u1', tenantId: 't1', entity: 'artists', format: 'xlsx' as never, recordCount: 0, status: 'failed',
      error: 'Error: connect failed for owner@example.com with Bearer abcdefghijklmnopqrstuvwxyz0123456789',
    });
    const payload = emit.mock.calls[0][0].payload;
    expect(payload.status).toBe('failed');
    expect(payload.error).not.toContain('owner@example.com');
    expect(payload.error).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('emits a null error for a successful export', () => {
    const emit = jest.fn();
    new ExportAuditService({ emit } as never).record({ userId: 'u', tenantId: 't', entity: 'e', format: 'xlsx' as never, recordCount: 1, status: 'success' });
    expect(emit.mock.calls[0][0].payload.error).toBeNull();
  });
});
