import 'reflect-metadata';
import * as entities from './entities';

/**
 * Every entity class exported by entities.ts must be registered in ALL_ENTITIES: TypeORM only knows the
 * classes of the DataSource list, so an unregistered one fails every query with
 * "No metadata for <Entity> was found" (support requests and the knowledge base returned 500 for this reason).
 * Pure static check: no database needed.
 */
describe('entities registry', () => {
  const exported = Object.entries(entities).filter(([name, value]) => /Entity$/.test(name) && typeof value === 'function');

  it('exports entity classes at all (the guard is not vacuous)', () => {
    expect(exported.length).toBeGreaterThan(100);
    expect(entities.ALL_ENTITIES.length).toBeGreaterThan(100);
  });

  it('registers every exported entity class in ALL_ENTITIES', () => {
    const registered = new Set<unknown>(entities.ALL_ENTITIES);
    const missing = exported.filter(([, cls]) => !registered.has(cls)).map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('registers no class twice', () => {
    const names = entities.ALL_ENTITIES.map((cls) => (cls as { name: string }).name);
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });
});
