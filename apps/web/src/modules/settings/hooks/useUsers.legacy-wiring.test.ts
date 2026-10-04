import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPatch = vi.fn();

vi.mock("@/shared/lib/api-client", () => ({ api: { get: (...a: unknown[]) => apiGet(...a), patch: (...a: unknown[]) => apiPatch(...a) } }));
vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useUsers } from "./useUsers";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, children);

const statusCalls = () => apiPatch.mock.calls.filter(([url]) => String(url).endsWith("/status"));

describe("useUsers.updateUser legacy status wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ data: [] });
    apiPatch.mockResolvedValue({});
  });

  it.each([
    ["ativo", "active"],
    ["active", "active"],
    ["inativo", "inactive"],
    ["inactive", "inactive"],
    ["suspenso", "inactive"],
    ["pendente", "inactive"],
  ])("updateUser({ status: %s }) PATCHes /users/:id/status with %s", async (input, expected) => {
    const { result } = renderHook(() => useUsers(), { wrapper });
    await act(async () => {
      await result.current.updateUser.mutateAsync({ id: "u9", status: input as never });
    });
    await waitFor(() => expect(statusCalls()).toHaveLength(1));
    expect(statusCalls()[0]).toEqual(["/users/u9/status", { status: expected }]);
  });

  it("does not call the status endpoint when no status is given", async () => {
    const { result } = renderHook(() => useUsers(), { wrapper });
    await act(async () => {
      await result.current.updateUser.mutateAsync({ id: "u9", full_name: "Ana" });
    });
    expect(statusCalls()).toHaveLength(0);
  });
});
