import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({ getSubscription: vi.fn() }));

vi.mock("@/modules/integrations/clients/stripe.client", () => ({
  stripeClient: { getSubscription: (...a: unknown[]) => state.getSubscription(...a) },
}));
vi.mock("@/shared/lib/env", () => ({ AUTH_DISABLED: false, DEV_AUTH_BYPASS: false, IS_DEV: false }));

import { usePlanFeatures } from "@/shared/hooks/usePlanFeatures";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function featuresFor(features: Record<string, unknown>) {
  state.getSubscription.mockResolvedValue({ plan: "professional", status: "active", features });
  const { result } = renderHook(() => usePlanFeatures(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await waitFor(() => expect(result.current.status).toBe("active"));
  return result.current.features;
}

describe("usePlanFeatures legacy feature keys (dual-read of subscriptions not yet backfilled)", () => {
  beforeEach(() => state.getSubscription.mockReset());

  it("features.moduleRh=true enables moduleHr (starter default is false)", async () => {
    const features = await featuresFor({ moduleRh: true });
    expect(features.moduleHr).toBe(true);
    expect(Object.keys(features)).not.toContain("moduleRh");
  });

  it("the canonical moduleHr wins over a conflicting legacy moduleRh", async () => {
    const features = await featuresFor({ moduleHr: false, moduleRh: true });
    expect(features.moduleHr).toBe(false);
  });

  it("without any HR flag moduleHr stays at the starter default and other flags merge", async () => {
    const features = await featuresFor({ moduleMarketing: true });
    expect(features.moduleHr).toBe(false);
    expect(features.moduleMarketing).toBe(true);
  });
});
