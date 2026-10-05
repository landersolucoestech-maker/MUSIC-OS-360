import { canonicalOperationalSlug, legacyOperationalSlugs } from './operational-list-vocabulary';

describe('operational vocabulary lookups never treat prototype keys as list kinds or legacy slugs', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('%s is returned unchanged / matches nothing', (key) => {
    expect(canonicalOperationalSlug(key, 'name')).toBe('name');
    expect(canonicalOperationalSlug('event_type', key)).toBe(key);
    expect(legacyOperationalSlugs(key, 'name')).toEqual([]);
  });
});
