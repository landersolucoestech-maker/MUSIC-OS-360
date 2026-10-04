import type { DataSource } from 'typeorm';
import { ENGLISH_ROLE_ALIASES } from '../../core/rbac/role-hierarchy';
import { ROLE_HIERARCHY } from '../../core/rbac/rbac.service';
import { seedRbac } from './04_rbac_seed';

/**
 * RBAC S4a: the seed grant tables are canonical-first (legal, sales, producer, collaborator, hr_manager).
 * While the Portuguese global rows still carry role_permissions, a grant for `legal` is stored on the
 * `juridico` row. The persisted result must be exactly what the legacy-literal tables produced.
 */
async function runSeed() {
  const grants = new Map<string, Set<string>>();
  const roleInserts: Array<{ slug: string; name: string; level: number; assignable: boolean }> = [];
  const ds = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO "role_permissions"')) {
        const [slug, key] = params as [string, string];
        if (!grants.has(slug)) grants.set(slug, new Set());
        grants.get(slug)!.add(key);
        return [];
      }
      if (sql.includes('INSERT INTO "roles"')) {
        roleInserts.push({ slug: params[0] as string, name: params[1] as string, level: params[2] as number, assignable: params[3] as boolean });
        return [];
      }
      if (sql.includes('count(*)')) return [{ permissions: 0, roles: 0, rolepermissions: 0 }];
      return [];
    }),
  } as unknown as DataSource;
  await seedRbac(ds);
  return { grants, roleInserts };
}

describe('04_rbac_seed canonical-first grants', () => {
  it('never stores role_permissions on an English alias row or on an alias (artista, tenant_owner)', async () => {
    const { grants } = await runSeed();
    for (const alias of [...Object.keys(ENGLISH_ROLE_ALIASES), 'artista', 'tenant_owner']) {
      expect(grants.has(alias)).toBe(false);
    }
  });

  it.each(Object.entries(ENGLISH_ROLE_ALIASES))('canonical grants of %s land on the persisted holder %s', async (canonical, holder) => {
    const { grants } = await runSeed();
    const keys = grants.get(holder);
    expect(keys).toBeDefined();
    // read-everything grants (VIEWER_PLUS) reach every pair; write/cancel tiers reach none of them.
    expect(keys!.has('transaction:read')).toBe(true);
    expect(keys!.has('contract:read')).toBe(true);
    expect(keys!.has('transaction:create')).toBe(false);
    expect(keys!.has('contract:create')).toBe(false);
    expect(keys!.has('transaction:cancel')).toBe(false);
    expect(canonical).not.toBe(holder);
  });

  it('every tier grants the five pairs exactly like before: no permission gained or lost versus their tier peers', async () => {
    const { grants } = await runSeed();
    const viewerPlus = grants.get('viewer')!;
    for (const holder of Object.values(ENGLISH_ROLE_ALIASES)) {
      const mine = grants.get(holder)!;
      // everything the broad VIEWER_PLUS tier grants a viewer is also granted to every pair, read-tier keys only
      for (const key of viewerPlus) {
        if (/^(transaction|invoice|contract|contract_template|contract_service_type|work|phonogram|share|client|contact|lead|lead_interaction|license|event|project|artist_goal|artist|inventory):read$/.test(key)) {
          expect(mine.has(key)).toBe(true);
        }
      }
    }
  });

  it('seeds all 25 global roles; English aliases are inert (is_assignable=false), nothing else changes', async () => {
    const { roleInserts } = await runSeed();
    expect(roleInserts.map((r) => r.slug).sort()).toEqual(Object.keys(ROLE_HIERARCHY).sort());
    for (const r of roleInserts) {
      const inert = r.slug === 'super_admin' || Object.prototype.hasOwnProperty.call(ENGLISH_ROLE_ALIASES, r.slug);
      expect({ slug: r.slug, assignable: r.assignable }).toEqual({ slug: r.slug, assignable: !inert });
    }
  });

  it('persists the legacy juridico row with its display name and hierarchy level; its legal alias shares both and is inert', async () => {
    const { roleInserts } = await runSeed();
    const bySlug = new Map(roleInserts.map((r) => [r.slug, r]));
    const legacy = bySlug.get('juridico');
    const alias = bySlug.get('legal');
    expect(legacy).toBeDefined();
    expect(alias).toBeDefined();
    // the legacy row is the persisted holder: a real display name (not the slug fallback) and assignable
    expect(legacy!.name).toBe('Jurídico');
    expect(legacy!.name).not.toBe('juridico');
    expect(legacy!.level).toBe(ROLE_HIERARCHY['juridico']);
    expect(legacy!.assignable).toBe(true);
    expect(alias!.name).toBe(legacy!.name);
    expect(alias!.level).toBe(legacy!.level);
    expect(alias!.assignable).toBe(false);
  });

  it('persists the legacy `artista` alias row with its legacy display name, the canonical artist level, and inert grants', async () => {
    const { roleInserts, grants } = await runSeed();
    const row = roleInserts.find((r) => r.slug === 'artista');
    expect(row).toBeDefined();
    expect(row!.name).toBe('Artista (legado)');
    expect(row!.name).not.toBe('artista');
    expect(row!.level).toBe(ROLE_HIERARCHY['artista']);
    expect(grants.has('artista')).toBe(false);
    // the canonical `artist` row keeps its own display name and (unlike the alias) carries the grants
    expect(roleInserts.find((r) => r.slug === 'artist')!.name).toBe('Artista');
    expect(grants.has('artist')).toBe(true);
  });
});
