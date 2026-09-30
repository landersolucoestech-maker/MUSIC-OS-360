import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { marketingService } from "./marketing.service";
import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_OPTIONS,
  CONTENT_STATUS_TONE,
  CONTENT_TYPE_LABEL,
  CONTENT_TYPE_OPTIONS,
  MARKETING_TARGET_OPTIONS,
} from "../constants/marketing.constants";
import { PLATFORM_FORMATS } from "../config/social-formats";
import { deriveContentDisplayStatus } from "../utils/marketing-content-status";
import { targetTypeFromWire, targetTypeToWire } from "../utils/marketing-content-wire";
import { canonicalApproval } from "../utils/marketing-legacy-vocabulary";
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_OPTIONS, APPROVAL_STATUS_TONE } from "../constants/marketing.constants";
import type { ContentStatus, ContentType, MarketingContent, MarketingTarget } from "../types/marketing.types";

/**
 * Contract with the database/API (chk_marketing_content_posts_status / _target_type /
 * _content_type, migration 20260929000002, and marketing-vocabulary.ts). Duplicated on
 * purpose so a drift on either side fails here.
 */
const DB_STATUSES = ["draft", "scheduled", "published", "cancelled", "failed"] as const;
const DB_TARGET_TYPES = ["music_project", "artist", "company"] as const;
const DB_CONTENT_TYPES = [
  "post", "feed", "stories", "reels", "shorts", "video", "carousel", "ad", "social_media",
  "institutional", "commercial", "artist", "behind_the_scenes", "meeting", "event", "portal",
  "blog", "advertising",
] as const;

function baseContent(over: Partial<MarketingContent> = {}): Omit<MarketingContent, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "Post",
    targetType: "empresa",
    targetName: "Empresa",
    type: "feed",
    channel: "instagram",
    channels: ["instagram", "facebook"],
    status: "scheduled",
    approval: "pending",
    publishDate: "2026-07-01",
    publishTime: "10:00",
    owner: "Marketing",
    copy: "copy",
    notes: "",
    files: [],
    metadata: { creative: { version: 1 } },
    ...over,
  } as Omit<MarketingContent, "id" | "createdAt" | "updatedAt">;
}

