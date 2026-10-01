import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { FunctionalRole } from '@music-os-360/types';
import { PermissionResolverService } from './permission-resolver.service';
import { RbacService, ROLE_HIERARCHY, ROLE_PERMISSIONS } from './rbac.service';
import {
  ENGLISH_ROLE_ALIASES,
  LEGACY_TO_CANONICAL_ROLE_SLUG,
  areEquivalentRoleSlugs,
  isEnglishRoleAlias,
  isLegacyRoleSlug,
  roleLevel,
  roleSlugEquivalents,
  toCanonicalRoleSlug,
  toLegacyRoleSlug,
} from './role-hierarchy';

/**
 * RBAC S4a: canonical English role slugs. Legacy -> canonical map, dual-read equivalence at the
 * RbacService and divergence-telemetry level, and prototype-key safety of every slug lookup.
 * Guard-chain and workflow equivalence live in guards/guard-chain.canonical-role.integration.spec.ts and
 * english-role-alias.parity.spec.ts; writer behavior in modules/users/users-canonical-role-write.security.spec.ts.
 */
const PAIRS: ReadonlyArray<readonly [legacy: string, canonical: string]> = [
  ['juridico', 'legal'],
  ['comercial', 'sales'],
  ['produtor', 'producer'],
  ['colaborador', 'collaborator'],
  ['rh_manager', 'hr_manager'],
  ['artista', 'artist'],
];
const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];

describe('legacy -> canonical role slug map (pinned literally)', () => {
  it('maps exactly the six legacy slugs and nothing else', () => {
    expect({ ...LEGACY_TO_CANONICAL_ROLE_SLUG }).toEqual(Object.fromEntries(PAIRS));
  });

  it('is consistent with ENGLISH_ROLE_ALIASES (the five English aliases of the persisted rows)', () => {
    for (const [alias, legacy] of Object.entries(ENGLISH_ROLE_ALIASES)) {
      expect(toCanonicalRoleSlug(legacy)).toBe(alias);
      expect(toLegacyRoleSlug(alias)).toBe(legacy);
    }
    expect(Object.keys(ENGLISH_ROLE_ALIASES)).toHaveLength(5);
  });

  it.each(PAIRS)('%s -> %s (idempotent, reversible, equivalent)', (legacy, canonical) => {
    expect(toCanonicalRoleSlug(legacy)).toBe(canonical);
    expect(toCanonicalRoleSlug(canonical)).toBe(canonical);
    expect(toLegacyRoleSlug(canonical)).toBe(legacy);
    expect(isLegacyRoleSlug(legacy)).toBe(true);
    expect(isLegacyRoleSlug(canonical)).toBe(false);
    expect(roleSlugEquivalents(legacy)).toEqual([canonical, legacy]);
    expect(roleSlugEquivalents(canonical)).toEqual([canonical, legacy]);
    expect(areEquivalentRoleSlugs(legacy, canonical)).toBe(true);
  });

  it.each(['owner', 'tenant_owner', 'admin', 'manager', 'editor', 'viewer', 'financial', 'accounting', 'marketing', 'marketing_manager', 'radio', 'tv', 'super_admin'])(
    'unmapped slug %s is unchanged and has no equivalents (tenant_owner/radio/tv are deliberate non-aliases)',
    (slug) => {
      expect(toCanonicalRoleSlug(slug)).toBe(slug);
      expect(toLegacyRoleSlug(slug)).toBe(slug);
      expect(roleSlugEquivalents(slug)).toEqual([slug]);
    },
  );

  it('never treats different roles as equivalent', () => {
    for (const [legacy] of PAIRS) {
      for (const [, otherCanonical] of PAIRS) {
        if (toCanonicalRoleSlug(legacy) !== otherCanonical) expect(areEquivalentRoleSlugs(legacy, otherCanonical)).toBe(false);
      }
    }
    expect(areEquivalentRoleSlugs('owner', 'tenant_owner')).toBe(false);
    expect(areEquivalentRoleSlugs('juridico', 'comercial')).toBe(false);
  });

  it.each(PROTOTYPE_KEYS)('prototype key %s is not a role, alias or equivalent', (key) => {
    expect(toCanonicalRoleSlug(key)).toBe(key);
    expect(toLegacyRoleSlug(key)).toBe(key);
    expect(isLegacyRoleSlug(key)).toBe(false);
    expect(isEnglishRoleAlias(key)).toBe(false);
    expect(roleSlugEquivalents(key)).toEqual([key]);
    expect(roleLevel(key)).toBeUndefined();
  });

  it('non-string input is passed through untouched (no throw)', () => {
    expect(toCanonicalRoleSlug(undefined as never)).toBeUndefined();
    expect(toCanonicalRoleSlug(null as never)).toBeNull();
    expect(isEnglishRoleAlias(undefined as never)).toBe(false);
    expect(roleLevel(undefined as never)).toBeUndefined();
  });

  it('every canonical and legacy slug is a known role in the hierarchy and the enum', () => {
    const enumValues = new Set<string>(Object.values(FunctionalRole));
    for (const [legacy, canonical] of PAIRS) {
      expect(enumValues.has(legacy)).toBe(true);
      expect(enumValues.has(canonical)).toBe(true);
      expect(ROLE_HIERARCHY[legacy]).toBeDefined();
      expect(ROLE_HIERARCHY[canonical]).toBeDefined();
    }
  });
});

