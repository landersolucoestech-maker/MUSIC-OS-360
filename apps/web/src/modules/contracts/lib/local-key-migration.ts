import { localStore } from "@/shared/lib/local-store";

/**
 * Reads `key`; when absent, moves the value stored under `legacyKey` (a registry
 * written before the `musicos360_` key prefix) to `key` and deletes the legacy entry,
 * so no user data is lost. Returns null when neither key holds a value.
 */
export function readWithLegacyKeyMigration<T>(key: string, legacyKey: string): T | null {
  const current = localStore.get<T>(key);
  if (current !== null) return current;
  const legacy = localStore.get<T>(legacyKey);
  if (legacy === null) return null;
  localStore.set(key, legacy);
  localStore.remove(legacyKey);
  return legacy;
}
