import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";
import {
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  PRIORITY_TONE,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABEL,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
} from "../constants/marketing.constants";
import { canonicalPriority } from "../utils/marketing-legacy-vocabulary";
import type { MarketingTask, Priority, TaskStatus } from "../types/marketing.types";

/**
 * Contract with the database: chk_marketing_tasks_status / chk_marketing_tasks_priority
 * (migrations 20260719000009 + 20260929000001). The web vocabulary IS the persisted
 * vocabulary -- these lists are duplicated on purpose so a drift on either side fails here.
 */
const DB_TASK_STATUSES = ["backlog", "pending", "in_progress", "review", "blocked", "done", "cancelled"] as const;
const DB_TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function baseTask(over: Partial<MarketingTask>): Omit<MarketingTask, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "Tarefa",
    description: "",
    type: "design",
    status: "pending",
    priority: "normal",
    owner: "user-1",
    sector: "marketing",
    deadline: "2026-06-30",
    projectId: "project-1",
    files: [],
    checklist: [],
    comments: [],
    history: [],
    dependencies: [],
    ...over,
  } as Omit<MarketingTask, "id" | "createdAt" | "updatedAt">;
}

/** Echoes a POSTed task body back the way the API persists it. */
function rowFromBody(body: Record<string, unknown>) {
  return {
    id: "task-1",
    marketing_project_id: body.marketingProjectId,
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    kind: body.kind,
    assigned_to: body.assignedTo,
    due_date: body.dueDate,
    dependencies: body.dependencies,
    metadata: body.metadata,
    created_at: "2026-06-20T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
  };
}

describe("marketing task vocabulary (S7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the web option lists are exactly the persisted CHECK vocabulary", () => {
    expect(TASK_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([...DB_TASK_STATUSES].sort());
    expect(PRIORITY_OPTIONS.map((o) => o.value).sort()).toEqual([...DB_TASK_PRIORITIES].sort());
  });

  it("every canonical value has a PT-BR label and a tone; labels are never the raw value", () => {
    for (const status of DB_TASK_STATUSES) {
      expect(TASK_STATUS_LABEL[status]).toBeTruthy();
      expect(TASK_STATUS_LABEL[status]).not.toBe(status);
      expect(TASK_STATUS_TONE[status]).toBeTruthy();
    }
    for (const priority of DB_TASK_PRIORITIES) {
      expect(PRIORITY_LABEL[priority]).toBeTruthy();
      expect(PRIORITY_LABEL[priority]).not.toBe(priority);
      expect(PRIORITY_TONE[priority]).toBeTruthy();
    }
  });

  it("backlog is a distinct board column before 'to do'", () => {
    expect(TASK_BOARD_COLUMNS.slice(0, 2)).toEqual(["backlog", "pending"]);
    expect(TASK_STATUS_LABEL.backlog).not.toBe(TASK_STATUS_LABEL.pending);
  });

  it.each(DB_TASK_STATUSES)("status %s round-trips web -> API body -> web unchanged", async (status) => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => rowFromBody(body));
    const created = await marketingService.tasks.create(baseTask({ status: status as TaskStatus }));
    expect(apiMock.post.mock.calls[0][1]).toMatchObject({ status });
    expect(created.status).toBe(status);
  });

  it.each(DB_TASK_PRIORITIES)("priority %s round-trips web -> API body -> web unchanged", async (priority) => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => rowFromBody(body));
    const created = await marketingService.tasks.create(baseTask({ priority: priority as Priority }));
    expect(apiMock.post.mock.calls[0][1]).toMatchObject({ priority });
    expect(created.priority).toBe(priority);
  });

  it("never sends the Portuguese UI vocabulary nor a shadow uiStatus/uiPriority copy", async () => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => rowFromBody(body));
    await marketingService.tasks.create(baseTask({ status: "in_progress", priority: "high" }));
    const body = apiMock.post.mock.calls[0][1] as { metadata: Record<string, unknown> };
    expect(body.metadata).not.toHaveProperty("uiStatus");
    expect(body.metadata).not.toHaveProperty("uiPriority");
  });

  it("reads status/priority from the persisted columns only", async () => {
    apiMock.get.mockResolvedValueOnce([
      { ...rowFromBody({ title: "t", status: "done", priority: "urgent", marketingProjectId: "p" }), metadata: { uiStatus: "a_fazer", uiPriority: "baixa" } },
    ]);
    const [task] = await marketingService.tasks.list();
    expect(task.status).toBe("done");
    expect(task.priority).toBe("urgent");
  });
});

describe("canonicalPriority (deprecated read of legacy project rows)", () => {
  it.each([
    ["baixa", "low"],
    ["media", "normal"],
    ["alta", "high"],
    ["urgente", "urgent"],
    ["low", "low"],
    ["normal", "normal"],
    ["high", "high"],
    ["urgent", "urgent"],
  ])("%s -> %s", (input, expected) => {
    expect(canonicalPriority(input)).toBe(expected);
  });

  it.each([undefined, null, "", "constructor", "Alta", "critical"])("rejects %s instead of guessing a default", (value) => {
    expect(() => canonicalPriority(value)).toThrow(/unknown priority/);
  });

  it("projects list translates legacy Portuguese rows and passes canonical rows through", async () => {
    apiMock.get.mockResolvedValueOnce([
      { id: "p1", type: "CUSTOM", title: "Legado", status: "active", priority: "alta", metadata: { uiPriority: "alta" }, created_at: "2026-06-20T00:00:00.000Z", updated_at: "2026-06-20T00:00:00.000Z" },
      { id: "p2", type: "CUSTOM", title: "Novo", status: "active", priority: "urgent", metadata: {}, created_at: "2026-06-20T00:00:00.000Z", updated_at: "2026-06-20T00:00:00.000Z" },
    ]);
    const projects = await marketingService.projects.list();
    expect(projects.map((p) => p.priority)).toEqual(["high", "urgent"]);
  });
});

describe("marketing overview task counters use the canonical statuses", () => {
  it("pendingTasks excludes done and cancelled; blocked tasks raise a warning", async () => {
    const task = (id: string, status: string) => ({
      ...rowFromBody({ title: id, status, priority: "normal", marketingProjectId: "p" }),
      id,
    });
    apiMock.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/marketing/tasks")) {
        return ["backlog", "pending", "in_progress", "review", "blocked", "done", "cancelled"].map((status) => task(`t-${status}`, status));
      }
      return [];
    });
    const dashboard = await marketingService.getDashboard();
    expect(dashboard.kpis.pendingTasks).toBe(5);
    expect(dashboard.alerts.map((a: { id: string }) => a.id)).toEqual(["task-t-blocked"]);
  });
});
