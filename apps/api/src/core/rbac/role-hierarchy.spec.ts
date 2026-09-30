import { readFileSync } from 'fs';
import { join } from 'path';
import { ROLE_HIERARCHY } from './role-hierarchy';
import { ROLE_HIERARCHY as ROLE_HIERARCHY_VIA_SERVICE } from './rbac.service';

/**
 * CHARACTERIZATION (RBAC slice S0): pins the CURRENT role slug -> level mapping and its parity
 * with the persisted catalog (seed + migration). Slugs (including Portuguese ones) are persisted
 * values in roles.slug / org_members.role; renaming them requires the L5 expand-contract migration.
 */
const EXPECTED_LEVELS: Record<string, number> = {
  super_admin: 100,
  tenant_owner: 90,
  owner: 90,
  admin: 80,
  manager: 70,
  editor: 60,
  financial: 60,
  accounting: 60,
  juridico: 55,
  marketing_manager: 55,
  rh_manager: 55,
  marketing: 50,
  comercial: 45,
  produtor: 40,
  radio: 40,
  tv: 40,
  artist: 30,
  artista: 30,
  colaborador: 20,
  viewer: 10,
};

const SEED_SOURCE = readFileSync(join(__dirname, '../../database/seeds/04_rbac_seed.ts'), 'utf8');
const MIGRATION_SOURCE = readFileSync(
  join(__dirname, '../../database/migrations/20260610000002_CreateRolesAndRolePermissions.ts'),
  'utf8',
);

function objectKeys(source: string, constName: string): string[] {
  const block = new RegExp(`const ${constName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!block) throw new Error(`const ${constName} not found in seed source`);
  return [...block[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1]);
}

function objectEntries(source: string, constName: string): Record<string, string> {
  const block = new RegExp(`const ${constName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!block) throw new Error(`const ${constName} not found in seed source`);
  return Object.fromEntries([...block[1].matchAll(/^\s*([a-z_]+)\s*:\s*'([a-z_]+)'/gm)].map((m) => [m[1], m[2]]));
}

describe('ROLE_HIERARCHY characterization', () => {
  it('is re-exported unchanged through rbac.service (single object)', () => {
    expect(ROLE_HIERARCHY_VIA_SERVICE).toBe(ROLE_HIERARCHY);
  });

  it('has exactly the 20 known slugs with the pinned level for each', () => {
    expect({ ...ROLE_HIERARCHY }).toEqual(EXPECTED_LEVELS);
  });

  it.each(Object.entries(EXPECTED_LEVELS))('role %s has level %i', (role, level) => {
    expect(ROLE_HIERARCHY[role]).toBe(level);
  });

  it('keeps the strict ordering the guard relies on', () => {
    const l = ROLE_HIERARCHY;
    expect(l['super_admin']).toBeGreaterThan(l['owner']);
    expect(l['owner']).toBeGreaterThan(l['admin']);
    expect(l['admin']).toBeGreaterThan(l['manager']);
    expect(l['manager']).toBeGreaterThan(l['editor']);
    expect(l['editor']).toBeGreaterThan(l['viewer']);
    expect(l['financial']).toBeGreaterThanOrEqual(l['editor']);
  });
});

describe('role catalog parity (seed / migration <-> ROLE_HIERARCHY)', () => {
  const hierarchySlugs = Object.keys(ROLE_HIERARCHY).sort();

  it('every seed ROLE_NAMES slug is in ROLE_HIERARCHY and vice versa', () => {
    expect(objectKeys(SEED_SOURCE, 'ROLE_NAMES').sort()).toEqual(hierarchySlugs);
  });

  it('every slug of the roles migration seed is in ROLE_HIERARCHY with the same level, and vice versa', () => {
    const rows = [...MIGRATION_SOURCE.matchAll(/\(NULL::uuid,\s*'([a-z_]+)',\s*'[^']*',\s*(\d+),/g)];
    const bySlug = Object.fromEntries(rows.map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(bySlug).sort()).toEqual(hierarchySlugs);
    expect(bySlug).toEqual({ ...ROLE_HIERARCHY });
  });

  it('seed ALIASES are exactly artista->artist and tenant_owner->owner', () => {
    expect(objectEntries(SEED_SOURCE, 'ALIASES')).toEqual({ artista: 'artist', tenant_owner: 'owner' });
  });

  it('every alias resolves to the same level as its canonical role', () => {
    for (const [alias, canonical] of Object.entries(objectEntries(SEED_SOURCE, 'ALIASES'))) {
      expect(ROLE_HIERARCHY[alias]).toBeDefined();
      expect(ROLE_HIERARCHY[alias]).toBe(ROLE_HIERARCHY[canonical]);
    }
  });
});
