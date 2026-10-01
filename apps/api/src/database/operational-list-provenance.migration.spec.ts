import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LeadStatus } from '@music-os-360/types';
import {
  ClassifyOperationalListPlatformDefaultsToEnglish20260930000016 as Migration,
  buildMatchVariants,
  buildRenames,
} from './migrations/20260930000016_ClassifyOperationalListPlatformDefaultsToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { OPERATIONAL_LIST_DEFAULTS } from '../modules/operational-lists/operational-lists.defaults';
import {
  LEGACY_OPERATIONAL_NAMES,
  LEGACY_OPERATIONAL_SLUGS,
  canonicalOperationalSlug,
  legacyOperationalSlugs,
  operationalStableKey,
} from '../modules/operational-lists/operational-list-vocabulary';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; conflicts?: Array<{ value: string; affected: number }>; changed?: Array<Record<string, unknown>>; edited?: string[]; other?: string[] } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('FROM matched WHERE conflict')) return opts.conflicts ?? [];
    if (sql.includes('updated AS (') && sql.includes('FROM matched x')) return opts.changed ?? [{ value: 'lead_status:novo_lead', renamed: true, affected: 2 }];
    if (sql.includes('platform_slug_edited')) return [{ platform_slug_edited: 1, other: 4 }];
    if (sql.includes('SELECT DISTINCT') && sql.includes('k.kind IS NOT NULL')) return (opts.edited ?? []).map((value) => ({ value }));
    if (sql.includes('SELECT DISTINCT') && sql.includes('k.kind IS NULL')) return (opts.other ?? []).map((value) => ({ value }));
    if (sql.includes('FROM restorable WHERE conflict')) return opts.conflicts ?? [];
    if (sql.includes('FROM updated GROUP BY kind, canonical_slug')) return [{ value: 'lead_status:new', affected: 2 }];
    return [];
  });
  return { query, calls };
}

