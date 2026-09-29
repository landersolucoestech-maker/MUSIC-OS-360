import { planRollbackTo, unknownAppliedMigrations } from './migrate-application';

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

describe('unknownAppliedMigrations — intentionally unregistered migrations', () => {
  it('does not count an applied intentionally-unregistered migration (DEV holds one) as the database being ahead', () => {
    expect(unknownAppliedMigrations(['A20260101000001', 'DropOrphanContactsSatelliteTables20260713000002'], ['A20260101000001'])).toEqual([]);
    expect(unknownAppliedMigrations(['A20260101000001', 'X20260101000009'], ['A20260101000001'], ['X20260101000009'])).toEqual([]);
  });
});

describe('planRollbackTo', () => {
  const build = ['A20260101000001', 'B20260101000002', 'C20260101000003', 'RealtimeBroadcastAuthorization20260801000001', 'D20260901000004'];
  const row = (id: number, name: string) => ({ id, name, timestamp: Number(name.match(/(\d{14})$/)![1]) });

  it('reverts everything newer than the target, newest first', () => {
    const applied = [row(1, 'A20260101000001'), row(2, 'B20260101000002'), row(3, 'C20260101000003')];
    expect(planRollbackTo(applied, 'A20260101000001', build)).toEqual(['C20260101000003', 'B20260101000002']);
    expect(planRollbackTo(applied, 'C20260101000003', build)).toEqual([]);
  });

  it('refuses a target not in the build or not applied', () => {
    expect(() => planRollbackTo([row(1, 'A20260101000001')], 'Z20260101000009', build)).toThrow(/not a migration of this build/);
    expect(() => planRollbackTo([row(1, 'A20260101000001')], 'B20260101000002', build)).toThrow(/not applied/);
  });

  it('refuses rows applied out of timestamp order around the target (tracking-id order would revert an older migration)', () => {
    // B applied after C (segmented run): rolling back to C by tracking id would revert B, which is older than C.
    const applied = [row(1, 'A20260101000001'), row(2, 'C20260101000003'), row(3, 'B20260101000002')];
    expect(() => planRollbackTo(applied, 'C20260101000003', build)).toThrow(/out of timestamp order/);
  });

  it('refuses an EXTERNAL_MANAGED migration or a row the build does not ship', () => {
    const withRealtime = [row(1, 'A20260101000001'), row(2, 'RealtimeBroadcastAuthorization20260801000001')];
    expect(() => planRollbackTo(withRealtime, 'A20260101000001', build)).toThrow(/non-APPLICATION/);
    const withUnknown = [row(1, 'A20260101000001'), row(2, 'Q20260301000001')];
    expect(() => planRollbackTo(withUnknown, 'A20260101000001', build)).toThrow(/no down\(\) for: Q20260301000001/);
  });
});
