import { RbacService, ROLE_HIERARCHY } from './rbac.service';
import type { PermissionResolverService } from './permission-resolver.service';

function makeService(): RbacService {
  return new RbacService({} as unknown as PermissionResolverService);
}

describe('RbacService.hasRole', () => {
  const service = makeService();
  const slugs = Object.keys(ROLE_HIERARCHY);

  // S0 characterization: known-role behavior, must be identical before and after S1 hardening.
  it.each(slugs.flatMap((user) => slugs.map((required) => [user, required] as const)))(
    'known roles: %s vs required %s follows the hierarchy level comparison',
    (user, required) => {
      expect(service.hasRole(user, required)).toBe(ROLE_HIERARCHY[user] >= ROLE_HIERARCHY[required]);
    },
  );

  it('unknown user role is denied for every known required role', () => {
    for (const required of slugs) {
      expect(service.hasRole('not_a_role', required)).toBe(false);
    }
  });

  // S1 fail-open hardening: these fail on the base (unknown required role was treated as level 0).
  it('denies an unknown required role for every known user role, including super_admin', () => {
    for (const user of slugs) {
      expect({ user, allowed: service.hasRole(user, 'not_a_role') }).toEqual({ user, allowed: false });
    }
  });

  it('denies when both the user role and the required role are unknown', () => {
    expect(service.hasRole('not_a_role', 'also_not_a_role')).toBe(false);
  });

  it('denies an empty required role string', () => {
    expect(service.hasRole('super_admin', '')).toBe(false);
  });

  it('does not resolve inherited object keys as roles (prototype keys)', () => {
    expect(service.hasRole('super_admin', 'constructor')).toBe(false);
    expect(service.hasRole('constructor', 'viewer')).toBe(false);
  });
});
