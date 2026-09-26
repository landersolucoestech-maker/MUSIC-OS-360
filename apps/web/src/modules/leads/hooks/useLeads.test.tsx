import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services", () => ({
  leadsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { leadsService } from "../services";
import { useLeads } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("useLeads — estados reais de carregamento/sucesso/erro", () => {
  it("starts with isLoading=true and no error", () => {
    vi.mocked(leadsService.list).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLeads());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.leads).toEqual([]);
  });

  it("an empty list is a real, distinct state (not an error, not a mock)", async () => {
    vi.mocked(leadsService.list).mockResolvedValue([]);
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.leads).toEqual([]);
  });

  it("sucesso popula leads reais vindos do service", async () => {
    const rows = [{ id: "1", nomeCompleto: "Fulano", dadosInternosCRM: {} }] as never[];
    vi.mocked(leadsService.list).mockResolvedValue(rows);
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.leads).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("a network/API failure becomes an observable error state, not an empty list disguised as success", async () => {
    vi.mocked(leadsService.list).mockRejectedValue(new Error("Falha de rede"));
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Falha de rede");
  });

  it("createLead propagates the service error without creating a local lead", async () => {
    vi.mocked(leadsService.list).mockResolvedValue([]);
    vi.mocked(leadsService.create).mockRejectedValue(new Error("422 validação"));
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createLead({ nomeCompleto: "X" } as never);
      }),
    ).rejects.toThrow("422 validação");
    expect(result.current.leads).toEqual([]);
  });
});
