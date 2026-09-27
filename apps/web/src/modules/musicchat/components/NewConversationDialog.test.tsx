import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const serviceMock = vi.hoisted(() => ({ create: vi.fn(), sendMessage: vi.fn() }));

vi.mock("@/modules/musicchat/services/conversations.service", () => ({
  musicChatConversationsService: serviceMock,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NewConversationDialog } from "./NewConversationDialog";

/**
 * PD-1/PD-3 (2026-08-23): the idempotency key must be stable PER LOGICAL ATTEMPT.
 * If every call generated a new UUID, an agent retry after a network failure would create a
 * SECOND conversation — exactly the case the key exists to prevent. This test fails
 * against the old implementation (crypto.randomUUID() inside the service on every call).
 */
describe("NewConversationDialog — idempotency key stability", () => {
  beforeEach(() => vi.clearAllMocks());

  const conversation = { id: "conv-1" } as never;

  const fillAndSubmit = (phone = "+5511999999999") => {
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), { target: { value: phone } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar conversa" }));
  };

  it("reuses the same key when the agent retries after a failed attempt", async () => {
    serviceMock.create.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(conversation);

    render(<NewConversationDialog open onOpenChange={() => {}} onCreated={() => {}} />);

    fillAndSubmit();
    await waitFor(() => expect(serviceMock.create).toHaveBeenCalledTimes(1));

    fillAndSubmit();
    await waitFor(() => expect(serviceMock.create).toHaveBeenCalledTimes(2));

    const [, firstKey] = serviceMock.create.mock.calls[0];
    const [, secondKey] = serviceMock.create.mock.calls[1];
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondKey).toBe(firstKey);
  });

  it("mints a NEW key when the agent edits the payload before retrying (an edit is a different attempt)", async () => {
    serviceMock.create.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(conversation);

    render(<NewConversationDialog open onOpenChange={() => {}} onCreated={() => {}} />);

    fillAndSubmit("+5511999999999");
    await waitFor(() => expect(serviceMock.create).toHaveBeenCalledTimes(1));

    // Corrected number: reusing the key would make the backend replay the old response and the correction
    // would be silently discarded.
    fillAndSubmit("+5511888888888");
    await waitFor(() => expect(serviceMock.create).toHaveBeenCalledTimes(2));

    expect(serviceMock.create.mock.calls[1][1]).not.toBe(serviceMock.create.mock.calls[0][1]);
  });

  it("creates the conversation on the whatsapp channel with the phone in metadata", async () => {
    serviceMock.create.mockResolvedValue(conversation);

    render(<NewConversationDialog open onOpenChange={() => {}} onCreated={() => {}} />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMock.create).toHaveBeenCalled());
    expect(serviceMock.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ channel: "whatsapp", phone: "+5511999999999" }),
    );
  });

  it("does not send an initial message when the field is left empty", async () => {
    serviceMock.create.mockResolvedValue(conversation);

    render(<NewConversationDialog open onOpenChange={() => {}} onCreated={() => {}} />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMock.create).toHaveBeenCalled());
    expect(serviceMock.sendMessage).not.toHaveBeenCalled();
  });
});
