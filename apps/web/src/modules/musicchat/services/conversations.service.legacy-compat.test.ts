import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { musicChatConversationsService } from "./conversations.service";

const raw = (channel: string, metadata: Record<string, unknown>) => ({
  id: "conv-1", tenant_id: "t", contact_id: null, subject: "S", status: "open", channel,
  assigned_to: null, last_message_at: "2026-08-23T10:00:00.000Z", metadata, created_by: null,
  created_at: "2026-08-23T09:00:00.000Z", updated_at: "2026-08-23T10:00:00.000Z",
});

describe("conversation website-form subject (metadata.assunto) dual-read", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["custom", { assunto: "Quero um show" }, "Quero um show"],
    ["custom", { assunto: "" }, undefined],
    ["custom", {}, undefined],
    ["whatsapp", { assunto: "ignored outside the website form" }, undefined],
  ])("channel %s with %j exposes assunto=%j", async (channel, metadata, expected) => {
    apiMock.get.mockResolvedValue([raw(channel, metadata)]);
    const [conversation] = await musicChatConversationsService.list();
    expect(conversation.assunto).toBe(expected);
  });
});
