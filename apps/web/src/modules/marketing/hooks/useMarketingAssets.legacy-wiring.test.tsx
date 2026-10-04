import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { useProjectAssetLibrary } from "./useMarketingAssets";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function loadLibrary(rows: unknown[]) {
  apiMock.get.mockResolvedValue(rows);
  const { result } = renderHook(() => useProjectAssetLibrary("project-1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data ?? [];
}

describe("useProjectAssetLibrary legacy source department wiring", () => {
  beforeEach(() => apiMock.get.mockReset());

  it("maps legacy metadata source department slugs to the canonical value", async () => {
    const data = await loadLibrary([
      { id: "a1", metadata: { sourceDepartment: "conteudo" } },
      { id: "a2", metadata: { sourceDepartment: "operacoes" } },
    ]);
    expect(data.map((asset) => asset.sourceDepartment)).toEqual(["content", "operations"]);
  });

  it("maps a legacy slug carried on the asset itself", async () => {
    const data = await loadLibrary([{ id: "a3", sourceDepartment: "conteudo", metadata: {} }]);
    expect(data[0].sourceDepartment).toBe("content");
  });

  it("keeps canonical and open-string departments untouched and yields undefined when absent", async () => {
    const data = await loadLibrary([
      { id: "a4", metadata: { sourceDepartment: "content" } },
      { id: "a5", metadata: { sourceDepartment: "legal" } },
      { id: "a6", metadata: {} },
    ]);
    expect(data.map((asset) => asset.sourceDepartment)).toEqual(["content", "legal", undefined]);
  });
});
