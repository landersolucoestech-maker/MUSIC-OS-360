// LeaveRequestFormModal reads the employees data layer (useEmployees -> storage.list("employees")):
// while it loads the employee picker says "Carregando…", once loaded it offers "Selecione o funcionário".
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { storage } from "@/shared/lib/storage";
import { LeaveRequestFormModal } from "./LeaveRequestFormModal";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn(), listPaged: vi.fn(), findById: vi.fn() } };
});

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LeaveRequestFormModal open onOpenChange={() => undefined} mode="create" />
    </QueryClientProvider>,
  );
}

describe("LeaveRequestFormModal employees loading state", () => {
  beforeEach(() => {
    vi.mocked(storage.list).mockReset();
    vi.mocked(storage.listPaged).mockReset();
    vi.mocked(storage.findById).mockReset();
    vi.mocked(storage.listPaged).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 } as never);
  });

  it("shows 'Carregando…' while employees load and the select prompt once they arrived", async () => {
    let resolveEmployees: (rows: never[]) => void = () => undefined;
    vi.mocked(storage.list).mockImplementation(((table: string) =>
      table === "employees"
        ? new Promise((resolve) => { resolveEmployees = resolve; })
        : Promise.resolve([])) as typeof storage.list);

    renderModal();
    const picker = await screen.findByTestId("select-employee-id");
    expect(picker).toHaveTextContent("Carregando…");
    expect(picker).not.toHaveTextContent("Selecione o funcionário");

    await act(async () => { resolveEmployees([{ id: "e1", name: "Maria Souza" }] as never[]); });
    await waitFor(() => expect(screen.getByTestId("select-employee-id")).toHaveTextContent("Selecione o funcionário"));
    expect(screen.getByTestId("select-employee-id")).not.toHaveTextContent("Carregando…");
    expect(vi.mocked(storage.list).mock.calls.some(([t]) => t === "employees")).toBe(true);
  });
});