describe('ClassifyOperationalListPlatformDefaultsToEnglish20260930000016', () => {
  const migration = new Migration();
  let log: jest.SpyInstance;

  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() sets lock_timeout, adds only nullable columns, a guarded CHECK and partial unique indexes', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const ddl = calls.filter((c) => /ALTER TABLE|CREATE UNIQUE INDEX/.test(c.sql)).map((c) => c.sql).join('\n');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS "origin" VARCHAR(10)');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS "stable_key" VARCHAR(150)');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS "legacy_slug" VARCHAR(100)');
    expect(calls.find((c) => c.sql.includes('ADD COLUMN'))!.sql).not.toMatch(/NOT NULL|DEFAULT/);
    expect(ddl).toContain(`CHECK ("origin" IS NULL OR "origin" IN ('platform', 'tenant'))`);
    expect(ddl).toContain('WHERE "stable_key" IS NOT NULL AND "deleted_at" IS NULL');
    expect(ddl).toContain('WHERE "legacy_slug" IS NOT NULL AND "deleted_at" IS NULL');
    for (const c of calls) expect(c.sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
  });

  it('classifies by exact (kind, slug, name) match with bound parameters, skipping per-tenant conflicts, updated_at untouched', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const update = calls.find((c) => c.sql.includes('UPDATE "operational_list_items"'))!;
    const variants = buildMatchVariants();
    expect(update.params).toEqual([
      variants.map((v) => v.kind),
      variants.map((v) => v.matchSlug),
      variants.map((v) => v.matchName),
      variants.map((v) => v.canonicalSlug),
      variants.map((v) => v.stableKey),
    ]);
    expect(update.sql).toContain('i."slug" = m.match_slug AND i."name" = m.match_name');
    expect(update.sql).toContain('WHERE i."origin" IS NULL');
    expect(update.sql).toContain('NOT x.conflict');
    expect(update.sql).toContain('o."deleted_at" IS NULL');
    expect(update.sql).not.toMatch(/lower\(|btrim|trim\(/i);
    expect(update.sql).not.toContain('updated_at');
    expect(update.sql).toContain(`"origin" = 'platform'`);
    // the tenant is part of the conflict probe: never cross-tenant
    expect(update.sql).toContain('o."tenant_id" = i."tenant_id"');
    const order = (needle: string) => calls.findIndex((c) => c.sql.includes(needle));
    expect(order('FROM matched WHERE conflict')).toBeLessThan(order('UPDATE "operational_list_items"'));
    expect(order('UPDATE "operational_list_items"')).toBeLessThan(order('platform_slug_edited'));
  });

  it('reports conflicts and unclassified rows in bounded form and never aborts', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `v${i}:${'x'.repeat(100)}`);
    const { query, calls } = runner({ conflicts: many.map((value) => ({ value, affected: 1 })), edited: many, other: many });
    await expect(migration.up({ query } as never)).resolves.toBeUndefined();
    expect(calls.filter((c) => c.sql.includes('LIMIT 21'))).toHaveLength(3);
    for (const needle of ['FROM matched WHERE conflict', 'SELECT DISTINCT']) {
      for (const c of calls.filter((x) => x.sql.includes(needle))) expect(c.sql).toContain('LIMIT 21');
    }
    const messages = log.mock.calls.map((c) => String(c[0]));
    expect(messages).toHaveLength(4);
    for (const message of messages.filter((m) => m.includes('more not shown'))) {
      expect(message).not.toContain('x'.repeat(41));
      expect(message.match(/v\d+:/g)).toHaveLength(20);
    }
    expect(messages.filter((m) => m.includes('more not shown'))).toHaveLength(3);
  });

  it('never leaks tenant data beyond kind:slug (no name/description in the report queries)', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    for (const c of calls.filter((x) => x.sql.includes('LIMIT 21'))) {
      expect(c.sql).not.toMatch(/"name"\s+AS|"description"|metadata/);
    }
  });

  it('down() restores only platform rows holding the canonical slug, skips taken legacy slugs, keeps the columns', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const restore = calls.find((c) => c.sql.includes('SET "slug" = r.legacy_slug'))!;
    const renames = buildRenames();
    expect(restore.params).toEqual([renames.map((r) => r.kind), renames.map((r) => r.stableKey), renames.map((r) => r.canonicalSlug), renames.map((r) => r.legacySlug)]);
    expect(restore.sql).toContain(`i."origin" = 'platform'`);
    expect(restore.sql).toContain('NOT r.conflict');
    expect(restore.sql).toContain('"legacy_slug" = NULL');
    expect(restore.sql).not.toContain('updated_at');
    for (const c of calls) expect(c.sql).not.toMatch(/\b(DROP|DELETE|ALTER TABLE)\b/i);
  });
});

