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
import {
  canonicalAiTaskKind,
  canonicalApproval,
  canonicalAssetCategory,
  canonicalAudienceGender,
  canonicalAutomationFlowId,
  canonicalBriefingType,
  canonicalBudgetStrategy,
  canonicalCampaignPhase,
  canonicalCampaignStatus,
  canonicalCampaignType,
  canonicalContentChannel,
  canonicalContentChannels,
  canonicalCreativeType,
  canonicalMarketingSector,
  canonicalMarketingTarget,
  canonicalPriority,
  canonicalProjectStatus,
  canonicalProjectType,
  canonicalSourceDepartment,
  canonicalTaskType,
  parseCampaignBuilderNotes,
} from "../utils/marketing-legacy-vocabulary";
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
    for (const bad of ["geral", "", undefined, null, "constructor"]) {
      expect(() => targetTypeFromWire(bad)).toThrow(/unknown content target type/);
    }
    expect(() => targetTypeToWire("constructor" as MarketingTarget)).toThrow(/unknown content target type/);
  });

  it("accepts the deprecated Portuguese target spelling on read only (dual-read, canonical out)", () => {
    expect(targetTypeFromWire("projeto_musical")).toBe("music_project");
    expect(targetTypeFromWire("artista")).toBe("artist");
    expect(targetTypeFromWire("empresa")).toBe("company");
    expect(() => targetTypeToWire("empresa" as MarketingTarget)).not.toThrow();
    expect(targetTypeToWire("empresa" as MarketingTarget)).toBe("company");
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
    apiMock.get.mockResolvedValueOnce([{ ...dtoFromBody({ status: "scheduled" }), targetType: "geral" }]);
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

/**
 * Exhaustive legacy -> canonical tables of the compatibility reader. The legacy spellings are listed here
 * statically (NOT derived from the module under test): dropping or renaming any one entry in the reader fails
 * the matching row, and a canonical value must pass through unchanged.
 */
type Row = [legacy: string, canonical: string];
const PRIORITY: Row[] = [["baixa", "low"], ["media", "normal"], ["alta", "high"], ["urgente", "urgent"]];
const CAMPAIGN_STATUS: Row[] = [["rascunho", "draft"], ["agendada", "scheduled"], ["ativa", "active"], ["pausada", "paused"], ["concluida", "completed"], ["cancelada", "cancelled"]];
const TARGET: Row[] = [["projeto_musical", "music_project"], ["artista", "artist"], ["empresa", "company"]];
const PROJECT_TYPE: Row[] = [
  ["lancamento_musical", "music_release"], ["videoclipe", "music_video"], ["campanha_institucional", "institutional_campaign"],
  ["campanha_promocional", "promotional_campaign"], ["evento", "event"], ["conteudo_corporativo", "corporate_content"],
  ["bastidores", "behind_the_scenes"], ["reuniao", "meeting"], ["divulgacao_produto", "product_promotion"],
  ["divulgacao_servico", "service_promotion"], ["divulgacao_saas", "saas_promotion"], ["comunicacao_interna", "internal_communication"],
  ["comunicacao_externa", "external_communication"], ["portal_noticias", "news_portal"], ["projeto_especial", "special_project"],
];
const PROJECT_STATUS: Row[] = [["planejamento", "planning"], ["em_andamento", "active"], ["pausado", "paused"], ["concluido", "completed"], ["cancelado", "cancelled"]];
const CAMPAIGN_TYPE: Row[] = [
  ["institucional", "institutional"], ["comercial", "commercial"], ["artistica", "artistic"], ["promocional", "promotional"],
  ["lancamento_musical", "music_release"], ["produto", "product"], ["servico", "service"], ["evento", "event"],
  ["conteudo", "content"], ["trafego_pago", "paid_traffic"], ["organica", "organic"],
];
const BRIEFING_TYPE: Row[] = [
  ["campanha", "campaign"], ["conteudo", "content"], ["institucional", "institutional"], ["comercial", "commercial"],
  ["artistico", "artistic"], ["evento", "event"], ["produto", "product"], ["servico", "service"],
  ["portal_noticias", "news_portal"], ["bastidores", "behind_the_scenes"],
];
const CONTENT_CHANNEL: Row[] = [
  ["portal_noticias", "news_portal"], ["campanha", "campaign"], ["material_publicitario", "advertising_material"],
  ["evento_interno", "internal_event"], ["evento_externo", "external_event"], ["reuniao", "meeting"], ["bastidores", "behind_the_scenes"],
];
const TASK_TYPE: Row[] = [
  ["publicacao", "publishing"], ["campanha", "campaign"], ["planejamento", "planning"], ["aprovacao", "approval"], ["revisao", "review"],
  ["analise", "analysis"], ["reuniao", "meeting"], ["bastidor", "behind_the_scenes_shot"], ["conteudo_institucional", "institutional_content"],
  ["conteudo_comercial", "commercial_content"], ["conteudo_artistico", "artistic_content"], ["trafego_pago", "paid_traffic"], ["capa", "cover"],
  ["arte_redes_sociais", "social_media_art"], ["identidade_visual", "visual_identity"], ["material_promocional", "promotional_material"],
  ["videoclipe", "music_video"], ["video_redes_sociais", "social_media_video"], ["bastidores", "behind_the_scenes"], ["entrevista", "interview"],
  ["captacao_evento", "event_coverage"], ["prospeccao", "prospecting"], ["negociacao", "negotiation"], ["relacionamento", "relationship"],
  ["planejamento_lancamento", "release_planning"], ["material_institucional", "institutional_material"], ["apresentacao_comercial", "commercial_presentation"],
  ["video_institucional", "institutional_video"], ["bastidores_empresa", "company_behind_the_scenes"], ["cobertura_evento_corporativo", "corporate_event_coverage"],
  ["entrevista_corporativa", "corporate_interview"], ["campanha_institucional", "institutional_campaign"], ["posicionamento_marca", "brand_positioning"],
  ["comunicados", "announcements"], ["relacionamento_parceiros", "partner_relationship"], ["parcerias", "partnerships"], ["planejamento_carreira", "career_planning"],
  ["gestao_agenda", "schedule_management"], ["planejamento_estrategico", "strategic_planning"], ["assessoria_imprensa", "press_relations"],
  ["branding_pessoal", "personal_branding"], ["posicionamento", "positioning"], ["estrategias_crescimento", "growth_strategies"], ["sessao_fotos", "photo_session"],
  ["conteudo_redes_sociais", "social_media_content"], ["contratacoes", "contracting"], ["arte_divulgacao", "promotional_art"], ["conteudo_lancamento", "release_content"],
  ["distribuicao", "distribution"], ["campanha_lancamento", "release_campaign"], ["divulgacao", "promotion"], ["influenciadores", "influencers"], ["aprovacao_conteudo", "content_approval"],
];
const AI_TASK_KIND: Row[] = [
  ["analise_fonograma", "phonogram_analysis"], ["analise_letra", "lyrics_analysis"], ["planejamento_campanha", "campaign_planning"], ["sugestao_conteudo", "content_suggestion"],
  ["legenda", "caption"], ["roteiro", "script"], ["analise_artista", "artist_analysis"], ["analise_marca", "brand_analysis"], ["analise_empresa", "company_analysis"],
  ["pitch_playlist", "playlist_pitch"], ["pitch_imprensa", "press_pitch"], ["posicionamento", "positioning"], ["calendario_editorial", "editorial_calendar"],
  ["conteudo_bastidores", "behind_the_scenes_content"], ["conteudo_corporativo", "corporate_content"],
];
const ASSET_CATEGORY: Row[] = [
  ["capa", "cover"], ["arte_promocional", "promotional_art"], ["identidade_visual", "visual_identity"], ["fotografia", "photography"],
  ["documento_estrategico", "strategic_document"], ["material_institucional", "institutional_material"], ["material_comercial", "commercial_material"],
  ["material_bastidores", "behind_the_scenes_material"], ["material_reuniao", "meeting_material"], ["arquivo_portal", "portal_file"], ["asset_campanha", "campaign_asset"],
];
const CAMPAIGN_PHASE: Row[] = [["pre_lancamento", "pre_launch"], ["lancamento", "launch"], ["sustentacao", "sustain"], ["catalogo", "catalog"]];
const CREATIVE_TYPE: Row[] = [["imagem", "image"], ["carrossel", "carousel"], ["texto", "text"]];
const BUDGET_STRATEGY: Row[] = [["menor_custo", "lowest_cost"], ["limite_custo", "cost_cap"], ["custo_alvo", "target_cost"]];
const AUDIENCE_GENDER: Row[] = [["todos", "all"], ["feminino", "female"], ["masculino", "male"], ["nao_binario", "non_binary"], ["nao_informado", "not_informed"]];
const SECTOR: Row[] = [
  ["Design", "design"], ["Audiovisual", "audiovisual"], ["Marketing", "marketing"], ["Comunicação", "communication"], ["Comercial", "commercial"],
  ["Administração Musical", "music_administration"], ["Distribuição Digital", "digital_distribution"], ["CRM", "crm"],
];
const FLOW_ID: Row[] = [
  ["flow-lancamento", "flow-music-release"], ["flow-conteudo-corporativo", "flow-corporate-content"], ["flow-bastidores", "flow-behind-the-scenes"],
  ["flow-evento", "flow-event"], ["flow-produto-saas", "flow-product-saas"],
];
const SOURCE_DEPARTMENT: Row[] = [["conteudo", "content"], ["operacoes", "operations"]];

describe("marketing legacy vocabulary: every deprecated spelling is read, the canonical value passes through", () => {
  type Reader = [name: string, fn: (value: unknown) => unknown, rows: Row[], canonicalSample: string];
  const readers: Reader[] = [
    ["canonicalPriority", canonicalPriority, PRIORITY, "high"],
    ["canonicalCampaignStatus", canonicalCampaignStatus, CAMPAIGN_STATUS, "active"],
    ["canonicalMarketingTarget", canonicalMarketingTarget, TARGET, "artist"],
    ["canonicalProjectType", canonicalProjectType, PROJECT_TYPE, "event"],
    ["canonicalProjectStatus", canonicalProjectStatus, PROJECT_STATUS, "active"],
    ["canonicalCampaignType", canonicalCampaignType, CAMPAIGN_TYPE, "event"],
    ["canonicalBriefingType", canonicalBriefingType, BRIEFING_TYPE, "event"],
    ["canonicalContentChannel", canonicalContentChannel, CONTENT_CHANNEL, "instagram"],
    ["canonicalTaskType", canonicalTaskType, TASK_TYPE, "publishing"],
    ["canonicalAiTaskKind", canonicalAiTaskKind, AI_TASK_KIND, "caption"],
    ["canonicalAssetCategory", canonicalAssetCategory, ASSET_CATEGORY, "cover"],
    ["canonicalCampaignPhase", canonicalCampaignPhase, CAMPAIGN_PHASE, "launch"],
    ["canonicalCreativeType", canonicalCreativeType, CREATIVE_TYPE, "image"],
    ["canonicalBudgetStrategy", canonicalBudgetStrategy, BUDGET_STRATEGY, "cost_cap"],
    ["canonicalAudienceGender", canonicalAudienceGender, AUDIENCE_GENDER, "female"],
    ["canonicalMarketingSector", canonicalMarketingSector, SECTOR, "design"],
    ["canonicalAutomationFlowId", canonicalAutomationFlowId, FLOW_ID, "flow-event"],
    ["canonicalSourceDepartment", canonicalSourceDepartment, SOURCE_DEPARTMENT, "content"],
  ];

  for (const [name, fn, rows, canonicalSample] of readers) {
    it.each(rows)(`${name}(%s) -> %s`, (legacy, canonical) => {
      expect(fn(legacy)).toBe(canonical);
    });
    it(`${name} keeps a canonical value unchanged`, () => {
      expect(fn(canonicalSample)).toBe(canonicalSample);
    });
  }

  it.each(PRIORITY)("canonicalPriority throws on an unknown value but accepts the legacy %s", (legacy) => {
    expect(() => canonicalPriority(legacy)).not.toThrow();
    expect(() => canonicalPriority("Alta")).toThrow(/unknown priority/);
  });

  it("canonicalCampaignStatus trims and lower-cases legacy spellings and defaults unknown values to draft", () => {
    for (const [legacy, canonical] of CAMPAIGN_STATUS) expect(canonicalCampaignStatus(`  ${legacy.toUpperCase()} `)).toBe(canonical);
    expect(canonicalCampaignStatus("nope")).toBe("draft");
    expect(canonicalCampaignStatus(undefined)).toBe("draft");
  });

  it("canonicalMarketingTarget accepts the upper-case wire spelling of a legacy value", () => {
    for (const [legacy, canonical] of TARGET) expect(canonicalMarketingTarget(legacy.toUpperCase())).toBe(canonical);
  });

  it("the resolve-based readers never guess: an unknown or non-string value is undefined", () => {
    for (const fn of [canonicalProjectType, canonicalProjectStatus, canonicalCampaignType, canonicalBriefingType, canonicalContentChannel, canonicalAssetCategory, canonicalCampaignPhase, canonicalCreativeType, canonicalBudgetStrategy, canonicalAudienceGender]) {
      expect(fn("not_a_value")).toBeUndefined();
      expect(fn(3)).toBeUndefined();
    }
  });

  it("canonicalContentChannels maps legacy entries and keeps unknown ones as received", () => {
    expect(canonicalContentChannels(CONTENT_CHANNEL.map(([legacy]) => legacy))).toEqual(CONTENT_CHANNEL.map(([, canonical]) => canonical));
    expect(canonicalContentChannels(["instagram", "custom_channel"])).toEqual(["instagram", "custom_channel"]);
    expect(canonicalContentChannels("instagram")).toBeUndefined();
  });

  it("task kinds, AI kinds, sectors, flow ids and departments outside the catalog are kept as received", () => {
    expect(canonicalTaskType("cover_art")).toBe("cover_art");
    expect(canonicalAiTaskKind("custom_kind")).toBe("custom_kind");
    expect(canonicalMarketingSector("Setor do Tenant")).toBe("Setor do Tenant");
    expect(canonicalAutomationFlowId("flow-custom")).toBe("flow-custom");
    expect(canonicalSourceDepartment("sales")).toBe("sales");
    expect(canonicalAutomationFlowId("")).toBeUndefined();
  });

  it("parseCampaignBuilderNotes canonicalises phase, creative types and budget strategy of a legacy notes JSON", () => {
    for (const [legacy, canonical] of CAMPAIGN_PHASE) expect(parseCampaignBuilderNotes(JSON.stringify({ phase: legacy }))?.phase).toBe(canonical);
    const creatives = CREATIVE_TYPE.map(([legacy]) => ({ type: legacy }));
    expect(parseCampaignBuilderNotes(JSON.stringify({ creatives }))?.creatives).toEqual(CREATIVE_TYPE.map(([, canonical]) => ({ type: canonical })));
    for (const [legacy, canonical] of BUDGET_STRATEGY) expect(parseCampaignBuilderNotes(JSON.stringify({ budget: { strategy: legacy, total: 10 } }))?.budget).toEqual({ strategy: canonical, total: 10 });
    expect(parseCampaignBuilderNotes(JSON.stringify({ phase: "launch", budget: { strategy: "cost_cap" } }))).toEqual({ phase: "launch", budget: { strategy: "cost_cap" } });
    expect(parseCampaignBuilderNotes("free text typed by a user")).toBeNull();
  });

  it.each([
    ["pendente", "pending"], ["aprovado", "approved"], ["reprovado", "rejected"], ["ajustes_solicitados", "revision_requested"],
  ])("a legacy approval %s is read as %s and the canonical spelling passes through", (legacy, canonical) => {
    expect(canonicalApproval(legacy)).toBe(canonical);
    expect(canonicalApproval(canonical)).toBe(canonical);
  });
});
