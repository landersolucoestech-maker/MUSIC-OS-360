import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_ERROR_MESSAGE,
  IntegrationError,
  UserFacingError,
  ValidationError,
  toUserMessage,
} from "./errors";

describe("toUserMessage — the only error → end-user text boundary", () => {
  it("returns the producer's PT-BR userMessage", () => {
    const err = new UserFacingError("Abramus username and password are required", "Usuário e senha são obrigatórios.");
    expect(toUserMessage(err)).toBe("Usuário e senha são obrigatórios.");
  });

  it("returns userMessage for API-derived domain errors", () => {
    expect(toUserMessage(new ValidationError("API responded 400", {}, { userMessage: "Nome é obrigatório." }))).toBe(
      "Nome é obrigatório.",
    );
  });

  it("never returns a raw technical message: provider internals, HTTP status, payload details", () => {
    const leaks = [
      new Error("Soundcharts: rate limit"),
      new Error("YouTube API error: 403"),
      new TypeError("Failed to fetch"),
      new IntegrationError("storage", 'Unknown table "x". Add it to TABLE_ENDPOINT'),
      new IntegrationError("api", "Auth invalidated — request paused", { statusCode: 401 }),
    ];
    for (const err of leaks) {
      expect(toUserMessage(err)).toBe(DEFAULT_USER_ERROR_MESSAGE);
      expect(toUserMessage(err)).not.toContain(err.message);
    }
  });

  it("does not render a plain Error even if its text happens to be Portuguese (no implicit user contract)", () => {
    expect(toUserMessage(new Error("Falha ao salvar"), "Não foi possível salvar.")).toBe("Não foi possível salvar.");
  });

  it("uses the caller's PT-BR fallback for non-Error values", () => {
    expect(toUserMessage("boom", "Falha no upload.")).toBe("Falha no upload.");
    expect(toUserMessage(undefined)).toBe(DEFAULT_USER_ERROR_MESSAGE);
  });
});
