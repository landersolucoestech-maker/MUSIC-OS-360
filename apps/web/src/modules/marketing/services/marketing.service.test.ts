import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";

describe("marketingService production API boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists persisted projects through the API", async () => {
    apiMock.get.mockResolvedValue([{
      id: "project-1",
      type: "CUSTOM",
      title: "Projeto real",
      status: "active",
      priority: "normal",
      metadata: {},
      created_at: "2026-06-20T00:00:00.000Z",
      updated_at: "2026-06-20T00:00:00.000Z",
    }]);

    await expect(marketingService.projects.list()).resolves.toEqual([
      expect.objectContaining({ id: "project-1", name: "Projeto real" }),
    ]);
    expect(apiMock.get).toHaveBeenCalledWith("/marketing/projects?limit=100");
  });

  it("propagates backend failures without fabricating a response", async () => {
    const failure = new Error("API indisponível");
    apiMock.get.mockRejectedValue(failure);
    await expect(marketingService.projects.list()).rejects.toBe(failure);
  });

  it("creates and archives campaigns through persistent endpoints", async () => {
    apiMock.post.mockResolvedValueOnce({
      id: "campaign-1",
      tenantId: "tenant-a",
      name: "Campanha",
      status: "DRAFT",
      validation: { valid: true, errors: [], warnings: [] },
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
    }).mockResolvedValueOnce({ status: "ARCHIVED" });

    const created = await marketingService.campaigns.create({
      name: "Campanha",
      type: "institucional",
      objective: "Alcance",
      audience: "",
      segmentation: "",
      budget: 100,
      startDate: "2026-06-20",
      endDate: "2026-06-30",
      platforms: [],
      status: "rascunho",
      owner: "user-1",
      creativeAssetIds: [],
      contentIds: [],
      metrics: {
        reach: 0, impressions: 0, engagement: 0, clicks: 0,
        conversions: 0, roi: 0, costPerResult: 0,
      },
      notes: "",
    });
    await marketingService.campaigns.remove(created.id);

    expect(apiMock.post).toHaveBeenNthCalledWith(
      1,
      "/marketing/campaigns/draft",
      expect.objectContaining({ name: "Campanha", budgetType: "TOTAL" }),
    );
    expect(apiMock.post).toHaveBeenNthCalledWith(
      2,
      "/marketing/campaigns/campaign-1/archive",
      {},
    );
  });

  it("CODEBASE_MAP #16: campaign metrics default to estimated when the backend never set the flag", async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [{
        id: "campaign-legacy",
        status: "DRAFT",
        metadata: {
          marketingBuilder: {
            payload: { name: "Legada", metrics: { reach: 100, clicks: 10 } },
          },
        },
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      }],
    });

    const [campaign] = await marketingService.campaigns.list();
    expect(campaign.metrics.isEstimated).toBe(true);
  });

  it("CODEBASE_MAP #16: campaign metrics report measured once the backend explicitly says so", async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [{
        id: "campaign-real",
        status: "ACTIVE",
        metadata: {
          marketingBuilder: {
            payload: { name: "Real", metrics: { reach: 100, clicks: 10, isEstimated: false } },
          },
        },
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      }],
    });

    const [campaign] = await marketingService.campaigns.list();
    expect(campaign.metrics.isEstimated).toBe(false);
  });

  it("requires a persisted marketing project when creating tasks", async () => {
    await expect(marketingService.tasks.create({
      title: "Tarefa",
      description: "",
      type: "design",
      status: "a_fazer",
      priority: "media",
      owner: "user-1",
      sector: "marketing",
      deadline: "2026-06-30",
      files: [],
      checklist: [],
      comments: [],
      history: [],
      dependencies: [],
    })).rejects.toThrow("projectId");
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
