import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_OPTIONS, CAMPAIGN_STATUS_TONE } from "../constants/marketing.constants";

const campaignRow = (id: string, status: string) => ({
  id,
  status,
  metadata: { marketingBuilder: { payload: { name: id } } },
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
});

/** Real wire: the campaign-builder API returns upper-case English lifecycle statuses. */
const WIRE = ["DRAFT", "ACTIVE", "ACTIVE", "SCHEDULED", "PAUSED", "COMPLETED"];

function mockApi(statuses: string[]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url.startsWith("/marketing/campaigns")) return { data: statuses.map((s, i) => campaignRow(`c${i}`, s)) };
    return [];
  });
}

describe("R2-01 campaign status: API enum -> web canonical English (end to end)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("campaignFromApi yields canonical English statuses that exist in the web option/label tables", async () => {
    mockApi(WIRE);
    const list = await marketingService.campaigns.list();
    expect(list.map((c) => c.status)).toEqual(["draft", "active", "active", "scheduled", "paused", "completed"]);
    for (const c of list) {
      expect(CAMPAIGN_STATUS_LABEL[c.status]).toBeTruthy();
      expect(CAMPAIGN_STATUS_TONE[c.status]).toBeTruthy();
    }
    expect(CAMPAIGN_STATUS_OPTIONS.map((o) => o.value)).toEqual(expect.arrayContaining(["draft", "scheduled", "active", "paused", "completed", "cancelled"]));
  });

  it("dashboard KPI counts the active campaigns (was always 0)", async () => {
    mockApi(WIRE);
    const dashboard = await marketingService.getDashboard();
    expect(dashboard.kpis.activeCampaigns).toBe(2);
  });

  it("analytics runningCampaigns counts the active campaigns (was always 0)", async () => {
    mockApi(WIRE);
    const overview = await marketingService.getAnalytics();
    expect(overview.totals.runningCampaigns).toBe(2);
  });

  it("legacy Portuguese statuses on a row are read as the canonical value (dual-read)", async () => {
    mockApi(["ativa", "rascunho", "agendada", "pausada", "concluida", "cancelada"]);
    const list = await marketingService.campaigns.list();
    expect(list.map((c) => c.status)).toEqual(["active", "draft", "scheduled", "paused", "completed", "cancelled"]);
  });
});