describe('operational list platform vocabulary (code constants <-> migration lists)', () => {
  const defaultsByKind = (kind: string) => OPERATIONAL_LIST_DEFAULTS.filter((d) => d.kind === kind);

  it('every legacy map entry targets an existing default of its kind, and legacy slugs are never canonical', () => {
    for (const [kind, map] of Object.entries(LEGACY_OPERATIONAL_SLUGS)) {
      const canonical = defaultsByKind(kind).map((d) => d.slug);
      expect(canonical.length).toBeGreaterThan(0);
      for (const [legacy, target] of Object.entries(map)) {
        expect(canonical).toContain(target);
        expect(canonical).not.toContain(legacy);
        expect(legacy).not.toBe(target);
      }
      // injective: no two legacy slugs share a canonical slug
      expect(new Set(Object.values(map)).size).toBe(Object.values(map).length);
    }
  });

  it('migration variants are set-equal to the defaults (canonical form) plus the legacy map (legacy form)', () => {
    const variants = buildMatchVariants();
    const canonicalForm = variants.filter((v) => v.matchSlug === v.canonicalSlug).map((v) => `${v.kind}|${v.matchSlug}|${v.matchName}`).sort();
    expect(canonicalForm).toEqual(OPERATIONAL_LIST_DEFAULTS.map((d) => `${d.kind}|${d.slug}|${d.name}`).sort());
    const legacyForm = variants.filter((v) => v.matchSlug !== v.canonicalSlug).map((v) => `${v.kind}|${v.matchSlug}|${v.canonicalSlug}`).sort();
    const fromMap = Object.entries(LEGACY_OPERATIONAL_SLUGS).flatMap(([kind, map]) => Object.entries(map).map(([legacy, target]) => `${kind}|${legacy}|${target}`)).sort();
    expect(legacyForm).toEqual(fromMap);
    expect(buildRenames()).toHaveLength(fromMap.length);
    expect(new Set(variants.map((v) => `${v.kind}|${v.matchSlug}`)).size).toBe(variants.length);
  });

  it('legacy names only override existing defaults', () => {
    for (const [kind, names] of Object.entries(LEGACY_OPERATIONAL_NAMES)) {
      for (const slug of Object.keys(names)) expect(defaultsByKind(kind).map((d) => d.slug)).toContain(slug);
    }
    const newLead = buildMatchVariants().find((v) => v.kind === 'lead_status' && v.matchSlug === 'novo_lead');
    expect(newLead).toMatchObject({ matchName: 'Novo lead', canonicalSlug: 'new', stableKey: 'lead_status.new' });
  });

  it('stable keys are unique, English and <kind>.<slug lower-case> (AP3: the marketing kinds are renamed like the others)', () => {
    const keys = OPERATIONAL_LIST_DEFAULTS.map((d) => operationalStableKey(d.kind, d.slug));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z_]+\.[a-z0-9_]+$/);
    for (const kind of ['marketing_context', 'marketing_sector', 'marketing_task_type', 'briefing_service_type']) {
      expect(Object.values(LEGACY_OPERATIONAL_SLUGS[kind]).length).toBeGreaterThan(0);
      for (const d of defaultsByKind(kind)) expect(d.slug).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    expect(operationalStableKey('contact_category', 'PARTNER')).toBe('contact_category.partner');
    expect(operationalStableKey('marketing_sector', 'communication')).toBe('marketing_sector.communication');
    expect(operationalStableKey('marketing_context', 'music_project')).toBe('marketing_context.music_project');
  });

  it('canonical slugs of renamed kinds are English machine values (no Portuguese residue)', () => {
    for (const kind of Object.keys(LEGACY_OPERATIONAL_SLUGS)) {
      for (const d of defaultsByKind(kind)) expect(d.slug).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    const all = Object.values(LEGACY_OPERATIONAL_SLUGS).flatMap((map) => Object.keys(map));
    for (const d of OPERATIONAL_LIST_DEFAULTS) expect(all.includes(d.slug) && LEGACY_OPERATIONAL_SLUGS[d.kind]?.[d.slug] !== undefined).toBe(false);
  });

  it('canonicalOperationalSlug / legacyOperationalSlugs: legacy mapped, canonical and tenant slugs unchanged', () => {
    expect(canonicalOperationalSlug('lead_type', 'artista_banda')).toBe('artist_or_band');
    expect(canonicalOperationalSlug('lead_type', 'artist_or_band')).toBe('artist_or_band');
    expect(canonicalOperationalSlug('lead_type', 'my-custom-slug')).toBe('my-custom-slug');
    expect(canonicalOperationalSlug('lead_status', 'artista_banda')).toBe('artista_banda');
    expect(canonicalOperationalSlug('marketing_sector', 'Design')).toBe('design');
    expect(canonicalOperationalSlug('marketing_sector', 'Comunicação')).toBe('communication');
    expect(canonicalOperationalSlug('marketing_context', 'projeto_musical')).toBe('music_project');
    expect(legacyOperationalSlugs('service_interest', 'other')).toEqual(['outro']);
    expect(legacyOperationalSlugs('event_type', 'shows')).toEqual([]);
  });

  it('lead_type allowed_service_slugs only reference existing service_interest defaults', () => {
    const services = defaultsByKind('service_interest').map((d) => d.slug);
    for (const d of defaultsByKind('lead_type')) {
      const allowed = ((d.metadata ?? {}) as { allowed_service_slugs?: string[] }).allowed_service_slugs ?? [];
      for (const slug of allowed) expect(services).toContain(slug);
    }
  });

  describe('runtime path of lead_status', () => {
    it('leads.status only accepts the LeadStatus enum: the seeded lead_status slugs are exactly that set', () => {
      expect(defaultsByKind('lead_status').map((d) => d.slug).sort()).toEqual(Object.values(LeadStatus).sort());
    });

    it('every pre-OL1 API lead_status slug maps to a LeadStatus value (none is lost or invented)', () => {
      const allowed = new Set<string>(Object.values(LeadStatus));
      for (const target of Object.values(LEGACY_OPERATIONAL_SLUGS['lead_status'])) expect(allowed.has(target)).toBe(true);
      expect(Object.keys(LEGACY_OPERATIONAL_SLUGS['lead_status']).sort()).toEqual(
        ['em_contato', 'fechado', 'novo_lead', 'perdido', 'proposta_enviada', 'qualificado'],
      );
    });

    it('the lead DTO status whitelist is the same enum', () => {
      const dto = readFileSync(resolve(__dirname, '../modules/leads/dto/leads.dto.ts'), 'utf8');
      expect(dto).toMatch(/STATUSES = Object\.values\(LeadStatus\)/);
      expect(dto).toMatch(/@IsIn\(STATUSES\) status/);
    });
  });

  describe('web legacy reader (settings/lib/operational-vocabulary.ts) mirrors the API maps', () => {
    const web = readFileSync(resolve(__dirname, '../../../web/src/modules/settings/lib/operational-vocabulary.ts'), 'utf8');
    const block = web.slice(web.indexOf('export const LEGACY_OPERATIONAL_SLUGS'), web.indexOf('export const LEGACY_OPERATIONAL_NAMES'));
    const parsed: Record<string, Record<string, string>> = {};
    for (const m of block.matchAll(/^ {2}(\w+): \{ (.*) \},$/gm)) {
      parsed[m[1]] = Object.fromEntries([...m[2].matchAll(/"?([^":,\s]+)"?: "([^"]+)"/g)].map((p) => [p[1], p[2]]));
    }

    it('slug maps are identical', () => {
      expect(parsed).toEqual(LEGACY_OPERATIONAL_SLUGS);
    });

    it('legacy names are identical', () => {
      const names = web.slice(web.indexOf('export const LEGACY_OPERATIONAL_NAMES'));
      const m = names.match(/lead_status: \{ new: "([^"]+)", proposal: "([^"]+)" \}/)!;
      expect({ lead_status: { new: m[1], proposal: m[2] } }).toEqual(LEGACY_OPERATIONAL_NAMES);
    });
  });

  describe('web defaults (useOperationalSettings) carry the same (kind, slug, name) triples', () => {
    const web = readFileSync(resolve(__dirname, '../../../web/src/modules/settings/hooks/useOperationalSettings.ts'), 'utf8');
    const triples = [...web.matchAll(/kind: "(\w+)", name: "([^"]+)", slug: "([^"]+)"/g)].map((m) => `${m[1]}|${m[3]}|${m[2]}`).sort();

    it('is set-equal to OPERATIONAL_LIST_DEFAULTS', () => {
      expect(triples).toEqual(OPERATIONAL_LIST_DEFAULTS.map((d) => `${d.kind}|${d.slug}|${d.name}`).sort());
    });
  });
});
