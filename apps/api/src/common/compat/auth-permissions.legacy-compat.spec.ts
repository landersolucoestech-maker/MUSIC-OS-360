// packages/auth is consumed as TS source by jest (ts-jest transpiles it), but a static
// import would pull it into the api tsc program and break rootDir (TS6059). A runtime
// require keeps it out of the tsc program without widening rootDir.
/* eslint-disable @typescript-eslint/no-require-imports */
const { RESOURCES, ROLE_PERMISSIONS } = require('../../../../../packages/auth/src/permissions') as {
  RESOURCES: Record<string, string>;
  ROLE_PERMISSIONS: Record<string, readonly string[]>;
};
const { ROLES } = require('../../../../../packages/auth/src/roles') as { ROLES: Record<string, string> };
import { expandHrPermissionAliases } from '../../core/rbac/rbac.service';

// Legacy `rh` resource key stays accepted (dual-read) next to the canonical `hr` key.
describe('packages/auth permissions legacy RH resource (legacy in, canonical out)', () => {
  it('keeps the legacy key beside the canonical key', () => {
    expect(RESOURCES.RH).toBe('rh');
    expect(RESOURCES.HR).toBe('hr');
  });

  it('the permission matrix grants both spellings for the same action', () => {
    const owner = ROLE_PERMISSIONS[ROLES.OWNER] as string[];
    for (const action of ['read', 'create', 'update', 'delete']) {
      expect(owner).toContain(`rh:${action}`);
      expect(owner).toContain(`hr:${action}`);
    }
  });

  it('a legacy rh grant is read as the canonical hr grant (same action only)', () => {
    const out = expandHrPermissionAliases(['rh:read']);
    expect(out).toEqual(expect.arrayContaining(['rh:read', 'hr:read']));
    expect(out).not.toContain('hr:update');
    expect(expandHrPermissionAliases(['hr:update'])).toContain('rh:update');
  });
});
