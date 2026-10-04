import { FunctionalRole } from '@music-os-360/types';
import { ROLE_PERMISSIONS } from './rbac.service';
import { ENGLISH_ROLE_ALIASES, ROLE_HIERARCHY, roleLevel } from './role-hierarchy';

/**
 * The Portuguese role slugs are still persisted in org_members.role / roles.slug (RBAC S4a/S4b not authorized yet).
 * Every one must keep its exact hierarchy level and permission set, and its English alias must resolve to the same
 * level and permissions (a renamed key would silently turn a persisted role into "no role").
 */
const PINNED: Array<[FunctionalRole, FunctionalRole, number, string[]]> = [
  [FunctionalRole.JURIDICO, FunctionalRole.LEGAL, 55, ['contracts:create', 'licensing:update']],
  [FunctionalRole.ARTISTA, FunctionalRole.ARTIST, 30, ['artist:read', 'releases:read']],
  [FunctionalRole.PRODUTOR, FunctionalRole.PRODUCER, 40, ['catalog:update', 'projects:create']],
  [FunctionalRole.COMERCIAL, FunctionalRole.SALES, 45, ['leads:delete', 'crm:update']],
  [FunctionalRole.COLABORADOR, FunctionalRole.COLLABORATOR, 20, ['artist:read', 'catalog:read']],
  [FunctionalRole.RH_MANAGER, FunctionalRole.HR_MANAGER, 55, ['rh:delete', 'artist:read']],
];

describe('legacy Portuguese role slugs keep their level and permissions (persisted data compatibility)', () => {
  it.each(PINNED)('%s: level, permissions and English alias', (legacy, english, level, sample) => {
    expect(roleLevel(legacy)).toBe(level);
    expect(roleLevel(english)).toBe(level);
    for (const permission of sample) expect(ROLE_PERMISSIONS[legacy]).toContain(permission);
    expect(ROLE_PERMISSIONS[legacy]).toBeDefined();
    expect(ROLE_PERMISSIONS[english]).toBeDefined();
    expect(ROLE_PERMISSIONS[english]).toEqual(ROLE_PERMISSIONS[legacy]);
  });

  it('the alias table maps each English slug to its Portuguese slug and nothing else', () => {
    // `artist` is itself the canonical English slug (no alias row); the other five are aliases of a Portuguese slug
    const aliased = PINNED.filter(([legacy]) => legacy !== FunctionalRole.ARTISTA);
    for (const [legacy, english] of aliased) expect(ENGLISH_ROLE_ALIASES[english]).toBe(legacy);
    expect(Object.keys(ENGLISH_ROLE_ALIASES).sort()).toEqual(aliased.map(([, e]) => e as string).sort());
  });

  it('every Portuguese slug is an OWN key of the hierarchy and of the permission map', () => {
    for (const [legacy] of PINNED) {
      expect(Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, legacy)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, legacy)).toBe(true);
      expect(ROLE_PERMISSIONS[legacy].length).toBeGreaterThan(0);
    }
  });
});
