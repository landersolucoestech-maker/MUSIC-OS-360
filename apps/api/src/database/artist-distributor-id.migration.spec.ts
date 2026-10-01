import {
  ARTIST_DISTRIBUTOR_BACKFILL,
  BackfillArtistDistributorIdOtherToEnglish20260930000027 as Migration,
  canonicalDistributorColumnForBackfill,
} from './migrations/20260930000027_BackfillArtistDistributorIdOtherToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_DISTRIBUTOR_IDS } from '../modules/artists/artist-legacy-fields';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;

/** Same candidate semantics as the SQL predicate (the transform is the real decision). */
function isCandidate(_table: string, r: Row): boolean {
  const hit = (list: unknown) => Array.isArray(list) && list.some((e) => e?.id === 'outros');
  const nested = (list: unknown) => Array.isArray(list) && list.some((i) => hit(i?.distributors));
  return hit(r['general_distributors']) || nested(r['relationships']) || nested(r['linked_contacts']) || nested(r['team_contacts']);
}

function dataset(): Record<string, Array<Record<string, any>>> {
  return {
    artists: [
      {
        id: ID(1), tenant_id: 't', updated_at: 'U1',
        general_distributors: [{ id: 'outros', email: 'g@x.com', customName: 'outros' }, { id: 'onerpm', email: '' }],
        relationships: [{ type: 'agent', name: 'outros', distributors: [{ id: 'outros', email: '', customName: 'Minha' }] }],
        linked_contacts: [{ contactId: 'c1', distributors: [{ id: 'outros', email: '' }, { id: 'symphonic', email: '' }] }],
        team_contacts: [{ name: 'Eva', category: 'legal', distributors: [{ id: 'outros', email: '' }] }, { name: 'Zed' }],
      },
      { id: ID(2), tenant_id: 't', updated_at: 'U2', general_distributors: [{ id: 'other', email: '' }], relationships: [], linked_contacts: null, team_contacts: [{ distributors: [{ id: 'Outros' }] }] },
      { id: ID(3), tenant_id: 't', updated_at: 'U3', general_distributors: null, relationships: null, linked_contacts: null, team_contacts: null },
      { id: ID(4), tenant_id: 't', updated_at: 'U4', general_distributors: 'outros', relationships: { distributors: [{ id: 'outros' }] }, linked_contacts: ['outros'], team_contacts: [null, 3] },
    ],
  };
}

describe('BackfillArtistDistributorIdOtherToEnglish20260930000027', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its ids equal the application mapping', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(LEGACY_DISTRIBUTOR_IDS).toEqual({ [ARTIST_DISTRIBUTOR_BACKFILL.LEGACY_ID]: ARTIST_DISTRIBUTOR_BACKFILL.CANONICAL_ID });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites only the exact id in the four columns and preserves everything else', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const [a, b, c, d] = tables.artists;
    expect(a.general_distributors).toEqual([{ id: 'other', email: 'g@x.com', customName: 'outros' }, { id: 'onerpm', email: '' }]);
    expect(a.relationships).toEqual([{ type: 'agent', name: 'outros', distributors: [{ id: 'other', email: '', customName: 'Minha' }] }]);
    expect(a.linked_contacts).toEqual([{ contactId: 'c1', distributors: [{ id: 'other', email: '' }, { id: 'symphonic', email: '' }] }]);
    expect(a.team_contacts).toEqual([{ name: 'Eva', category: 'legal', distributors: [{ id: 'other', email: '' }] }, { name: 'Zed' }]);
    expect(b).toEqual(dataset().artists[1]); // canonical and case variants untouched
    expect(c).toEqual(dataset().artists[2]);
    expect(d).toEqual(dataset().artists[3]); // malformed shapes never rewritten
    for (const row of tables.artists) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT|ALTER TABLE "artists"/i);
    expect(db.log.map((l) => l.table_name)).toEqual(['artists']);
  });

  it('is idempotent: a second up() writes nothing', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);
  });

  it('down() restores BEFORE for untouched rows only (a row edited after up() keeps the edit)', async () => {
    const tables = dataset();
    const original = dataset();
    tables.artists.push({ ...JSON.parse(JSON.stringify(original.artists[0])), id: ID(5) });
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    tables.artists[4].general_distributors = [...tables.artists[4].general_distributors, { id: 'added', email: '' }]; // user edit after up()
    await migration.down(runner as never);
    expect(tables.artists[0]).toEqual(original.artists[0]);
    expect(tables.artists[4].general_distributors).toEqual([{ id: 'other', email: 'g@x.com', customName: 'outros' }, { id: 'onerpm', email: '' }, { id: 'added', email: '' }]);
  });

  it('logs carry counts only and the predicate is static SQL over the four columns', async () => {
    const db = makeFakeDb(dataset() as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/g@x\.com|Minha|Eva/);
    for (const column of ['general_distributors', 'relationships', 'linked_contacts', 'team_contacts']) {
      expect(ARTIST_DISTRIBUTOR_BACKFILL.SPEC.candidatePredicate).toContain(`"${column}"`);
    }
  });

  it('canonicalDistributorColumnForBackfill returns null on canonical or malformed values', () => {
    expect(canonicalDistributorColumnForBackfill('general_distributors', [{ id: 'other' }])).toBeNull();
    expect(canonicalDistributorColumnForBackfill('general_distributors', null)).toBeNull();
    expect(canonicalDistributorColumnForBackfill('team_contacts', [{ distributors: 'outros' }])).toBeNull();
    expect(canonicalDistributorColumnForBackfill('team_contacts', { distributors: [{ id: 'outros' }] })).toBeNull();
  });
});
