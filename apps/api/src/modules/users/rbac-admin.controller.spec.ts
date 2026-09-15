import { RbacAdminController } from './rbac-admin.controller';
import type { RbacAdminService } from './rbac-admin.service';

describe('RbacAdminController — authorityMode (CODEBASE_MAP Gotcha #17)', () => {
  const ORIGINAL = process.env['RBAC_PERSISTED_AUTHORITY'];
  const controller = new RbacAdminController({} as RbacAdminService);

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env['RBAC_PERSISTED_AUTHORITY'];
    else process.env['RBAC_PERSISTED_AUTHORITY'] = ORIGINAL;
  });

  it('reports SHADOW/not-enforced when unset (dev default)', () => {
    delete process.env['RBAC_PERSISTED_AUTHORITY'];
    expect(controller.authorityMode()).toEqual({ mode: 'SHADOW', enforced: false });
  });

  it('reports ON/enforced (matches .env.production and .env.staging)', () => {
    process.env['RBAC_PERSISTED_AUTHORITY'] = 'ON';
    expect(controller.authorityMode()).toEqual({ mode: 'ON', enforced: true });
  });
});
