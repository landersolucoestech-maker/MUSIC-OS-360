/**
 * Canonical keys of the plan / tenant feature flags (`tenants.features`, seeded
 * `billing_plans.features` objects, PLAN_FEATURES).
 *
 * `moduleRh` (Portuguese "RH") -> `moduleHr` (the HR module). Expand/contract (migration
 * 20260930000024): writers are canonical, readers accept both (canonical wins when both are
 * present). Removal condition: the census in findings/persisted-jsonb-pj1.md returns 0 for one
 * release window. The RBAC module key `rh` / role slug `rh_manager` belong to the RBAC slice.
 *
 * Web twin: apps/web/src/shared/lib/feature-flags.ts (canonicalFeatureKeys).
 */
export const LEGACY_PLAN_FEATURE_KEYS: Readonly<Record<string, string>> = { moduleRh: 'moduleHr' };

/** Feature object with the legacy keys renamed (canonical wins when both exist); other keys are preserved, the input is not mutated. */
export function canonicalPlanFeatures<T extends Record<string, unknown>>(features: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(features ?? {})) {
    if (key === '__proto__') continue;
    const canonical = Object.prototype.hasOwnProperty.call(LEGACY_PLAN_FEATURE_KEYS, key) ? LEGACY_PLAN_FEATURE_KEYS[key] : key;
    if (canonical !== key && Object.prototype.hasOwnProperty.call(features, canonical)) continue;
    out[canonical] = value;
  }
  return out;
}
