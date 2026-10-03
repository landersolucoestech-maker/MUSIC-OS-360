import { getMetadataArgsStorage } from 'typeorm';
import { LeadInteractionEntity } from '../entities';
import { ALL_MIGRATIONS } from './index';
import { RenameLeadInteractionsDataToOccurredAt20261003000001 as Migration } from './20261003000001_RenameLeadInteractionsDataToOccurredAt';

function runner() {
  const calls: string[] = [];
  return { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }), calls };
}

describe('RenameLeadInteractionsDataToOccurredAt (cross-layer: DB column, entity, API field)', () => {
  const migration = new Migration();

  it('is registered and is the newest registered migration', () => {
    const names = ALL_MIGRATIONS.map((m) => m.name);
    expect(names[names.length - 1]).toBe(migration.name);
  });

  it('up() is a guarded metadata-only rename: no data statement, no DROP, no rewrite', async () => {
    const r = runner();
    await migration.up({ query: r.query } as never);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toContain('RENAME COLUMN "data" TO "occurred_at"');
    expect(r.calls[0]).toMatch(/IF EXISTS[\s\S]*column_name = 'data'[\s\S]*NOT EXISTS[\s\S]*column_name = 'occurred_at'/);
    expect(r.calls[0]).not.toMatch(/DROP|UPDATE|DELETE|INSERT|ALTER COLUMN|TYPE/);
  });

  it('down() restores the legacy name with the mirrored guard', async () => {
    const r = runner();
    await migration.down({ query: r.query } as never);
    expect(r.calls[0]).toContain('RENAME COLUMN "occurred_at" TO "data"');
    expect(r.calls[0]).toMatch(/IF EXISTS[\s\S]*column_name = 'occurred_at'[\s\S]*NOT EXISTS[\s\S]*column_name = 'data'/);
  });

  it('the entity maps occurred_at and no longer maps the legacy name', () => {
    const columns = getMetadataArgsStorage().columns.filter((c) => c.target === LeadInteractionEntity).map((c) => c.propertyName);
    expect(columns).toContain('occurred_at');
    expect(columns).not.toContain('data');
  });
});
