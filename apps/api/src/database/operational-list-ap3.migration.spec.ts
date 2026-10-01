import {
  ClassifyMarketingAndContactOperationalListsToEnglish20260930000031 as Migration,
  OPERATIONAL_LIST_AP3_VARIANTS,
  operationalListAp3Rewrite,
} from './migrations/20260930000031_ClassifyMarketingAndContactOperationalListsToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { OPERATIONAL_LIST_DEFAULTS } from '../modules/operational-lists/operational-lists.defaults';
import {
  LEGACY_OPERATIONAL_KINDS,
  LEGACY_OPERATIONAL_SLUGS,
  operationalStableKey,
} from '../modules/operational-lists/operational-list-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const live = (r: Row) => r['deleted_at'] == null;

/** Same candidate semantics as the SQL predicate (the transform is the real decision). */
function isCandidate(db: Record<string, Row[]>) {
  return (_t: string, r: Row) => {
    const v = OPERATIONAL_LIST_AP3_VARIANTS.find((x) => x.kind === r['kind'] && x.slug === r['slug'] && x.name === r['name']);
    if (!v || !(r['origin'] == null || r['origin'] === 'platform')) return false;
    const taken = db['operational_list_items'].some(
      (o) => o['tenant_id'] === r['tenant_id'] && o['id'] !== r['id'] && live(o) && o['kind'] === v.newKind && (o['slug'] === v.newSlug || o['stable_key'] === `${v.newKind}.${v.newSlug.toLowerCase()}`),
    );
    return !taken;
  };
}

const base = { description: '', active: true, order: 0, metadata: {}, legacy_slug: null, origin: null, stable_key: null, deleted_at: null, updated_at: 'U' };
const row = (n: number, tenant: string, kind: string, slug: string, name: string, extra: Row = {}): Row => ({ id: ID(n), tenant_id: tenant, kind, slug, name, ...base, ...extra });

function dataset(): Record<string, Row[]> {
  return {
    operational_list_items: [
      row(1, 'a', 'marketing_context', 'projeto_musical', 'Projeto Musical'),
      row(2, 'a', 'marketing_sector', 'Comunicação', 'Comunicação', { origin: 'platform', stable_key: 'marketing_sector.communication' }), // already classified by OL1
      row(3, 'a', 'briefing_service_type', 'conteudo', 'Conteúdo'),
      row(4, 'a', 'contact_pf_classification', 'VIDEOMAKER', 'Videomaker', { origin: 'platform', stable_key: 'contact_pf_classification.videomaker' }),
      row(5, 'a', 'contact_pj_classification', 'VENUE', 'Casa de Show'),
      row(6, 'a', 'marketing_sector', 'Design', 'Meu design'), // name edited by the tenant
      row(7, 'a', 'marketing_context', 'artista', 'Artista', { origin: 'tenant' }), // tenant-authored
      row(8, 'a', 'marketing_sector', 'Produção', 'Produção'), // tenant content
      row(9, 'b', 'marketing_context', 'empresa', 'Empresa'),
      row(10, 'b', 'marketing_context', 'company', 'Minha empresa'), // canonical slug already used by another live row of the tenant
      row(11, 'a', 'contact_pf_classification', 'MEU', 'Meu tipo'), // tenant content under the legacy kind: untouched
      row(12, 'a', 'marketing_task_type', 'campaign', 'Campanha', { origin: 'platform', stable_key: 'marketing_task_type.campaign' }), // canonical already
    ],
  };
}

