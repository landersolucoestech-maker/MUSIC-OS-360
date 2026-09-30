import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: (m: string) => toastError(m) } }));

import { useACRCloudIdentify } from "@/modules/integrations/hooks/useACRCloud";

const RAW = "ECONNREFUSED 10.0.0.5:5432 password authentication failed";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function identifyWith(status: number, body: unknown): Promise<string> {
  toastError.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
  const { result } = renderHook(() => useACRCloudIdentify(), { wrapper });
  result.current.mutate({} as never);
  await waitFor(() => expect(toastError).toHaveBeenCalled());
  return String(toastError.mock.calls[0][0]);
}

describe("useACRCloudIdentify - error copy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not show raw provider text from body.message", async () => {
    const text = await identifyWith(502, { statusCode: 502, error: "Bad Gateway", message: RAW });
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("password authentication");
    expect(text).toContain("Erro na identificação");
  });

  it("keeps legitimate PT-BR API copy", async () => {
    const text = await identifyWith(400, { statusCode: 400, error: "Bad Request", message: "O trecho de áudio é muito curto." });
    expect(text).toContain("O trecho de áudio é muito curto.");
  });
});