/** Echoes a POSTed content body back the way the API's toDto() returns it. */
function dtoFromBody(rawBody: Record<string, unknown>) {
  // JSON serialization drops undefined values, like the real request does.
  const body = JSON.parse(JSON.stringify(rawBody)) as Record<string, unknown>;
  return {
    id: "content-1",
    targetType: "company",
    ...body,
    notes: body.notes ?? "",
    owner: body.owner ?? "Marketing",
    files: body.files ?? [],
    publicationStatus: "queued",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("marketing content vocabulary (S8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the selectable statuses are exactly the persisted CHECK vocabulary", () => {
    expect(CONTENT_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([...DB_STATUSES].sort());
  });

  it("the content type options are exactly the persisted CHECK vocabulary and cover every platform format", () => {
    expect(CONTENT_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual([...DB_CONTENT_TYPES].sort());
    for (const specs of Object.values(PLATFORM_FORMATS)) {
      for (const spec of specs) expect(DB_CONTENT_TYPES).toContain(spec.type);
    }
  });

  it("every status/type has a PT-BR label (never the raw value) and every status a tone", () => {
    for (const status of [...DB_STATUSES, "overdue"] as const) {
      expect(CONTENT_STATUS_LABEL[status]).toBeTruthy();
      expect(CONTENT_STATUS_LABEL[status]).not.toBe(status);
      expect(CONTENT_STATUS_TONE[status]).toBeTruthy();
    }
    for (const type of DB_CONTENT_TYPES) {
      expect(CONTENT_TYPE_LABEL[type as ContentType]).toBeTruthy();
      expect(CONTENT_TYPE_LABEL[type as ContentType]).not.toBe(type);
    }
  });

  it("the web-only pipeline stages are not persisted states", () => {
    const values = CONTENT_STATUS_OPTIONS.map((o) => o.value as string);
    for (const removed of ["ideia", "producao", "revisao", "atrasado", "overdue"]) expect(values).not.toContain(removed);
  });

  it.each(DB_STATUSES)("status %s round-trips web -> API body -> web unchanged", async (status) => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => dtoFromBody(body));
    const created = await marketingService.contents.create(baseContent({ status: status as ContentStatus }));
    expect(apiMock.post.mock.calls[0][1]).toMatchObject({ status });
    expect(created.status).toBe(status);
  });

  it.each(CONTENT_TYPE_OPTIONS.map((o) => o.value))("content type %s round-trips unchanged", async (type) => {
    // Use a platform/type pair the format rules accept; the mapper itself is type-agnostic.
    apiMock.patch.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => dtoFromBody(body));
    const updated = await marketingService.contents.update("content-1", { type: type as ContentType });
    expect(apiMock.patch.mock.calls[0][1]).toMatchObject({ type });
    expect(updated.type).toBe(type);
  });

  it.each(MARKETING_TARGET_OPTIONS.map((o) => o.value))("target %s goes to the API as the English value and comes back", async (target) => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => dtoFromBody(body));
    const created = await marketingService.contents.create(baseContent({ targetType: target as MarketingTarget }));
    const sent = (apiMock.post.mock.calls[0][1] as { targetType: string }).targetType;
    expect(DB_TARGET_TYPES).toContain(sent);
    expect(created.targetType).toBe(target);
  });

  it("targetTypeToWire/FromWire cover every persisted target and reject anything else", () => {
    expect(MARKETING_TARGET_OPTIONS.map((o) => targetTypeToWire(o.value)).sort()).toEqual([...DB_TARGET_TYPES].sort());
    for (const wire of DB_TARGET_TYPES) expect(targetTypeToWire(targetTypeFromWire(wire))).toBe(wire);
    for (const bad of ["empresa", "geral", "", undefined, null, "constructor"]) {
      expect(() => targetTypeFromWire(bad)).toThrow(/unknown content target type/);
    }
    expect(() => targetTypeToWire("constructor" as MarketingTarget)).toThrow(/unknown content target type/);
  });

  it("sends exactly the DTO-accepted keys; approval and channels travel inside metadata", async () => {
    apiMock.post.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => dtoFromBody(body));
    const created = await marketingService.contents.create(baseContent());
    const body = apiMock.post.mock.calls[0][1] as Record<string, unknown>;
    const allowed = ["title", "targetType", "targetName", "channel", "type", "status", "publishDate", "publishTime", "copy", "notes", "owner", "campaignId", "releaseId", "format", "files", "metadata"];
    for (const key of Object.keys(body)) expect(allowed).toContain(key);
    expect(body).not.toHaveProperty("approval");
    expect(body).not.toHaveProperty("channels");
    expect(body.metadata).toEqual({ creative: { version: 1 }, approval: "pending", channels: ["instagram", "facebook"] });
    expect(created.approval).toBe("pending");
    expect(created.channels).toEqual(["instagram", "facebook"]);
  });

  it("a partial update sends only the keys it changes (no blanking of the others)", async () => {
    apiMock.patch.mockImplementationOnce(async (_url: string, body: Record<string, unknown>) => dtoFromBody(body));
    await marketingService.contents.update("content-1", { status: "cancelled" }, "2026-06-20T00:00:00.000Z");
    const body = JSON.parse(JSON.stringify(apiMock.patch.mock.calls[0][1]));
    expect(body).toEqual({ status: "cancelled", expectedUpdatedAt: "2026-06-20T00:00:00.000Z" });
  });

  it("reading an unknown target type from the API fails loudly instead of guessing", async () => {
    apiMock.get.mockResolvedValueOnce([{ ...dtoFromBody({ status: "scheduled" }), targetType: "empresa" }]);
    await expect(marketingService.contents.list()).rejects.toThrow(/unknown content target type received/);
  });
});

/**
 * Contract with chk_marketing_content_posts_metadata_approval (migration
 * 20260930000003) and marketing-vocabulary.ts. Duplicated on purpose so a drift
 * on either side fails here.
 */
const DB_APPROVALS = ["pending", "approved", "rejected", "revision_requested"] as const;

