import { describe, expect, it } from "vitest";
import { DisabledIntegrationError, INTEGRATION_DISABLED_CODE, disabledIntegration } from "./disabled-integration";
import { DomainError, toUserMessage } from "./errors";

describe("DisabledIntegrationError", () => {
  it("keeps the technical diagnosis in English and renders PT-BR copy to the user", () => {
    const err = new DisabledIntegrationError("TikTok", "the TikTok Display API does not expose video metrics");
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe(INTEGRATION_DISABLED_CODE);
    expect(err.status).toBe(503);
    expect(err.message).toBe("Integration TikTok disabled: the TikTok Display API does not expose video metrics.");
    expect(toUserMessage(err)).toBe("A integração com TikTok está indisponível no momento.");
  });

  it("defaults the technical reason to the backend not being configured", () => {
    expect(() => disabledIntegration("Stripe")).toThrow("Integration Stripe disabled: backend not configured.");
  });
});
