/**
 * shared/lib/safe-object.ts
 *
 * Guards against remote property injection / prototype pollution (CWE-915) when
 * a user-controlled value is used as a dynamic object key. Rejects the
 * prototype-polluting keys (__proto__, constructor, prototype) and anything
 * outside a strict id allowlist.
 */

const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
]);
const SAFE_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** Type-guard: true only for a safe own-property key. */
export function isSafeKey(key: unknown): key is string {
  return typeof key === "string" && !FORBIDDEN_KEYS.has(key) && SAFE_KEY_RE.test(key);
}

/** Returns the key if safe; throws `UnsafeKeyError` otherwise. */
export class UnsafeKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeKeyError";
  }
}

export function assertSafeKey(key: unknown): string {
  if (!isSafeKey(key)) {
    throw new UnsafeKeyError(`Invalid object key: ${String(key)}`);
  }
  return key;
}

/**
 * Shallow copy with prototype-polluting keys removed. Use before spreading or
 * merging a user-controlled object so `__proto__`/`constructor`/… cannot reach
 * the merge target (CWE-915). Keeps every other (free-form) key intact.
 */
export function stripUnsafeKeys<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    // Explicit comparisons are the recognized prototype-pollution barrier.
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = obj[k];
  }
  return out as Partial<T>;
}
