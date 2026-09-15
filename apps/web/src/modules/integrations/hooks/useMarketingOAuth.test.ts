import { describe, expect, it } from "vitest";
import { toConnection } from "./useMarketingOAuth";

/**
 * CODEBASE_MAP Gotcha #21: `needs_reauth` was fetched from
 * GET /integrations/oauth/status but silently dropped before the connection
 * object reached the UI, so a token-refresh gap for a provider like
 * google_business/tiktok_business could never surface as a reconnect prompt.
 * This locks the wire status -> connection mapping so it can't regress.
 */
describe("useMarketingOAuth — toConnection", () => {
  it("propagates needs_reauth=true from the backend status into needsReauth", () => {
    const connection = toConnection("google_business", { connected: true, needs_reauth: true });
    expect(connection.connected).toBe(true);
    expect(connection.needsReauth).toBe(true);
  });

  it("needsReauth is false when the backend omits needs_reauth", () => {
    const connection = toConnection("tiktok_business", { connected: true });
    expect(connection.needsReauth).toBe(false);
  });

  it("needsReauth is false for a healthy connected status", () => {
    const connection = toConnection("meta_business", { connected: true, needs_reauth: false });
    expect(connection.needsReauth).toBe(false);
  });
});
