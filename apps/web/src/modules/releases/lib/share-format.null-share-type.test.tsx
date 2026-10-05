/**
 * Characterization of the documented NULL `share_type` web/API divergence
 * (docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md section 11).
 *
 * API (apps/api share-eligibility.util.ts): share_type NULL === registry split
 * (counts in the 100% split budget). Web resolveShareType: NULL has no registry
 * reading and is shown/edited as a FINANCIAL share. Which reading is correct is
 * an OPEN PRODUCT DECISION (registry-vs-financial split); these tests pin the
 * current web behavior so a change is deliberate, they do not endorse it.
 */
import { describe, expect, it } from "vitest";
import { resolveShareType } from "./share-format";
import type { Share } from "@/modules/releases/types";

const asShare = (o: Record<string, unknown>) => o as unknown as Share & Record<string, unknown>;

describe("resolveShareType with NULL/absent share_type (web side of the divergence)", () => {
  it("resolves a registry-shaped NULL row (work_id + holder only) to the financial internal type", () => {
    expect(resolveShareType(asShare({ share_type: null, work_id: "w1", holder_name: "Maria" }))).toBe("internal_release");
  });

  it("an explicit value always wins over the derivation", () => {
    expect(resolveShareType(asShare({ share_type: "external_receivable", release_id: "r1" }))).toBe("external_receivable");
  });

  it("an unknown explicit value is not trusted and falls through to derivation", () => {
    expect(resolveShareType(asShare({ share_type: "registry", payer: "X" }))).toBe("external_receivable");
  });
});
