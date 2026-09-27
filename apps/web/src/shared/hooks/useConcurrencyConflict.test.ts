import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, IntegrationError } from "@/shared/lib/errors";
import { getExpectedUpdatedAt, isConcurrencyConflict, handleConcurrencyConflict } from "./useConcurrencyConflict";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
import { toast } from "sonner";

describe("getExpectedUpdatedAt", () => {
  it("reads updated_at (snake_case) when present", () => {
    expect(getExpectedUpdatedAt({ updated_at: "2026-08-14T10:00:00.000Z" })).toBe("2026-08-14T10:00:00.000Z");
  });

  it("falls back to updatedAt (camelCase) when snake_case is absent", () => {
    expect(getExpectedUpdatedAt({ updatedAt: "2026-08-14T10:00:00.000Z" })).toBe("2026-08-14T10:00:00.000Z");
  });

  it("undefined for a null/missing entity", () => {
    expect(getExpectedUpdatedAt(null)).toBeUndefined();
    expect(getExpectedUpdatedAt(undefined)).toBeUndefined();
  });

  it("undefined when the value is not a string (never invents a timestamp)", () => {
    expect(getExpectedUpdatedAt({ updated_at: 12345 })).toBeUndefined();
  });
});

describe("isConcurrencyConflict", () => {
  it("true only for ConflictError — what api-client.ts really throws on HTTP 409", () => {
    expect(isConcurrencyConflict(new ConflictError("conflict"))).toBe(true);
    expect(isConcurrencyConflict(new IntegrationError("api", "not found", { statusCode: 404 }))).toBe(false);
    expect(isConcurrencyConflict(new IntegrationError("api", "conflict", { statusCode: 409 }))).toBe(false);
    expect(isConcurrencyConflict(new Error("another error"))).toBe(false);
    expect(isConcurrencyConflict(null)).toBe(false);
  });
});

describe("handleConcurrencyConflict", () => {
  beforeEach(() => vi.clearAllMocks());

  it("409: shows a specific toast, returns true (the caller does NOT close the form)", () => {
    const err = new ConflictError("conflict");
    const handled = handleConcurrencyConflict(err, "contrato");
    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const message = vi.mocked(toast.error).mock.calls[0][0] as string;
    expect(message).toContain("contrato");
    expect(message).toContain("alterado por outra pessoa");
  });

  it("non-409: returns false, shows no toast (lets the caller handle it)", () => {
    const handled = handleConcurrencyConflict(new Error("network failure"), "contrato");
    expect(handled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