describe("marketing content approval vocabulary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the selectable approvals are exactly the persisted vocabulary, each with a PT-BR label and a tone", () => {
    expect(APPROVAL_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([...DB_APPROVALS].sort());
    for (const approval of DB_APPROVALS) {
      expect(APPROVAL_STATUS_LABEL[approval]).toBeTruthy();
      expect(APPROVAL_STATUS_LABEL[approval]).not.toBe(approval);
      expect(APPROVAL_STATUS_TONE[approval]).toBeTruthy();
    }
  });

  it.each<[string, string]>([
    ["pendente", "pending"],
    ["aprovado", "approved"],
    ["reprovado", "rejected"],
    ["ajustes_solicitados", "revision_requested"],
    ...DB_APPROVALS.map((value): [string, string] => [value, value]),
  ])("canonicalApproval(%s) -> %s", (input, expected) => {
    expect(canonicalApproval(input)).toBe(expected);
  });

  it.each([undefined, null, "", "constructor", "Aprovado", "rejeitado", 3, {}, ["approved"]])(
    "canonicalApproval degrades %s to pending without throwing",
    (value) => {
      expect(canonicalApproval(value)).toBe("pending");
    },
  );

  it("reading a row that still holds a legacy approval (pre-migration build) yields the canonical value", async () => {
    apiMock.get.mockResolvedValueOnce([
      { ...dtoFromBody({ status: "scheduled" }), metadata: { approval: "ajustes_solicitados" } },
      { ...dtoFromBody({ status: "scheduled" }), metadata: { approval: "approved" } },
      { ...dtoFromBody({ status: "scheduled" }), metadata: {} },
    ]);
    const contents = await marketingService.contents.list();
    expect(contents.map((c) => c.approval)).toEqual(["revision_requested", "approved", "pending"]);
  });

  it("one unknown / non-string approval degrades that row to pending and keeps the rest of the list", async () => {
    apiMock.get.mockResolvedValueOnce([
      { ...dtoFromBody({ status: "scheduled" }), metadata: { approval: "unknown_value" } },
      { ...dtoFromBody({ status: "scheduled" }), metadata: { approval: 3 } },
      { ...dtoFromBody({ status: "scheduled" }), metadata: { approval: "approved" } },
    ]);
    const contents = await marketingService.contents.list();
    expect(contents.map((c) => c.approval)).toEqual(["pending", "pending", "approved"]);
  });

  it("an empty-string row approval falls through to metadata.approval like null", async () => {
    apiMock.get.mockResolvedValueOnce([
      { ...dtoFromBody({ status: "scheduled" }), approval: "", metadata: { approval: "rejected" } },
      { ...dtoFromBody({ status: "scheduled" }), approval: null, metadata: { approval: "rejected" } },
      { ...dtoFromBody({ status: "scheduled" }), approval: "", metadata: {} },
    ]);
    const contents = await marketingService.contents.list();
    expect(contents.map((c) => c.approval)).toEqual(["rejected", "rejected", "pending"]);
  });
});

describe("deriveContentDisplayStatus (overdue is derived, never persisted)", () => {
  const now = new Date("2026-07-01T12:00:00");
  const at = (status: ContentStatus, publishDate: string, publishTime: string) => ({ status, publishDate, publishTime });

  it("a scheduled content whose date/time passed is overdue", () => {
    expect(deriveContentDisplayStatus(at("scheduled", "2026-07-01", "11:59"), now)).toBe("overdue");
    expect(deriveContentDisplayStatus(at("scheduled", "2026-06-30T00:00:00.000Z", "23:00"), now)).toBe("overdue");
  });

  it("a scheduled content in the future keeps its status", () => {
    expect(deriveContentDisplayStatus(at("scheduled", "2026-07-01", "12:01"), now)).toBe("scheduled");
  });

  it.each(["draft", "published", "cancelled", "failed"] as const)("%s is never derived to overdue, even when the date passed", (status) => {
    expect(deriveContentDisplayStatus(at(status, "2020-01-01", "10:00"), now)).toBe(status);
  });

  it("an unparseable schedule keeps the persisted status instead of guessing", () => {
    expect(deriveContentDisplayStatus(at("scheduled", "", ""), now)).toBe("scheduled");
  });
});

describe("marketing overview counters use the derived overdue state", () => {
  afterEach(() => vi.useRealTimers());

  it("counts and alerts only scheduled contents past their schedule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00"));
    const content = (id: string, status: string, date: string, time: string) => dtoFromBody({
      id, title: id, targetType: "company", status, publishDate: date, publishTime: time,
    });
    apiMock.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/marketing/contents")) {
        return [
          content("late", "scheduled", "2026-07-01", "09:00"),
          content("future", "scheduled", "2026-07-02", "09:00"),
          content("old-published", "published", "2026-06-01", "09:00"),
        ];
      }
      return [];
    });
    const overview = await marketingService.getDashboard();
    expect(overview.kpis.scheduledContents).toBe(2);
    expect(overview.alerts.filter((a: { id: string }) => a.id.startsWith("content-")).map((a: { id: string }) => a.id)).toEqual(["content-late"]);
  });
});
