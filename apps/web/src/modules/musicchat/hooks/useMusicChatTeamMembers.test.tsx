import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * 48de4bb FE L2/L4: the member search is debounced and keeps the previous
 * result while loading; a failed name lookup is an error, not "not a member";
 * names do not flicker to the fallback when the id set changes.
 */
const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/api-client", () => ({ api: { get: apiGet } }));
vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));

import { useMusicChatMemberNames, useMusicChatTeamMembers } from "./useMusicChatTeamMembers";

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe("useMusicChatTeamMembers", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("debounces the search: one request for the settled term, previous members kept meanwhile", async () => {
    apiGet.mockImplementation(async (url: string) =>
      url.includes("search=ana") ? [{ auth_user_id: "a", full_name: "Ana", email: "ana@x.com" }] : [{ auth_user_id: "z", full_name: "Zé", email: "ze@x.com" }]);
    const { result, rerender } = renderHook(({ search }) => useMusicChatTeamMembers(search), { wrapper: wrapper(), initialProps: { search: "" } });
    await waitFor(() => expect(result.current.members.map((m) => m.auth_user_id)).toEqual(["z"]));
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet.mock.calls[0][0]).toBe("/internal-chat/members?include_self=true");

    rerender({ search: "a" });
    rerender({ search: "an" });
    rerender({ search: "ana" });
    // Still showing the previous list while the term settles (no emptied picker).
    expect(result.current.members.map((m) => m.auth_user_id)).toEqual(["z"]);
    expect(result.current.isSearching).toBe(true);
    await waitFor(() => expect(result.current.members.map((m) => m.auth_user_id)).toEqual(["a"]));
    const searched = apiGet.mock.calls.map(([url]) => url as string).filter((url) => url.includes("search="));
    expect(searched).toEqual(["/internal-chat/members?include_self=true&search=ana"]);
  });
});

describe("useMusicChatMemberNames", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it("a failed lookup is reported as an error, never as a missing member", async () => {
    apiGet.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useMusicChatMemberNames(["u1"]), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.names.size).toBe(0);
  });

  it("keeps the resolved names while a new id set loads (no flicker to the fallback)", async () => {
    let release: (value: unknown) => void = () => undefined;
    apiGet.mockResolvedValueOnce([{ auth_user_id: "u1", full_name: "Ana", email: "ana@x.com" }]);
    const { result, rerender } = renderHook(({ ids }) => useMusicChatMemberNames(ids), {
      wrapper: wrapper(),
      initialProps: { ids: ["u1"] as string[] },
    });
    await waitFor(() => expect(result.current.nameOf("u1", "Agente")).toBe("Ana"));
    apiGet.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    rerender({ ids: ["u1", "u2"] });
    expect(result.current.nameOf("u1", "Agente")).toBe("Ana");
    await act(async () => release([
      { auth_user_id: "u1", full_name: "Ana", email: "ana@x.com" },
      { auth_user_id: "u2", full_name: null, email: null },
    ]));
    await waitFor(() => expect(result.current.nameOf("u2", "Agente")).toBe("Agente"));
    expect(apiGet.mock.calls.at(-1)?.[0]).toBe("/internal-chat/members?ids=u1%2Cu2");
  });

  it("resolves more than 100 ids in chunks instead of dropping the rest", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `u${String(i).padStart(3, "0")}`);
    apiGet.mockImplementation(async (url: string) =>
      decodeURIComponent(url.split("ids=")[1]).split(",").map((id) => ({ auth_user_id: id, full_name: `Nome ${id}`, email: null })));
    const { result } = renderHook(() => useMusicChatMemberNames(ids), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.names.size).toBe(150));
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(result.current.nameOf("u149", "Agente")).toBe("Nome u149");
  });
});
