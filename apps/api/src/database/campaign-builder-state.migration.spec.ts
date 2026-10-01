import {
  BackfillCampaignBuilderStateToEnglish20260930000028 as Migration,
  CAMPAIGN_BUILDER_BACKFILL_MAPS,
  CAMPAIGN_BUILDER_LEGACY_TOKENS,
  canonicalCampaignBuilderMetadataForBackfill,
} from './migrations/20260930000028_BackfillCampaignBuilderStateToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  LEGACY_AUDIENCE_GENDERS,
  LEGACY_BUDGET_STRATEGIES,
  LEGACY_CAMPAIGN_PHASES,
  LEGACY_CREATIVE_TYPES,
} from '../modules/marketing/marketing-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) =>
  r['type'] === 'marketing_builder' &&
  CAMPAIGN_BUILDER_LEGACY_TOKENS.some((t) => JSON.stringify((r['metadata'] as any)?.marketingBuilder?.payload ?? {}).includes(t));

const legacyNotes = JSON.stringify({ phase: 'pre_lancamento', description: 'texto livre', creatives: [{ id: 'c1', type: 'carrossel', name: 'imagem' }, { id: 'c2', type: 'video' }], budget: { strategy: 'custo_alvo', currency: 'BRL' } });

function dataset(): Record<string, Array<Record<string, any>>> {
  return {
    campaigns: [
      { id: ID(1), tenant_id: 't', type: 'marketing_builder', updated_at: 'U1', metadata: { marketingBuilder: { payload: { name: 'Lancamento', notes: legacyNotes, audience: { gender: 'nao_binario', ageMin: 18 }, segmentation: JSON.stringify({ gender: 'feminino', interests: 'texto' }) } } } },
      { id: ID(2), tenant_id: 't', type: 'marketing_builder', updated_at: 'U2', metadata: { marketingBuilder: { payload: { notes: JSON.stringify({ phase: 'launch', budget: { strategy: 'lowest_cost' } }) } } } },
      { id: ID(3), tenant_id: 't', type: 'marketing_builder', updated_at: 'U3', metadata: { marketingBuilder: { payload: { notes: 'lancamento em maio' } } } }, // free text typed by a user
      { id: ID(4), tenant_id: 't', type: 'other', updated_at: 'U4', metadata: { marketingBuilder: { payload: { notes: legacyNotes } } } },
      { id: ID(5), tenant_id: 't', type: 'marketing_builder', updated_at: 'U5', metadata: { marketingBuilder: { payload: { creatives: [{ type: 'imagem' }, { type: 'AUDIO' }] } } } },
    ],
  };
}

describe('BackfillCampaignBuilderStateToEnglish20260930000028', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its frozen maps equal the application maps', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(CAMPAIGN_BUILDER_BACKFILL_MAPS).toEqual({
      PHASE: LEGACY_CAMPAIGN_PHASES,
      CREATIVE_TYPE: LEGACY_CREATIVE_TYPES,
      STRATEGY: LEGACY_BUDGET_STRATEGIES,
      GENDER: LEGACY_AUDIENCE_GENDERS,
    });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites phase / creative type / strategy / gender inside the notes JSON and keeps every other key and free text', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);

    const p1 = tables.campaigns[0].metadata.marketingBuilder.payload;
    expect(JSON.parse(p1.notes)).toEqual({ phase: 'pre_launch', description: 'texto livre', creatives: [{ id: 'c1', type: 'carousel', name: 'imagem' }, { id: 'c2', type: 'video' }], budget: { strategy: 'target_cost', currency: 'BRL' } });
    expect(p1.name).toBe('Lancamento');
    expect(p1.audience).toEqual({ gender: 'non_binary', ageMin: 18 });
    expect(JSON.parse(p1.segmentation)).toEqual({ gender: 'female', interests: 'texto' });
    expect(tables.campaigns[1].metadata.marketingBuilder.payload.notes).toBe(JSON.stringify({ phase: 'launch', budget: { strategy: 'lowest_cost' } }));
    expect(tables.campaigns[2].metadata.marketingBuilder.payload.notes).toBe('lancamento em maio');
    expect(tables.campaigns[3].metadata.marketingBuilder.payload.notes).toBe(legacyNotes); // not a marketing_builder row
    expect(tables.campaigns[4].metadata.marketingBuilder.payload.creatives).toEqual([{ type: 'image' }, { type: 'AUDIO' }]);

    for (const row of tables.campaigns) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(5)]);
  });

  it('is idempotent and down() restores untouched rows only', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);

    tables.campaigns[4].metadata = { marketingBuilder: { payload: { creatives: [{ type: 'image' }], edited: true } } };
    await migration.down(runner as never);
    expect(tables.campaigns[0]).toEqual(original.campaigns[0]);
    expect(tables.campaigns[4].metadata.marketingBuilder.payload.edited).toBe(true); // edited since: never reverted
  });

  it('logs carry counts only', async () => {
    const db = makeFakeDb(dataset() as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/pre_lancamento|carrossel|custo_alvo|texto livre/);
  });

  it('returns null for non-object metadata and canonical rows', () => {
    expect(canonicalCampaignBuilderMetadataForBackfill(null)).toBeNull();
    expect(canonicalCampaignBuilderMetadataForBackfill({ marketingBuilder: 'x' })).toBeNull();
    expect(canonicalCampaignBuilderMetadataForBackfill({ marketingBuilder: { payload: { notes: '{not json' } } })).toBeNull();
  });
});
