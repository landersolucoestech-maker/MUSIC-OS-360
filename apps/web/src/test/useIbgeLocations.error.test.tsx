import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useIbgeMunicipalities } from "@/modules/marketing/components/campaign-builder/useIbgeLocations";

describe("useIbgeMunicipalities error state", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exposes fixed PT-BR copy, never the stringified exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432 password authentication failed")));
    const { result } = renderHook(() => useIbgeMunicipalities("ZZ"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe("Não foi possível carregar as cidades. Tente novamente.");
    expect(result.current.error).not.toContain("ECONNREFUSED");
    expect(result.current.error).not.toContain("Error");
  });

  it("does not expose the internal HTTP-failure diagnostic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useIbgeMunicipalities("YY"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).not.toContain("IBGE");
    expect(result.current.error).not.toContain("failed to fetch");
  });
});
