import { readFileSync } from 'fs';
import { join } from 'path';
import { ENGLISH_ROLE_ALIASES, ROLE_HIERARCHY } from './role-hierarchy';
import { ROLE_PERMISSIONS } from './rbac.service';
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
  // English aliases (RBAC expand step): same level as the canonical Portuguese role.
  legal: 55,
  sales: 45,
  producer: 40,
  collaborator: 20,
  hr_manager: 55,
};

const EXPECTED_ENGLISH_ALIASES: Record<string, string> = {
  legal: 'juridico',
  sales: 'comercial',
  producer: 'produtor',
  collaborator: 'colaborador',
  hr_manager: 'rh_manager',
};

const SEED_SOURCE = readFileSync(join(__dirname, '../../database/seeds/04_rbac_seed.ts'), 'utf8');
const MIGRATION_SOURCE = readFileSync(
  join(__dirname, '../../database/migrations/20260610000002_CreateRolesAndRolePermissions.ts'),
  'utf8',
);
const ALIAS_MIGRATION_SOURCE = readFileSync(
  join(__dirname, '../../database/migrations/20260930000001_AddEnglishRoleSlugAliases.ts'),
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

  it('has exactly the 25 known slugs (20 persisted + 5 English aliases) with the pinned level for each', () => {
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

  it('the original roles migration seeds the 20 legacy slugs with the same level as ROLE_HIERARCHY', () => {
    const rows = [...MIGRATION_SOURCE.matchAll(/\(NULL::uuid,\s*'([a-z_]+)',\s*'[^']*',\s*(\d+),/g)];
    const bySlug = Object.fromEntries(rows.map((m) => [m[1], Number(m[2])]));
    const legacy = Object.keys(ROLE_HIERARCHY).filter((slug) => !(slug in EXPECTED_ENGLISH_ALIASES));
    expect(Object.keys(bySlug).sort()).toEqual(legacy.sort());
    for (const slug of legacy) expect(bySlug[slug]).toBe(ROLE_HIERARCHY[slug]);
  });

  it('the English-alias migration pairs are exactly ENGLISH_ROLE_ALIASES (alias -> canonical Portuguese slug)', () => {
    const pairs = [...ALIAS_MIGRATION_SOURCE.matchAll(/\['([a-z_]+)',\s*'([a-z_]+)'\]/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(pairs)).toEqual(EXPECTED_ENGLISH_ALIASES);
    expect(pairs).toHaveLength(Object.keys(EXPECTED_ENGLISH_ALIASES).length);
  });

  it('ENGLISH_ROLE_ALIASES is pinned (alias -> canonical Portuguese slug, never the reverse)', () => {
    expect({ ...ENGLISH_ROLE_ALIASES }).toEqual(EXPECTED_ENGLISH_ALIASES);
  });

  it('seed ALIASES are exactly the legacy pairs plus the spread of ENGLISH_ROLE_ALIASES (single source)', () => {
    const block = /const ALIASES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(SEED_SOURCE);
    expect(block).not.toBeNull();
    expect(block![1]).toContain('...ENGLISH_ROLE_ALIASES');
    expect(objectEntries(SEED_SOURCE, 'ALIASES')).toEqual({ artista: 'artist', tenant_owner: 'owner' });
  });

  it('seed keeps every English alias non-assignable (derived from ENGLISH_ROLE_ALIASES)', () => {
    expect(SEED_SOURCE).toMatch(/NON_ASSIGNABLE = new Set<string>\(\['super_admin', \.\.\.Object\.keys\(ENGLISH_ROLE_ALIASES\)\]\)/);
  });

  it.each(Object.entries(EXPECTED_ENGLISH_ALIASES))(
    'English alias %s grants exactly what %s grants (level and legacy permission matrix)',
    (alias, canonical) => {
      expect(ROLE_HIERARCHY[alias]).toBe(ROLE_HIERARCHY[canonical]);
      expect(ROLE_PERMISSIONS[alias]).toEqual(ROLE_PERMISSIONS[canonical]);
      expect(ROLE_PERMISSIONS[alias].length).toBeGreaterThan(0);
    },
  );

  it('every alias resolves to the same level as its canonical role', () => {
    for (const [alias, canonical] of Object.entries(objectEntries(SEED_SOURCE, 'ALIASES'))) {
      expect(ROLE_HIERARCHY[alias]).toBeDefined();
      expect(ROLE_HIERARCHY[alias]).toBe(ROLE_HIERARCHY[canonical]);
    }
  });
});
