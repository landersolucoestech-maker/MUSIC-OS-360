import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** 1dfd595 FE LOW-2: while the tenant is unknown the settings page shows loading, never the load error. */
const tenantState: { tenant: { id: string } | null } = { tenant: null };
vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => tenantState }));
const getSettings = vi.hoisted(() => vi.fn());
vi.mock("../services/musicchat-automation.service", () => ({ musicChatAutomationService: { getSettings, updateSettings: vi.fn() } }));

import { useMusicChatAutomationSettings } from "./useMusicChatAutomationSettings";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("useMusicChatAutomationSettings", () => {
  it("is loading (and fetches nothing) until the tenant is known", () => {
    const { result } = renderHook(() => useMusicChatAutomationSettings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings).toBeUndefined();
    expect(getSettings).not.toHaveBeenCalled();
  });
});
