import { unknownAppliedMigrations } from './migrate-application';

/**
 * db:check (and the staging deploy gate behind it) must refuse a build whose
 * migration list does not contain every applied migration: that build would
 * serve against a schema newer than the one it knows (DB-M2).
 */
describe('unknownAppliedMigrations', () => {
  const build = ['A20260101000001', 'B20260101000002', 'C20260101000003'];

  it('is empty when the database is at or behind the build', () => {
    expect(unknownAppliedMigrations(['A20260101000001', 'B20260101000002'], build)).toEqual([]);
    expect(unknownAppliedMigrations(build, build)).toEqual([]);
    expect(unknownAppliedMigrations([], build)).toEqual([]);
  });

  it('lists applied migrations the build does not ship, in applied order', () => {
    expect(unknownAppliedMigrations([...build, 'D20260101000004', 'E20260101000005'], build))
      .toEqual(['D20260101000004', 'E20260101000005']);
  });

  it('catches a diverged history, not only a newer one', () => {
    expect(unknownAppliedMigrations(['A20260101000001', 'X20251231000009'], build)).toEqual(['X20251231000009']);
  });
});
