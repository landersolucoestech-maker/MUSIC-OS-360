import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";
import type { MarketingCampaign, MarketingTask } from "../types/marketing.types";

const STAMPS = { created_at: "2026-06-20T00:00:00.000Z", updated_at: "2026-06-20T00:00:00.000Z" };

describe("MK2 marketing service: canonical English out, legacy Portuguese accepted in", () => {
  beforeEach(() => vi.clearAllMocks());

  it("projects: reads legacy metadata.uiType/uiStatus/channels as canonical, writes canonical", async () => {
    apiMock.get.mockResolvedValueOnce([{
      id: "p1", type: "MUSIC_PROJECT", title: "P", status: "active", priority: "normal", ...STAMPS,
      metadata: { uiType: "lancamento_musical", uiStatus: "em_andamento", channels: ["instagram", "portal_noticias"] },
    }]);
    const [project] = await marketingService.projects.list();
    expect(project).toMatchObject({ type: "music_release", status: "active", channels: ["instagram", "news_portal"] });

    apiMock.post.mockImplementationOnce(async (_u: string, body: Record<string, unknown>) => ({ id: "p2", ...body, ...STAMPS }));
    await marketingService.projects.create({ ...project, name: "N" } as never);
    const body = apiMock.post.mock.calls[0][1] as { type: string; status: string; metadata: Record<string, unknown> };
    expect(body).toMatchObject({ type: "MUSIC_PROJECT", status: "active" });
    expect(body.metadata).toMatchObject({ uiType: "music_release", uiStatus: "active", channels: ["instagram", "news_portal"] });
  });

  it("tasks: reads legacy kind/targetType, writes canonical kind + metadata.targetType/uiType", async () => {
    apiMock.get.mockResolvedValueOnce([{
      id: "t1", marketing_project_id: "p1", title: "T", status: "pending", priority: "normal", kind: "capa", ...STAMPS,
      metadata: { targetType: "projeto_musical", uiType: "arte_divulgacao" },
    }, {
      id: "t2", marketing_project_id: "p1", title: "T2", status: "pending", priority: "normal", kind: "cover_art", ...STAMPS, metadata: {},
    }]);
    const [legacy, apiCreated] = await marketingService.tasks.list();
    expect(legacy).toMatchObject({ type: "promotional_art", targetType: "music_project" });
    expect(apiCreated.type).toBe("cover_art"); // API-created kinds outside the web catalog are kept

    apiMock.post.mockImplementationOnce(async (_u: string, body: Record<string, unknown>) => ({ id: "t3", marketing_project_id: "p1", ...body, ...STAMPS }));
    await marketingService.tasks.create({ ...legacy, type: "behind_the_scenes_shot", targetType: "artist" } as Omit<MarketingTask, "id" | "createdAt" | "updatedAt">);
    const body = apiMock.post.mock.calls[0][1] as { kind: string; metadata: Record<string, unknown> };
    expect(body.kind).toBe("behind_the_scenes_shot");
    expect(body.metadata).toMatchObject({ targetType: "artist", uiType: "behind_the_scenes_shot" });
  });

  it("campaigns: reads legacy payload type/promotedEntityType/platforms, sends the canonical API entity type", async () => {
    apiMock.get.mockResolvedValueOnce({ data: [{
      id: "c1", status: "DRAFT", ...STAMPS,
      metadata: { marketingBuilder: { payload: { name: "C", type: "trafego_pago", promotedEntityType: "EMPRESA", platforms: ["instagram", "campanha"] } } },
    }] });
    const [campaign] = await marketingService.campaigns.list();
    expect(campaign).toMatchObject({ type: "paid_traffic", targetType: "company", platforms: ["instagram", "campaign"] });

    apiMock.post.mockImplementationOnce(async () => ({ id: "c2", status: "DRAFT", ...STAMPS }));
    await marketingService.campaigns.create(campaign as Omit<MarketingCampaign, "id" | "createdAt" | "updatedAt">);
    const body = apiMock.post.mock.calls[0][1] as { promotedEntityType: string; type: string; platforms: string[] };
    expect(body).toMatchObject({ promotedEntityType: "COMPANY", type: "paid_traffic", platforms: ["instagram", "campaign"] });
  });

  it("briefings: reads legacy metadata.type/channels as canonical", async () => {
    apiMock.get.mockResolvedValueOnce([{ id: "b1", title: "B", status: "draft", metadata: { type: "portal_noticias", channels: ["reuniao"] }, ...STAMPS }]);
    const [briefing] = await marketingService.briefings.list();
    expect(briefing).toMatchObject({ type: "news_portal", channels: ["meeting"] });
  });

  it("ai suggestions: reads legacy kind/targetType/channels as canonical", async () => {
    apiMock.get.mockResolvedValueOnce([{ id: "a1", kind: "analise_artista", targetType: "artista", channels: ["bastidores"], prompt: "x", output: [], at: "2026-06-20T00:00:00.000Z" }]);
    const [suggestion] = await marketingService.getAiSuggestions();
    expect(suggestion).toMatchObject({ kind: "artist_analysis", targetType: "artist", channels: ["behind_the_scenes"] });
  });

  it("contents: reads legacy metadata.channels as canonical", async () => {
    apiMock.get.mockResolvedValueOnce([{
      id: "x1", targetType: "company", status: "scheduled", type: "post", channel: "instagram", publishDate: "2026-07-01", publishTime: "10:00",
      metadata: { channels: ["instagram", "portal_noticias"] }, createdAt: STAMPS.created_at, updatedAt: STAMPS.updated_at,
    }]);
    const [content] = await marketingService.contents.list();
    expect(content.channels).toEqual(["instagram", "news_portal"]);
  });
});