describe('ClassifyMarketingAndContactOperationalListsToEnglish20260930000031', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered; its frozen variants equal the API defaults, the legacy slug map and the legacy kind map', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    for (const v of OPERATIONAL_LIST_AP3_VARIANTS) {
      const expectedSlug = LEGACY_OPERATIONAL_SLUGS[v.kind]?.[v.slug] ?? v.slug;
      expect(v.newSlug).toBe(expectedSlug);
      const defaultItem = OPERATIONAL_LIST_DEFAULTS.find((d) => d.kind === v.newKind && d.slug === v.newSlug);
      expect(defaultItem).toBeDefined();
      expect(defaultItem?.name).toBe(v.name);
      expect(v.newKind).toBe(LEGACY_OPERATIONAL_KINDS[v.kind] ?? v.kind);
    }
    // every default of an affected kind is covered
    for (const kind of ['marketing_context', 'marketing_sector', 'marketing_task_type', 'briefing_service_type', ...Object.values(LEGACY_OPERATIONAL_KINDS)]) {
      const covered = OPERATIONAL_LIST_AP3_VARIANTS.filter((v) => v.newKind === kind).map((v) => v.newSlug).sort();
      const defaults = OPERATIONAL_LIST_DEFAULTS.filter((d) => d.kind === kind);
      const renamedOrSame = defaults.filter((d) => LEGACY_OPERATIONAL_SLUGS[kind] ? Object.values(LEGACY_OPERATIONAL_SLUGS[kind]).includes(d.slug) : true).map((d) => d.slug).sort();
      expect(covered).toEqual(renamedOrSame);
    }
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('classifies exact platform defaults only; tenant rows, edited names and conflicting rows stay untouched', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate(tables)) as never);
    const r = (n: number) => tables.operational_list_items.find((x) => x['id'] === ID(n))!;

    expect(r(1)).toMatchObject({ kind: 'marketing_context', slug: 'music_project', legacy_slug: 'projeto_musical', origin: 'platform', stable_key: 'marketing_context.music_project', name: 'Projeto Musical' });
    expect(r(2)).toMatchObject({ slug: 'communication', legacy_slug: 'Comunicação', origin: 'platform', stable_key: 'marketing_sector.communication' });
    expect(r(3)).toMatchObject({ slug: 'content', legacy_slug: 'conteudo', stable_key: 'briefing_service_type.content', origin: 'platform' });
    expect(r(4)).toMatchObject({ kind: 'contact_individual_classification', slug: 'VIDEOMAKER', legacy_slug: null, stable_key: 'contact_individual_classification.videomaker' });
    expect(r(5)).toMatchObject({ kind: 'contact_company_classification', slug: 'VENUE', origin: 'platform', stable_key: 'contact_company_classification.venue' });
    expect(r(6)).toMatchObject({ slug: 'Design', origin: null }); // edited name
    expect(r(7)).toMatchObject({ slug: 'artista', origin: 'tenant' });
    expect(r(8)).toMatchObject({ slug: 'Produção', origin: null });
    expect(r(9)).toMatchObject({ slug: 'empresa', origin: null }); // target slug used by r(10)
    expect(r(10)).toMatchObject({ slug: 'company', name: 'Minha empresa' });
    expect(r(11)).toMatchObject({ kind: 'contact_pf_classification', slug: 'MEU' });
    expect(r(12)).toMatchObject({ slug: 'campaign', origin: 'platform', stable_key: 'marketing_task_type.campaign' });

    for (const x of tables.operational_list_items) {
      expect(x['updated_at']).toBe('U');
      expect(x['metadata']).toEqual({});
    }
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(2), ID(3), ID(4), ID(5)]);
  });

  it('is idempotent and down() restores BEFORE exactly (origin included) for untouched rows only', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate(tables));
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);

    const r = (n: number) => tables.operational_list_items.find((x) => x['id'] === ID(n))!;
    r(3)['slug'] = 'content-edited'; // the tenant changed the slug since up(): never reverted
    await migration.down(runner as never);
    for (const n of [1, 2, 4, 5]) expect(r(n)).toEqual(original.operational_list_items.find((x) => x['id'] === ID(n)));
    expect(r(3)).toMatchObject({ slug: 'content-edited', kind: 'briefing_service_type' });
  });

  it('logs are counts only; rewrite is a pure function (null for canonical / tenant / unknown)', () => {
    expect(operationalListAp3Rewrite(row(1, 'a', 'marketing_context', 'music_project', 'Projeto Musical', { origin: 'platform', stable_key: 'marketing_context.music_project' }))).toBeNull();
    expect(operationalListAp3Rewrite(row(1, 'a', 'marketing_context', 'artista', 'Artista', { origin: 'tenant' }))).toBeNull();
    expect(operationalListAp3Rewrite(row(1, 'a', 'marketing_context', 'artista', 'Artista editada'))).toBeNull();
    expect(operationalListAp3Rewrite(row(1, 'a', 'marketing_context', 'artista', 'Artista'))).toEqual({ slug: 'artist', legacy_slug: 'artista', origin: 'platform', stable_key: 'marketing_context.artist' });
    expect(operationalStableKey('marketing_context', 'artist')).toBe('marketing_context.artist');
  });
});
