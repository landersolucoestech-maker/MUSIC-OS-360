import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { EventsStartsAtBackfillAndSync20260928000007 } from './migrations/20260928000007_EventsStartsAtBackfillAndSync';
import { EventEntity } from './entities';

/**
 * LC1: the API no longer writes events.data. That is only safe because the DB trigger
 * (migration 20260928000007) fills it on INSERT and keeps it equal to starts_at on UPDATE.
 * These guards pin both halves of that contract so the dual-write cannot silently come back or
 * the trigger be weakened before the events.data drop (docs/engineering/legacy-column-drop-plan.md).
 */
describe('events.data legacy mirror (LC1)', () => {
  it('the entity never writes data (insert: false, update: false) and still reads it', () => {
    const column = getMetadataArgsStorage().columns.find((c) => c.target === EventEntity && c.propertyName === 'data');
    expect(column).toBeDefined();
    expect(column!.options.insert).toBe(false);
    expect(column!.options.update).toBe(false);
    expect(column!.options.select).not.toBe(false);
    const startsAt = getMetadataArgsStorage().columns.find((c) => c.target === EventEntity && c.propertyName === 'starts_at');
    expect(startsAt!.options.insert).not.toBe(false);
    expect(startsAt!.options.update).not.toBe(false);
  });

  it('the sync trigger fills data from starts_at on INSERT and propagates starts_at on UPDATE', async () => {
    const sql: string[] = [];
    const query = jest.fn(async (text: string) => {
      sql.push(text);
      if (text.includes('diverging')) return [{ diverging: 0 }];
      return [];
    });
    await new EventsStartsAtBackfillAndSync20260928000007().up({ query } as never);
    const all = sql.join('\n');
    expect(all).toContain('NEW.data := COALESCE(NEW.data, NEW.starts_at)');
    expect(all).toMatch(/NEW\.starts_at IS DISTINCT FROM OLD\.starts_at AND NEW\.data IS NOT DISTINCT FROM OLD\.data[\s\S]*NEW\.data := NEW\.starts_at/);
    expect(all).toContain('BEFORE INSERT OR UPDATE OF "data", "starts_at" ON "events"');
  });
});
