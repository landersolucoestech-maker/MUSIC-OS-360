import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const stored = vi.hoisted(() => ({ lists: [] as Record<string, unknown>[], tasks: [] as Record<string, unknown>[] }));

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: { getOperationalLists: () => stored.lists, saveOperationalLists: vi.fn() },
}));
vi.mock("../hooks/useMarketingTasks", () => ({
  useMarketingTasks: () => ({ data: stored.tasks, isLoading: false }),
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../hooks/useMarketingProjects", () => ({ useMarketingProjects: () => ({ data: [] }) }));
vi.mock("@/shared/lib/fetch-all-labels", () => ({ fetchAllLabels: vi.fn().mockResolvedValue([]) }));
vi.mock("@/shared/hooks/useSkillRun", () => ({ useSkillRun: () => ({}) }));
vi.mock("@/shared/components/SkillRunPanel", () => ({ SkillRunPanel: () => null }));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: ReactNode; children?: ReactNode }) => <div>{actions}{children}</div>,
}));
type Option = { value: string; label: string };
type Field = { name: string; options?: Option[]; computeOptions?: (values: Record<string, unknown>) => Option[] };
vi.mock("../components", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    MarketingFilters: () => null,
    MarketingFormModal: ({ open, fields }: { open: boolean; fields: Field[] }) =>
      open ? (
        <div data-testid="form-modal">
          {fields.map((f) => (
            <div key={f.name} data-testid={`form-field-${f.name}`}>
              {(f.options ?? f.computeOptions?.({}) ?? []).map((o) => `${o.value}=${o.label}`).join("|")}
            </div>
          ))}
        </div>
      ) : null,
  };
});

import Tasks from "./Tasks";

beforeEach(() => {
  stored.lists = [];
  stored.tasks = [];
});

const item = (kind: string, slug: string, name: string, order: number) => ({
  id: `${kind}-${slug}`, kind, name, slug, description: "", active: true, order,
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tasks /></QueryClientProvider>);
  fireEvent.click(screen.getAllByRole("button", { name: /Nova Tarefa/ })[0]);
};
const formField = (name: string) => screen.getByTestId(`form-field-${name}`).textContent ?? "";

// The create form takes its context / sector / task type options from the operational settings.
describe("Tasks page options from the operational settings", () => {
  it("offers the platform default options when nothing is stored", () => {
    renderPage();
    expect(formField("targetType")).toContain("music_project=Projeto Musical");
    expect(formField("sector")).toContain("communication=Comunicação");
    expect(formField("type")).toContain("campaign=Campanha");
  });

  it("reads stored legacy-slug defaults under their canonical slug", () => {
    stored.lists = [
      item("marketing_context", "projeto_musical", "Projeto Musical", 10),
      item("marketing_context", "artista", "Artista", 20),
      item("marketing_sector", "Comunicação", "Comunicação", 10),
      item("marketing_task_type", "campanha", "Campanha", 10),
    ];
    renderPage();
    const context = formField("targetType");
    expect(context).toContain("music_project=Projeto Musical");
    expect(context).toContain("artist=Artista");
    expect(context).not.toContain("projeto_musical=");
    expect(context).not.toContain("artista=");
    const sector = formField("sector");
    expect(sector).toContain("communication=Comunicação");
    expect(sector).not.toContain("Comunicação=");
    const taskType = formField("type");
    expect(taskType).toContain("campaign=Campanha");
    expect(taskType).not.toContain("campanha=");
  });

  it("keeps tenant-authored options untouched and labels a tenant-defined sector in the table", () => {
    stored.lists = [item("marketing_sector", "my_sector", "My Custom Sector", 5), item("marketing_task_type", "campanha", "Minha campanha", 5)];
    stored.tasks = [{ id: "t1", title: "Task One", type: "campaign", status: "pending", priority: "medium", sector: "my_sector", owner: "Owner", targetType: "company", targetName: "Co" }];
    renderPage();
    expect(formField("sector")).toContain("my_sector=My Custom Sector");
    expect(formField("type")).toContain("campanha=Minha campanha");
    expect(screen.getByText("My Custom Sector")).toBeTruthy();
  });
});
