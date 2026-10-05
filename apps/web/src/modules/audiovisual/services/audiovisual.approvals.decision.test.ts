/**
 * Guard (defect C2): the approval decision endpoint only accepts the API
 * APPROVAL_STATUSES; the web must never send the project-level "review".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const post = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: (...a: unknown[]) => post(...a), patch: vi.fn(), delete: vi.fn() } }));

import { APPROVAL_DECISION_STATUSES } from "../types/audiovisual.types";
import { audiovisualService } from "./audiovisual.service";
import { audiovisualStatusLabel } from "../components/AudiovisualStatusBadge";

// Literal copy of APPROVAL_STATUSES from apps/api/src/modules/audiovisual/dto/audiovisual.dto.ts.
// If the API constant changes, update this copy and the web type together.
const API_APPROVAL_STATUSES = ["pending", "approved", "rejected", "revision_requested"];

describe("approval decision status", () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}));

  it("has exactly the 4 API decision values", () => {
    expect([...APPROVAL_DECISION_STATUSES].sort()).toEqual([...API_APPROVAL_STATUSES].sort());
  });

  it("never includes review", () => {
    expect(APPROVAL_DECISION_STATUSES as readonly string[]).not.toContain("review");
  });

  it("sends every decision value unchanged and never review to the decision endpoint", async () => {
    for (const s of APPROVAL_DECISION_STATUSES) await audiovisualService.approvals.decide("a1", s, "ok");
    const sent = post.mock.calls.map((c) => (c[1] as { status: string }).status);
    expect(sent).toEqual([...APPROVAL_DECISION_STATUSES]);
    expect(sent).not.toContain("review");
    expect(post.mock.calls.every((c) => c[0] === "/audiovisual/approvals/a1/decision")).toBe(true);
  });

  it("labels revision_requested in PT-BR", () => {
    expect(audiovisualStatusLabel("revision_requested")).toBe("Revisão solicitada");
  });
});
