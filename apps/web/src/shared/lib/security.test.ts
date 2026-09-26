import { describe, expect, it, beforeEach, vi } from "vitest";
import { authRateLimiter } from "./security";

describe("AuthRateLimiter (Parte 77)", () => {
  beforeEach(() => {
    authRateLimiter.reset("user@example.com");
    vi.useRealTimers();
  });

  it("isBlocked() never increments anything — freely callable without side effects", () => {
    expect(authRateLimiter.isBlocked("user@example.com")).toBe(false);
    expect(authRateLimiter.isBlocked("user@example.com")).toBe(false);
    expect(authRateLimiter.getRemainingAttempts("user@example.com")).toBe(5);
  });

  it("recordFailure() reduz as tentativas restantes", () => {
    authRateLimiter.recordFailure("user@example.com");
    expect(authRateLimiter.getRemainingAttempts("user@example.com")).toBe(4);
    authRateLimiter.recordFailure("user@example.com");
    expect(authRateLimiter.getRemainingAttempts("user@example.com")).toBe(3);
  });

  it("blocks after exceeding the maximum number of failed attempts", () => {
    for (let i = 0; i < 6; i++) authRateLimiter.recordFailure("blocked@example.com");
    expect(authRateLimiter.isBlocked("blocked@example.com")).toBe(true);
    expect(authRateLimiter.getTimeUntilReset("blocked@example.com")).toBeGreaterThan(0);
  });

  it("reset() limpa o estado completamente", () => {
    authRateLimiter.recordFailure("reset@example.com");
    authRateLimiter.recordFailure("reset@example.com");
    authRateLimiter.reset("reset@example.com");
    expect(authRateLimiter.getRemainingAttempts("reset@example.com")).toBe(5);
    expect(authRateLimiter.isBlocked("reset@example.com")).toBe(false);
  });

  it("erro de rede/servidor nunca deveria chamar recordFailure — simula o fluxo correto do Auth.tsx", () => {
    // Este teste documenta o contrato: o chamador só invoca recordFailure()
    // para erros de credencial confirmados, nunca para falhas de rede/servidor.
    const email = "network-error@example.com";
    const remainingBefore = authRateLimiter.getRemainingAttempts(email);
    // Simula um erro de rede: nada é chamado além de isBlocked (leitura).
    authRateLimiter.isBlocked(email);
    expect(authRateLimiter.getRemainingAttempts(email)).toBe(remainingBefore);
  });
});
