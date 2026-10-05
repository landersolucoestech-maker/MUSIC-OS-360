// HR page: the employees list comes from the employees data layer (useEmployees -> storage.list("employees")
// plus the paginated read). While it loads the page shows only the spinner; once loaded it renders the page
// and the employee rows.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { storage } from "@/shared/lib/storage";
import { api } from "@/shared/lib/api-client";
import HR from "./HR";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn(), listPaged: vi.fn(), findById: vi.fn() } };
});
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/api-client")>("@/shared/lib/api-client");
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div data-testid="main-layout">{title ? <h1>{title}</h1> : null}{children}</div>
  ),
}));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: [], isLoading: false }) }));

const EMPLOYEES = [
  { id: "e1", name: "Maria Souza", department: "Financeiro", status: "active" },
  { id: "e2", name: "João Lima", department: "Marketing", status: "inactive" },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HR />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HR page employees loading", () => {
  beforeEach(() => {
    vi.mocked(storage.list).mockReset();
    vi.mocked(storage.listPaged).mockReset();
    vi.mocked(storage.findById).mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ total: 0, byGroup: {} });
    vi.mocked(storage.listPaged).mockImplementation((async (table: string, o: { pageSize: number }) =>
      table === "employees"
        ? { items: EMPLOYEES, page: 1, pageSize: o.pageSize, total: EMPLOYEES.length, totalPages: 1 }
        : { items: [], page: 1, pageSize: o.pageSize, total: 0, totalPages: 1 }) as typeof storage.listPaged);
  });

  it("holds the page on the spinner while the employees list loads, then shows the page and the employees", async () => {
    let resolveEmployees: (rows: never[]) => void = () => undefined;
    vi.mocked(storage.list).mockImplementation(((table: string) =>
      table === "employees"
        ? new Promise((resolve) => { resolveEmployees = resolve; })
        : Promise.resolve([])) as typeof storage.list);

    renderPage();
    await waitFor(() => expect(vi.mocked(storage.list).mock.calls.some(([t]) => t === "employees")).toBe(true));
    expect(screen.queryByText("Recursos Humanos")).toBeNull();
    expect(screen.queryByText("Maria Souza")).toBeNull();

    await act(async () => { resolveEmployees(EMPLOYEES as never[]); });
    expect(await screen.findByText("Recursos Humanos")).toBeInTheDocument();
    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("João Lima")).toBeInTheDocument();
  });
});
