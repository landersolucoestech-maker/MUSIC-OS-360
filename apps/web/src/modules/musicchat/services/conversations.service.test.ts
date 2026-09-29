import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { musicChatConversationsService } from "./conversations.service";

// Regression for the double-unwrap bug: apps/web/src/shared/lib/api-client.ts's request()
// already returns payload.data (the TransformInterceptor preserves a controller's own
// {data, meta} shape flat, so api.get<T>() resolves to the bare array for paginated
// endpoints — never {data: T[], meta}). musicChatConversationsService.list()/messages()
// previously did `res.data.map(...)` on top of that already-unwrapped array, so `res.data`
// was undefined and every call threw. This test mocks api.get with the REAL runtime shape
// (a bare array, exactly what api-client actually resolves to), not the old, wrong
// Paginated<T> assumption — it must fail against the old buggy code and pass against the fix.
describe("musicChatConversationsService HTTP envelope contract", () => {
  beforeEach(() => vi.clearAllMocks());

  const rawConversation = {
    id: "conv-1",
    tenant_id: "tenant-1",
    contact_id: null,
    subject: "Assunto",
    status: "open" as const,
    channel: "whatsapp" as const,
    assigned_to: null,
    last_message_at: "2026-08-23T10:00:00.000Z",
    metadata: {},
    created_by: null,
    created_at: "2026-08-23T09:00:00.000Z",
    updated_at: "2026-08-23T10:00:00.000Z",
  };

  const rawMessage = {
    id: "msg-1",
    conversation_id: "conv-1",
    body: "Olá",
    sender_id: "user-1",
    sender_type: "user" as const,
    attachments: [],
    metadata: { delivery_status: "sent" as const },
    created_at: "2026-08-23T10:00:00.000Z",
  };

  it("list() resolves the conversation array when api.get already returns the bare array (real api-client shape)", async () => {
    apiMock.get.mockResolvedValue([rawConversation]);

    const result = await musicChatConversationsService.list();

    expect(apiMock.get).toHaveBeenCalledWith("/conversations?limit=200");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: "conv-1", originLabel: "WhatsApp" }));
  });

  it("messages() resolves the message array when api.get already returns the bare array, including delivery status", async () => {
    apiMock.get.mockResolvedValue([rawMessage]);

    const result = await musicChatConversationsService.messages("conv-1");

    expect(apiMock.get).toHaveBeenCalledWith("/conversations/conv-1/messages?limit=200");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: "msg-1", body: "Olá", deliveryStatus: "sent" }),
    );
  });

  it("list() never reads a `.data` property off api.get's resolved value (would be undefined on the real client shape)", async () => {
    // A resolved value with no `data` key at all: if the implementation still did
    // `res.data.map(...)`, this would throw "Cannot read properties of undefined".
    apiMock.get.mockResolvedValue([rawConversation]);
    await expect(musicChatConversationsService.list()).resolves.not.toThrow();
  });

  it("mapMessage surfaces failed/internal_only delivery status honestly, never silently as sent", async () => {
    apiMock.get.mockResolvedValue([
      {
        ...rawMessage,
        id: "msg-failed",
        metadata: {
          delivery_status: "failed",
          delivery_error_code: "WHATSAPP_INVALID_RECIPIENT",
          delivery_error: "WhatsApp Cloud API rejected the recipient: (#131026) Message undeliverable",
        },
      },
      { ...rawMessage, id: "msg-legacy", metadata: { delivery_status: "failed", delivery_error: "boom" } },
      { ...rawMessage, id: "msg-internal", metadata: { delivery_status: "internal_only" } },
    ]);

    const result = await musicChatConversationsService.messages("conv-1");

    const failed = result.find((m) => m.id === "msg-failed");
    expect(failed).toEqual(
      expect.objectContaining({ deliveryStatus: "failed", deliveryFailureCopy: "o WhatsApp recusou o número do destinatário." }),
    );
    // The technical provider detail never reaches the UI model.
    expect(JSON.stringify(failed)).not.toContain("131026");
    expect(failed).not.toHaveProperty("deliveryError");
    // Messages persisted before the failure code existed get the generic copy, never the raw text.
    expect(result.find((m) => m.id === "msg-legacy")).toEqual(
      expect.objectContaining({ deliveryFailureCopy: "não foi possível entregar a mensagem pelo WhatsApp." }),
    );
    expect(result.find((m) => m.id === "msg-internal")).toEqual(
      expect.objectContaining({ deliveryStatus: "internal_only" }),
    );
  });

  // PD-1 (2026-08-23): sendMessage/create must send a real X-Idempotency-Key — protects
  // against network-level duplicate resends (timeout+retry), in addition to the UI guard.
  it("sendMessage() sends a real X-Idempotency-Key header", async () => {
    apiMock.post.mockResolvedValue(rawMessage);

    await musicChatConversationsService.sendMessage("conv-1", "Olá");

    expect(apiMock.post).toHaveBeenCalledWith(
      "/conversations/conv-1/messages",
      { body: "Olá", attachments: [] },
      { headers: { "X-Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } },
    );
  });

  it("create() sends channel=whatsapp with phone/customer in metadata and a real idempotency key", async () => {
    apiMock.post.mockResolvedValue(rawConversation);

    await musicChatConversationsService.create({ subject: "Novo cliente", channel: "whatsapp", phone: "+5511999999999", customer: "Novo cliente" });

    expect(apiMock.post).toHaveBeenCalledWith(
      "/conversations",
      { subject: "Novo cliente", channel: "whatsapp", metadata: { phone: "+5511999999999", customer: "Novo cliente" } },
      { headers: { "X-Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } },
    );
  });

  it("sendMessage() uses a different idempotency key on each call (never reuses/predicts one)", async () => {
    apiMock.post.mockResolvedValue(rawMessage);

    await musicChatConversationsService.sendMessage("conv-1", "Primeira");
    await musicChatConversationsService.sendMessage("conv-1", "Segunda");

    const key1 = apiMock.post.mock.calls[0][2].headers["X-Idempotency-Key"];
    const key2 = apiMock.post.mock.calls[1][2].headers["X-Idempotency-Key"];
    expect(key1).not.toBe(key2);
  });
});

// CZ-045: service_status values are English. A value this build does not know
// (e.g. a pre-CZ-045 Portuguese value read before migration 26 ran) must not
// reach the UI maps as an unknown key — it falls back to the status derived
// from the conversation's own state.
describe("musicChatConversationsService service_status mapping (CZ-045)", () => {
  beforeEach(() => vi.clearAllMocks());

  const base = {
    id: "conv-2",
    tenant_id: "tenant-1",
    contact_id: null,
    subject: "Assunto",
    channel: "whatsapp" as const,
    assigned_to: null,
    last_message_at: null,
    created_by: null,
    created_at: "2026-08-23T09:00:00.000Z",
    updated_at: "2026-08-23T10:00:00.000Z",
  };

  it.each([
    ["new", "new"],
    ["waiting_agent", "waiting_agent"],
    ["in_progress", "in_progress"],
    ["waiting_customer", "waiting_customer"],
    ["resolved", "resolved"],
    ["archived", "archived"],
  ])("keeps the canonical service_status %s", async (stored, expected) => {
    apiMock.get.mockResolvedValue({ ...base, status: "open", metadata: { service_status: stored } });
    await expect(musicChatConversationsService.get("conv-2")).resolves.toMatchObject({ status: expected });
  });

  it.each([
    ["unknown_status", "open", "in_progress"],
    ["closed_by_bot", "closed", "resolved"],
    ["", "pending", "waiting_agent"],
    ["constructor", "spam", "archived"],
  ])("unknown service_status %j falls back to the backend status %s", async (stored, status, expected) => {
    apiMock.get.mockResolvedValue({ ...base, status, metadata: { service_status: stored } });
    await expect(musicChatConversationsService.get("conv-2")).resolves.toMatchObject({ status: expected });
  });

  it("sends the canonical service_status on update", async () => {
    apiMock.patch.mockResolvedValue({ ...base, status: "open", metadata: { service_status: "in_progress" } });
    await musicChatConversationsService.update("conv-2", { service_status: "in_progress" });
    expect(apiMock.patch).toHaveBeenCalledWith("/conversations/conv-2", { service_status: "in_progress" });
  });
});

/**
 * N6/N7/L2: the service never exposes raw member ids as display text, reads
 * only the queue/sector names, and transfers through PATCH /transfer.
 */
describe("musicChatConversationsService member ids, queue names and transfer", () => {
  beforeEach(() => vi.clearAllMocks());

  const raw = {
    id: "conv-2", tenant_id: "tenant-1", contact_id: null, subject: "Assunto",
    status: "open" as const, channel: "whatsapp" as const, assigned_to: "auth-user-7",
    last_message_at: null, created_by: null,
    created_at: "2026-08-23T09:00:00.000Z", updated_at: "2026-08-23T10:00:00.000Z",
    metadata: { queue: "Comercial", sector: "Shows", queue_id: "5b0f3c1e-0000-4000-8000-000000000001", sector_id: "5b0f3c1e-0000-4000-8000-000000000002" },
  };

  it("maps assigned_to to assigneeId and shows queue/sector names, never the opaque ids", async () => {
    apiMock.get.mockResolvedValue(raw);
    const conversation = await musicChatConversationsService.get("conv-2");
    expect(conversation.assigneeId).toBe("auth-user-7");
    expect(conversation.queue).toBe("Comercial");
    expect(conversation.sector).toBe("Shows");
    expect(conversation).not.toHaveProperty("assignee");
  });

  it("an agent message keeps the sender id apart from its display label", async () => {
    apiMock.get.mockResolvedValue([
      { id: "m1", conversation_id: "conv-2", body: "Oi", sender_id: "auth-user-7", sender_type: "user", attachments: [], metadata: {}, created_at: "2026-08-23T10:00:00.000Z" },
      { id: "m2", conversation_id: "conv-2", body: "Olá", sender_id: "contact-1", sender_type: "contact", attachments: [], metadata: {}, created_at: "2026-08-23T10:01:00.000Z" },
    ]);
    const [agent, customer] = await musicChatConversationsService.messages("conv-2");
    expect(agent).toEqual(expect.objectContaining({ sender: "agent", author: "Agente", authorId: "auth-user-7" }));
    expect(customer).toEqual(expect.objectContaining({ sender: "customer", author: "Cliente" }));
    expect(customer.authorId).toBeUndefined();
  });

  it("transfer() calls PATCH /conversations/:id/transfer with assignee_id and the concurrency token", async () => {
    apiMock.patch.mockResolvedValue(raw);
    await musicChatConversationsService.transfer("conv-2", { assigneeId: "auth-user-7", serviceStatus: "in_progress", expectedUpdatedAt: raw.updated_at });
    expect(apiMock.patch).toHaveBeenCalledWith("/conversations/conv-2/transfer", {
      assignee_id: "auth-user-7",
      service_status: "in_progress",
      reason: undefined,
      expectedUpdatedAt: raw.updated_at,
    });
  });
});
