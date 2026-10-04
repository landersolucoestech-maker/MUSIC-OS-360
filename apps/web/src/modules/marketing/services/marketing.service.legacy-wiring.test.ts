import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";

describe("marketingService legacy metadata wiring", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it("tasks.list canonicalises legacy sector label and automation flow id", async () => {
    apiMock.get.mockResolvedValue([
      { id: "t1", title: "T1", status: "pending", priority: "normal", metadata: { sector: "Comunicação", automationFlowId: "flow-lancamento" } },
      { id: "t2", title: "T2", status: "pending", priority: "normal", metadata: { sector: "Administração Musical", automationFlowId: "flow-produto-saas" } },
    ]);
    const tasks = await marketingService.tasks.list();
    expect(tasks.map((t) => t.sector)).toEqual(["communication", "music_administration"]);
    expect(tasks.map((t) => t.automationFlowId)).toEqual(["flow-music-release", "flow-product-saas"]);
  });

  it("tasks.list keeps canonical and tenant-typed values, empty sector and undefined flow when absent", async () => {
    apiMock.get.mockResolvedValue([
      { id: "t3", title: "T3", status: "pending", priority: "normal", metadata: { sector: "design", automationFlowId: "flow-custom" } },
      { id: "t4", title: "T4", status: "pending", priority: "normal", metadata: { sector: "Setor Livre" } },
      { id: "t5", title: "T5", status: "pending", priority: "normal" },
    ]);
    const tasks = await marketingService.tasks.list();
    expect(tasks.map((t) => t.sector)).toEqual(["design", "Setor Livre", ""]);
    expect(tasks.map((t) => t.automationFlowId)).toEqual(["flow-custom", undefined, undefined]);
  });

  it("assets.list canonicalises the legacy source department slug", async () => {
    apiMock.get.mockResolvedValue([
      { id: "a1", title: "A1", metadata: { sourceDepartment: "conteudo" } },
      { id: "a2", title: "A2", metadata: { sourceDepartment: "operacoes" } },
      { id: "a3", title: "A3", metadata: { sourceDepartment: "legal" } },
      { id: "a4", title: "A4", metadata: {} },
    ]);
    const assets = await marketingService.assets.list();
    expect(assets.map((a) => a.sourceDepartment)).toEqual(["content", "operations", "legal", undefined]);
  });
});
