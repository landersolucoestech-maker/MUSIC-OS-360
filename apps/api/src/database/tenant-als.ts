/**
 * database/tenant-als.ts
 *
 * PHASE 3J — TRANSPARENT propagation of the tenant context to global
 * repositories (`ds.getRepository(...)` captured in the services' constructors).
 *
 * Problem (confirmed in PHASE 3I): the services capture the repo in the constructor
 * from the DataSource. A Proxy on `getRepository` alone would not suffice — the repo is already
 * captured. Solution: the `getRepository` Proxy returns a Repository Proxy
 * that RE-RESOLVES the repo on EVERY operation, consulting an
 * AsyncLocalStorage. When there is a tenant manager in the ALS (set by
 * `DatabaseContextService.runInTenantContext`), all queries — even from repos
 * captured in the constructor — run on the connection/transaction with
 * `app.current_tenant_id` set. No store in the ALS → behavior IDENTICAL to the
 * current one (pass-through), which limits the blast radius (opt-in by presence of
 * context).
 *
 * Does NOT change RLS, policies, schema nor `private_get_tenant_id()`. Reuses the
 * existing `runInTenantContext` primitive (does not create a second mechanism).
 */
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityManager } from 'typeorm';

interface TenantStore {
  manager: EntityManager;
}

/** Per-request/per-context store with the contextualized EntityManager. */
export const tenantAls = new AsyncLocalStorage<TenantStore>();

/** Binds the contextualized manager to the ALS for the duration of `fn`. */
export function runWithTenantManager<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
  return tenantAls.run({ manager }, fn);
}

/** The context's active manager, if any (background/HTTP via runInTenantContext). */
export function currentTenantManager(): EntityManager | null {
  return tenantAls.getStore()?.manager ?? null;
}

type EntityTarget = Parameters<DataSource['getRepository']>[0];

/** Repository that re-resolves per operation: the ALS manager when active, otherwise the real one. */
function makeRepoProxy(real: DataSource, target: EntityTarget): unknown {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        const store = tenantAls.getStore();
        const repo = store
          ? store.manager.getRepository(target)
          : real.getRepository(target);
        const value = (repo as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(repo) : value;
      },
    },
  );
}

// DataSource methods that must run on the context's manager when active.
const ROUTED_WHEN_CONTEXT = new Set(['query', 'createQueryBuilder', 'transaction']);

/**
 * Wraps a real DataSource in an ALS-aware Proxy. Services injecting the
 * DATA_SOURCE token receive this Proxy and become contextualized automatically
 * — without changing a single line of the services.
 */
export function makeTenantAwareDataSource(real: DataSource): DataSource {
  return new Proxy(real, {
    get(target, prop, _receiver) {
      // getRepository ALWAYS returns a repo proxy that re-resolves per call
      // (covers the constructor-capture case).
      if (prop === 'getRepository') {
        return (entity: EntityTarget) => makeRepoProxy(target, entity);
      }
      const store = tenantAls.getStore();
      if (prop === 'manager') {
        return store ? store.manager : target.manager;
      }
      if (store && typeof prop === 'string' && ROUTED_WHEN_CONTEXT.has(prop)) {
        const mgr = store.manager as unknown as Record<string, (...a: unknown[]) => unknown>;
        return mgr[prop].bind(store.manager);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
