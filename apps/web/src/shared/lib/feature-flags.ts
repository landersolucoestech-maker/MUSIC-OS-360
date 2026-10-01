/**
 * MUSIC OS 360 — Feature Flags
 *
 * Centralizes all feature gate decisions.
 * In standalone/mock mode all flags default to enabled.
 * Future: resolved server-side per tenant plan + overrides.
 */

// ─── Flag definitions ─────────────────────────────────────────────────────────

export interface FeatureFlags {
  // ── Core modules
  moduleArtists:      boolean;
  moduleCatalog:      boolean;
  moduleReleases:     boolean;
  moduleContracts:    boolean;
  moduleAccounting:   boolean;
  moduleCrm:          boolean;
  moduleMarketing:    boolean;
  moduleEvents:       boolean;
  moduleInventory:    boolean;
  moduleHr:           boolean;
  moduleMonitoring:   boolean;
  moduleLicensing:    boolean;
  moduleProjects:     boolean;
  moduleLeads:        boolean;

  // ── Features
  musicChat:          boolean;
  commandPalette:     boolean;
  exportPdf:          boolean;
  importXlsx:         boolean;
  bulkActions:        boolean;
  activityFeed:       boolean;
  auditLog:           boolean;

  // ── Integrations
  abramusIntegration: boolean;
  onerpIntegration:   boolean;
  symphonicIntegration: boolean;
  distrokidIntegration: boolean;
  soundonIntegration: boolean;
  musicproIntegration: boolean;
  somvibeIntegration: boolean;
  autentiqueIntegration: boolean;
  spotifyIntegration: boolean;
  youtubeIntegration: boolean;
  metaAdsIntegration: boolean;
  googleIntegration:  boolean;
  tiktokIntegration:  boolean;
  deezerIntegration:  boolean;
  appleMusicIntegration: boolean;
  soundcloudIntegration: boolean;
  resendIntegration:  boolean;
  ecadIntegration:    boolean;

  // ── Future / Gated
  aiFeatures:         boolean;
  multiTenantAdmin:   boolean;
  billingPortal:      boolean;
  storageR2:          boolean;
  rbacAdvanced:       boolean;
  analyticsAdvanced:  boolean;
}

// ─── Default flags (standalone / enterprise plan) ─────────────────────────────

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  // Core modules — all enabled in enterprise
  moduleArtists:      true,
  moduleCatalog:      true,
  moduleReleases:     true,
  moduleContracts:    true,
  moduleAccounting:   true,
  moduleCrm:          true,
  moduleMarketing:    true,
  moduleEvents:       true,
  moduleInventory:    true,
  moduleHr:           true,
  moduleMonitoring:   true,
  moduleLicensing:    true,
  moduleProjects:     true,
  moduleLeads:        true,

  // Features
  musicChat:          true,
  commandPalette:     true,
  exportPdf:          true,
  importXlsx:         true,
  bulkActions:        true,
  activityFeed:       true,
  auditLog:           true,

  // Integrations — only Abramus active in mock
  abramusIntegration:    true,
  onerpIntegration:      false,
  symphonicIntegration:  false,
  distrokidIntegration:  false,
  soundonIntegration:    false,
  musicproIntegration:   false,
  somvibeIntegration:    false,
  autentiqueIntegration: false,
  spotifyIntegration:    false,
  youtubeIntegration:    false,
  metaAdsIntegration:    false,
  googleIntegration:     false,
  tiktokIntegration:     false,
  deezerIntegration:     false,
  appleMusicIntegration: false,
  soundcloudIntegration: false,
  resendIntegration:     false,
  ecadIntegration:       false,

  // Future / Gated — all disabled until backend ready
  aiFeatures:         false,
  multiTenantAdmin:   false,
  billingPortal:      false,
  storageR2:          false,
  rbacAdvanced:       false,
  analyticsAdvanced:  false,
};

/** Plan-scoped flag presets */
export const PLAN_FLAGS: Record<"starter" | "professional" | "enterprise", Partial<FeatureFlags>> = {
  starter: {
    moduleMonitoring:  false,
    moduleLicensing:   false,
    moduleHr:          false,
    auditLog:          false,
    bulkActions:       false,
    analyticsAdvanced: false,
  },
  professional: {
    analyticsAdvanced: false,
    multiTenantAdmin:  false,
  },
  enterprise: {
    // all defaults apply
  },
};

/** Merge plan flags with defaults */
export function resolveFlagsForPlan(
  plan: "starter" | "professional" | "enterprise"
): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...PLAN_FLAGS[plan] };
}

// ─── Backend completeness map ─────────────────────────────────────────────────

/**
 * Modules whose UI exists but whose backend is still partial.
 * In production, these modules show a real empty state (not fictitious data).
 * In dev, they show mocks with a clear banner indication.
 *
 * Each entry is the module name + the reason for incompleteness.
 * The corresponding pages already have gates implemented in:
 *   - admin: `modules/admin/data/admin-source.ts`
 *   - monitoring/rights: `modules/monitoring/rights/services/rights-source.ts`
 *   - support (partial): `modules/support/hooks/useSupport.ts` (only tickets have a real endpoint)
 *
 * Reports: `Reports.tsx` is already 100% driven by the real backend
 * (`/reports/entities`, `/reports/definitions`) — no gate/mock, removed from here.
 *
 * When the corresponding backend is implemented, remove it from the list.
 */
export const MODULES_WITH_INCOMPLETE_BACKEND: Record<string, string> = {
  adminKpis:           "Admin KPIs (MRR/ARR/tenants) — endpoint /admin/* ainda não existe",
  marketingAnalytics:  "Marketing Métricas — métricas de campanhas vêm de mock",
  rightsMonitoring:    "Rights Monitoring — endpoints reais para execuções/cue sheets ainda não existem",
  supportChat:         "Suporte Chat/Knowledge/Requests — apenas /support-tickets implementado",
  externalDataExchange: "External Data Exchange — providers reais aguardando integração",
};

/** Helper for components: returns the reason if the module is incomplete, null otherwise. */
export function getIncompleteBackendReason(moduleKey: string): string | null {
  return MODULES_WITH_INCOMPLETE_BACKEND[moduleKey] ?? null;
}


/**
 * Legacy persisted feature keys (tenants.features / billing plan features) -> canonical.
 * `moduleRh` (Portuguese) -> `moduleHr`. The API already answers canonical keys
 * (common/compat/plan-features.ts); this keeps an older API/response readable. Canonical wins when
 * both are present. Removal condition: census in findings/persisted-jsonb-pj1.md at 0.
 */
export const LEGACY_FEATURE_KEYS: Readonly<Record<string, string>> = { moduleRh: "moduleHr" };

export function canonicalFeatureKeys(features: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(features ?? {})) {
    const canonical = Object.prototype.hasOwnProperty.call(LEGACY_FEATURE_KEYS, key) ? LEGACY_FEATURE_KEYS[key] : key;
    if (canonical !== key && Object.prototype.hasOwnProperty.call(features, canonical)) continue;
    out[canonical] = value;
  }
  return out;
}
