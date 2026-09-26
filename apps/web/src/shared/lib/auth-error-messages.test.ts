import { describe, expect, it } from "vitest";
import { describeAuthError, isCredentialsError } from "./auth-error-messages";

describe("describeAuthError", () => {
  it("invalid credentials", () => {
    expect(describeAuthError({ message: "Invalid login credentials" })).toBe("Credenciais inválidas.");
  });

  it("unconfirmed email", () => {
    expect(describeAuthError({ message: "Email not confirmed" })).toContain("não confirmado");
  });

  it("rate limit por status 429", () => {
    expect(describeAuthError({ message: "x", status: 429 })).toContain("Muitas tentativas");
  });

  it("rate limit por mensagem", () => {
    expect(describeAuthError({ message: "Too many requests" })).toContain("Muitas tentativas");
  });

  it("falha de rede", () => {
    expect(describeAuthError({ message: "Failed to fetch" })).toContain("Falha de conexão");
  });

  it("fallback: original message when unrecognized", () => {
    expect(describeAuthError({ message: "Some other Supabase error" })).toBe("Some other Supabase error");
  });

  it("generic fallback when the message is empty", () => {
    expect(describeAuthError({ message: "" })).toBe("Não foi possível entrar. Tente novamente.");
  });

  it("never reveals whether a specific email exists (same generic message for wrong password and missing account)", () => {
    // Supabase returns the SAME "Invalid login credentials" for both cases —
    // this test documents that we introduced no logic that tells the two apart.
    expect(describeAuthError({ message: "Invalid login credentials" })).toBe("Credenciais inválidas.");
  });
});

describe("isCredentialsError (Part 77) — only this may consume a rate-limiter attempt", () => {
  it("true for invalid credentials", () => {
    expect(isCredentialsError({ message: "Invalid login credentials" })).toBe(true);
  });

  it("false for a network failure — must never count as an attempt", () => {
    expect(isCredentialsError({ message: "Failed to fetch" })).toBe(false);
  });

  it("false for a 5xx/server error — must never count as an attempt", () => {
    expect(isCredentialsError({ message: "Internal server error", status: 500 })).toBe(false);
  });

  it("false for rate limit — already handled separately", () => {
    expect(isCredentialsError({ message: "x", status: 429 })).toBe(false);
  });

  it("false for an unconfirmed email — not a wrong password", () => {
    expect(isCredentialsError({ message: "Email not confirmed" })).toBe(false);
  });
});
