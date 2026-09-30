import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/shared/lib/api-client", () => ({ api: { post: vi.fn(), get: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from "@/shared/lib/api-client";
import { UserFacingError, toUserMessage } from "@/shared/lib/errors";
import { useAbramusRegisterWork } from "./useAbramus";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAbramusRegisterWork", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the canonical body with an idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ external_id: "ext-1", code: "C1" });
    const { result } = renderHook(() => useAbramusRegisterWork(), { wrapper: wrapper() });
    result.current.mutate({
      title: "Obra X", composers: ["Fulano", "Beltrano", "Ciclano"], iswc: "T-123",
      genre: "Pop", duration: "3:20", publisher: "Editora Y", local_id: "w1",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body, opts] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    expect(path).toBe("/integrations/abramus/register-work");
    expect(body).toEqual({
      title: "Obra X", composer: "Fulano", co_composers: ["Beltrano", "Ciclano"], iswc: "T-123",
      genre: "Pop", duration: "3:20", publisher: "Editora Y",
    });
    expect(opts.headers["X-Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("fails before any request, with PT-BR copy, when there is no composer", async () => {
    const { result } = renderHook(() => useAbramusRegisterWork(), { wrapper: wrapper() });
    result.current.mutate({ title: "Obra X", composers: ["  "], local_id: "w1" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.error).toBeInstanceOf(UserFacingError);
    expect(toUserMessage(result.current.error)).toBe("Informe ao menos um compositor para registrar a obra na ABRAMUS.");
  });
});
