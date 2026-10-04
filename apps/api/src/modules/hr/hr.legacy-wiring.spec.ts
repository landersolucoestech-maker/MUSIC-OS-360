import { HrService } from './hr.service';
import { EMPLOYEE_DEPRECATED_FIELDS } from './hr-legacy-fields';

/** Deploy-skew wiring: updateEmployee must persist a legacy-named field under its canonical column. */
describe('HrService.updateEmployee legacy field wiring', () => {
  function make() {
    const qb: Record<string, jest.Mock> = {};
    qb['where'] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ id: 'e1', tenant_id: 'tenant-1' }));
    const repo = {
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => qb),
    };
    const enc = {
      encryptNullable: jest.fn((v: unknown) => v),
      decryptNullable: jest.fn((v: unknown) => v),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    return { service: new HrService(ds as never, enc as never), repo };
  }

  const LEGACY_TITLE = 'cargo';

  it('the alias table maps the legacy job-title key to job_title', () => {
    expect(EMPLOYEE_DEPRECATED_FIELDS[LEGACY_TITLE]).toBe('job_title');
  });

  it('legacy key alone is persisted in the canonical column; legacy key dropped', async () => {
    const { service, repo } = make();
    await service.updateEmployee('tenant-1', 'user-1', 'e1', { [LEGACY_TITLE]: 'Producer' } as never);
    const patch = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch['job_title']).toBe('Producer');
    expect(patch).not.toHaveProperty(LEGACY_TITLE);
  });

  it('canonical wins over legacy', async () => {
    const { service, repo } = make();
    await service.updateEmployee('tenant-1', 'user-1', 'e1', { job_title: 'Canon', [LEGACY_TITLE]: 'Legacy' } as never);
    expect(((repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>)['job_title']).toBe('Canon');
  });
});
