import { describe, it, expect, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNfeStatus } from "./useNfe";

const STORAGE_KEY = "musicos360_nfe_credentials";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const base = {
  cnpj: "00000000000191",
  tax_regime: "simples_nacional",
  environment: "sandbox",
  certificate_type: "A1",
  saved_at: "2024-01-01T00:00:00.000Z",
};

describe("useNfeStatus legacy provider alias", () => {
  beforeEach(() => sessionStorage.clear());

  it.each([
    ["proprio", "custom"],
    ["custom", "custom"],
    ["focusnfe", "focusnfe"],
  ])("stored provider %s is exposed as %s", async (stored, canonical) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, provider: stored }));
    const { result } = renderHook(() => useNfeStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.provider).toBe(canonical);
    expect(result.current.data?.connected).toBe(true);
  });
});
