// CRM contacts offered as schedule participants carry the PT-BR label of their category
// (labelFor over contactTypeOptions), or "Contato" when the contact has no category.
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useScheduleParticipants } from "@/modules/events/hooks/useScheduleParticipants";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn(), listPaged: vi.fn(), findById: vi.fn() } };
});
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: [] }) }));
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({
  useContacts: () => ({
    contacts: [
      { id: "k1", name: "Ana Filmes", category: "VIDEOMAKER" },
      { id: "k2", name: "Bruno Silva", category: "LAWYER" },
      { id: "k3", name: "Caio Sem Categoria" },
      { id: "k4", name: "Zeca Desconhecido", category: "NOT_A_CATEGORY" },
    ],
  }),
}));

vi.mocked(storage.list).mockResolvedValue([] as never);
vi.mocked(storage.listPaged).mockImplementation((async (_t: string, o: { pageSize: number }) => ({
  items: [], page: 1, pageSize: o.pageSize, total: 0, totalPages: 1,
})) as typeof storage.listPaged);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("useScheduleParticipants contact category", () => {
  it("contact participants expose the PT-BR category label", async () => {
    const { result } = renderHook(() => useScheduleParticipants(""), { wrapper });
    await waitFor(() => expect(result.current.participants.filter((p) => p.source === "contact")).toHaveLength(4));
    const cat = (id: string) => result.current.participants.find((p) => p.source === "contact" && p.id === id)?.category;
    expect(cat("k1")).toBe("Videomaker");
    expect(cat("k2")).toBe("Advogado");
    expect(cat("k4")).toBe("Não identificado");
    // negative: no category -> generic label, never the raw enum
    expect(cat("k3")).toBe("Contato");
    expect(result.current.participants.some((p) => p.category === "VIDEOMAKER" || p.category === "LAWYER")).toBe(false);
  });
});