describe('RbacService dual-read: legacy and canonical grant identical authorization', () => {
  const service = new RbacService({} as never);

  it.each(PAIRS)('%s == %s: level, permissions, hasRole over every slug in both directions', (legacy, canonical) => {
    expect(service.getHierarchyLevel(legacy)).toBe(service.getHierarchyLevel(canonical));
    expect(service.getPermissions(legacy)).toEqual(service.getPermissions(canonical));
    expect(service.getPermissions(canonical).length).toBeGreaterThan(0);
    for (const other of Object.keys(ROLE_HIERARCHY)) {
      expect(service.hasRole(legacy, other)).toBe(service.hasRole(canonical, other));
      expect(service.hasRole(other, legacy)).toBe(service.hasRole(other, canonical));
    }
  });

  it.each(PAIRS)('%s/%s are never above manager and cannot reach admin/owner/super_admin', (legacy, canonical) => {
    for (const slug of [legacy, canonical]) {
      expect(service.getHierarchyLevel(slug)).toBeLessThan(ROLE_HIERARCHY.manager);
      for (const higher of ['manager', 'admin', 'owner', 'tenant_owner', 'super_admin']) {
        expect(service.hasRole(slug, higher)).toBe(false);
      }
    }
  });

  it('unknown required roles stay unsatisfiable (fail-closed) and unknown actors get level 0', () => {
    for (const slug of ['legal', 'juridico', 'artist', 'artista']) {
      expect(service.hasRole(slug, 'ghost')).toBe(false);
      expect(service.hasRole('ghost', slug)).toBe(false);
    }
    expect(service.getHierarchyLevel('ghost')).toBe(0);
  });

  it.each(PROTOTYPE_KEYS)('prototype key %s as a role: level 0, no permissions, hasRole false, no throw', (key) => {
    expect(service.getHierarchyLevel(key)).toBe(0);
    expect(service.getPermissions(key)).toEqual([]);
    expect(service.can(key, 'artist' as never, 'read' as never)).toBe(false);
    expect(service.hasRole(key, 'viewer')).toBe(false);
    expect(service.hasRole('owner', key)).toBe(false);
  });

  it('ROLE_PERMISSIONS never shares an array between legacy and canonical', () => {
    for (const [legacy, canonical] of PAIRS) {
      if (ROLE_PERMISSIONS[canonical] === ROLE_PERMISSIONS[legacy]) continue;
      expect(ROLE_PERMISSIONS[canonical]).toEqual(ROLE_PERMISSIONS[legacy]);
    }
  });
});

describe('PermissionResolverService.classifyDivergence: canonical role string on a legacy role row is not divergence', () => {
  function resolverWith(row: { slug: string; canonical_slug: string | null }) {
    const ds = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ ...row, tenant_id: null, archived_at: null, deleted_at: null }]),
    } as unknown as DataSource;
    return new PermissionResolverService(ds);
  }
  const classify = (svc: PermissionResolverService, role: string) =>
    (svc as unknown as { classifyDivergence: (...a: unknown[]) => Promise<string> }).classifyDivergence(
      (svc as unknown as { ds: DataSource }).ds,
      'role-id',
      { role, role_id: 'role-id', tenant_id: 't' },
      't',
    );

  it.each(PAIRS.slice(0, 5))('role string %2$s on the %1$s row -> MATCH (and the legacy string too)', async (legacy, canonical) => {
    const svc = resolverWith({ slug: legacy, canonical_slug: null });
    expect(await classify(svc, canonical)).toBe('MATCH');
    expect(await classify(svc, legacy)).toBe('MATCH');
  });

  it('a genuinely different role string is still DIVERGENTE (telemetry keeps its signal)', async () => {
    const svc = resolverWith({ slug: 'juridico', canonical_slug: null });
    expect(await classify(svc, 'sales')).toBe('DIVERGENTE');
    expect(await classify(svc, 'admin')).toBe('DIVERGENTE');
    expect(await classify(svc, 'comercial')).toBe('DIVERGENTE');
  });
});
