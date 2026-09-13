import { safeOrderBy } from './safe-order-by';

/**
 * find-924ed503: this util existed unused (never imported anywhere) while
 * artists.service.ts built ORDER BY from an unvalidated client string --
 * a live SQL injection vector. Now wired into artists/marketing-projects/
 * marketing-contents/marketing-assets services, replacing their own ad hoc
 * (or, for artists, missing) allow-list checks.
 */
describe('safeOrderBy', () => {
  const allowed = ['created_at', 'title', 'status'] as const;

  it('returns the value when it is in the allow-list', () => {
    expect(safeOrderBy('title', allowed, 'created_at')).toBe('title');
  });

  it('falls back to the default when the value is not in the allow-list', () => {
    expect(safeOrderBy('id; DROP TABLE artists;--', allowed, 'created_at')).toBe('created_at');
  });

  it('falls back to the default when the value is a SQL subquery/injection attempt', () => {
    expect(safeOrderBy('(SELECT pg_sleep(5))', allowed, 'created_at')).toBe('created_at');
  });

  it('falls back to the default when undefined', () => {
    expect(safeOrderBy(undefined, allowed, 'created_at')).toBe('created_at');
  });

  it('falls back to the default for an empty string', () => {
    expect(safeOrderBy('', allowed, 'created_at')).toBe('created_at');
  });
});
