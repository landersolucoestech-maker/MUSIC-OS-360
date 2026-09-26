import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Mandatory permission key pattern: resource:action (lowercase, snake). */
const PERMISSION_KEY_FORMAT = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

/**
 * @RequirePermission('artist:read', 'artist:export')
 *
 * Requires the member to hold ALL the given permissions (AND semantics).
 * Coexists with @RequireRole: a route can have both (requires hierarchy AND permission).
 * Real enforcement depends on RBAC_PERSISTED_AUTHORITY (see PermissionsGuard).
 *
 * The keys are validated against the `resource:action` format at decoration time (boot),
 * to fail early on a typo.
 */
export const RequirePermission = (...permissions: string[]) => {
  for (const permission of permissions) {
    if (!PERMISSION_KEY_FORMAT.test(permission)) {
      throw new Error(
        `@RequirePermission: invalid key "${permission}" — use the resource:action pattern (e.g. artist:read).`,
      );
    }
  }
  return SetMetadata(PERMISSIONS_KEY, permissions);
};
