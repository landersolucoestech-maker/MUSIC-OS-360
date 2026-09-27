/**
 * integrations/adapters/analytics.adapter.ts
 *
 * Product analytics adapter — REAL implementation via posthog-js.
 * Init happens in main.tsx (VITE_POSTHOG_KEY, publishable key);
 * before init or without a configured key, events are discarded
 * by posthog-js itself — there is never simulated data.
 *
 * RULE: components NEVER call posthog-js directly.
 * They use hooks/services that delegate to this adapter.
 *
 * Usage:
 *   import { analyticsAdapter } from "@/modules/integrations/adapters/analytics.adapter";
 *   analyticsAdapter.track("contract.created", { tenant_id, user_id });
 */

import posthog from "posthog-js";
import type { IAnalyticsProvider } from "@/modules/integrations/dto";

export const analyticsAdapter: IAnalyticsProvider = {
  identify(userId, properties) {
    if (!posthog.__loaded) return;
    posthog.identify(userId, properties as Record<string, unknown> | undefined);
  },
  track(event, properties) {
    if (!posthog.__loaded) return;
    posthog.capture(event, properties as Record<string, unknown> | undefined);
  },
  page(name, properties) {
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", { page_name: name, ...(properties as Record<string, unknown> | undefined) });
  },
  async isFeatureEnabled(flagKey, _context) {
    if (!posthog.__loaded) return false;
    return posthog.isFeatureEnabled(flagKey) ?? false;
  },
  async getFeatureFlagPayload(flagKey, _context) {
    if (!posthog.__loaded) return null;
    const payload = posthog.getFeatureFlagPayload(flagKey);
    return payload == null ? null : typeof payload === "string" ? payload : JSON.stringify(payload);
  },
  reset() {
    if (!posthog.__loaded) return;
    posthog.reset();
  },
};
