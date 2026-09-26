import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services", () => ({
  contactsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { contactsService } from "../services";
import { useContacts } from "./useContacts";

beforeEach(() => vi.clearAllMocks());

describe("useContacts — estados reais de carregamento/sucesso/erro", () => {
  it("starts with isLoading=true and no error", () => {
    vi.mocked(contactsService.list).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useContacts());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual([]);
  });

  it("an empty list is a real, distinct state (not an error, not a mock)", async () => {
    vi.mocked(contactsService.list).mockResolvedValue([]);
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual([]);
  });

  it("sucesso popula contacts reais vindos do service", async () => {
    const rows = [{ id: "1", name: "Fulano" }] as never[];
    vi.mocked(contactsService.list).mockResolvedValue(rows);
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("a network/API failure becomes an observable error state, not an empty list disguised as success", async () => {
    vi.mocked(contactsService.list).mockRejectedValue(new Error("Network failure"));
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Network failure");
  });

  it("createContact propagates the service error without creating a local contact", async () => {
    vi.mocked(contactsService.list).mockResolvedValue([]);
    vi.mocked(contactsService.create).mockRejectedValue(new Error("422 validation"));
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createContact({ name: "X" } as never);
      }),
    ).rejects.toThrow("422 validation");
    expect(result.current.contacts).toEqual([]);
  });
});
