import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const get = vi.fn();
vi.mock("@/shared/lib/api-client", async (orig) => ({ ...(await orig<object>()), api: { get: (...a: unknown[]) => get(...a), post: vi.fn() } }));

import { useAutentiqueStatus } from "./useAutentique";

function run(body: unknown) {
  get.mockResolvedValue(body);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useAutentiqueStatus(), { wrapper });
}

describe("useAutentiqueStatus", () => {
  it("a saved token waiting for its first document is configured but not connected", async () => {
    const { result } = run({ autentique: { configured: true, connected: false } });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ configured: true, connected: false });
  });

  it("a proven token is both", async () => {
    const { result } = run({ autentique: { configured: true, connected: true } });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ configured: true, connected: true });
  });

  it("an older response with only `configured` keeps meaning connected", async () => {
    const { result } = run({ autentique: { configured: true } });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ configured: true, connected: true });
  });
});
