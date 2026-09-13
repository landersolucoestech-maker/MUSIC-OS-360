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
  it("inicia em isLoading=true e sem erro", () => {
    vi.mocked(contactsService.list).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useContacts());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual([]);
  });

  it("lista vazia é um estado real e distinto (não erro, não mock)", async () => {
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

  it("falha de rede/API vira estado de erro observável, não lista vazia disfarçada de sucesso", async () => {
    vi.mocked(contactsService.list).mockRejectedValue(new Error("Falha de rede"));
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Falha de rede");
  });

  it("createContact propaga erro do service sem criar contato local", async () => {
    vi.mocked(contactsService.list).mockResolvedValue([]);
    vi.mocked(contactsService.create).mockRejectedValue(new Error("422 validação"));
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createContact({ name: "X" } as never);
      }),
    ).rejects.toThrow("422 validação");
    expect(result.current.contacts).toEqual([]);
  });
});
