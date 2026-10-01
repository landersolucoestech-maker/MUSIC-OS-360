import { BackfillAssetTypesToEnglish20260930000025 as Migration, canonicalAssetRowForBackfill } from './migrations/20260930000025_BackfillAssetTypesToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_ASSET_TYPES } from '../common/compat/asset-type';
import { fakeRunner, makeFakeDb } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const isLegacy = (v: unknown) => typeof v === 'string' && v in LEGACY_ASSET_TYPES;

function setup(rows: Array<Record<string, unknown>>) {
  const db = makeFakeDb({ assets: rows });
  const runner = fakeRunner(db, (_t, r) => isLegacy(r['asset_type']) || isLegacy(((r['metadata'] as Record<string, Record<string, unknown>>)?.['classification'] ?? {})['assetType']));
  return { db, runner };
}

describe('BackfillAssetTypesToEnglish20260930000025', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its map equals the application map', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    for (const [legacy, canonical] of Object.entries(LEGACY_ASSET_TYPES)) {
      expect(canonicalAssetRowForBackfill({ asset_type: legacy, metadata: {} })!.set['asset_type']).toBe(canonical);
    }
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb({ assets: [] }, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites asset_type and metadata.classification.assetType, preserves other keys, skips canonical/other rows', async () => {
    const rows = [
      { id: ID(1), tenant_id: 't', asset_type: 'guia', metadata: { classification: { assetType: 'guia', confidence: 0.7 }, keep: 1 } },
      { id: ID(2), tenant_id: 't', asset_type: 'wav', metadata: { classification: { assetType: 'wav' } } },
      { id: ID(3), tenant_id: 't', asset_type: 'videoclipe', metadata: {} },
      { id: ID(4), tenant_id: 't', asset_type: 'document', metadata: { classification: { assetType: 'contrato' } } },
      { id: ID(5), tenant_id: 't', asset_type: 'Guia', metadata: {} }, // not an exact match: never guessed
    ];
    const { db, runner } = setup(rows);
    await migration.up(runner as never);
    expect(rows[0]).toMatchObject({ asset_type: 'guide_track', metadata: { classification: { assetType: 'guide_track', confidence: 0.7 }, keep: 1 } });
    expect(rows[1]).toMatchObject({ asset_type: 'wav', metadata: { classification: { assetType: 'wav' } } });
    expect(rows[2]).toMatchObject({ asset_type: 'music_video', metadata: {} });
    expect(rows[3]).toMatchObject({ asset_type: 'document', metadata: { classification: { assetType: 'contract' } } });
    expect(rows[4].asset_type).toBe('Guia');
    expect(db.log).toHaveLength(3);

    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE "assets"')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before); // idempotent
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE/i);
  });

  it('down() restores BEFORE for untouched rows only', async () => {
    const rows = [
      { id: ID(1), tenant_id: 't', asset_type: 'guia', metadata: { classification: { assetType: 'guia' } } },
      { id: ID(2), tenant_id: 't', asset_type: 'contrato', metadata: {} },
    ];
    const { runner } = setup(rows);
    await migration.up(runner as never);
    rows[1].asset_type = 'document'; // user re-classified after up()
    await migration.down(runner as never);
    expect(rows[0]).toMatchObject({ asset_type: 'guia', metadata: { classification: { assetType: 'guia' } } });
    expect(rows[1].asset_type).toBe('document');
  });

  it('is a pure vocabulary rewrite: no CHECK is added and logs carry counts only', async () => {
    const { db, runner } = setup([{ id: ID(1), tenant_id: 't', asset_type: 'guia', metadata: {} }]);
    await migration.up(runner as never);
    expect(db.statements.some((s) => /ADD CONSTRAINT|CHECK\s*\(/i.test(s.sql))).toBe(false);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/guia|guide_track/);
  });
});
