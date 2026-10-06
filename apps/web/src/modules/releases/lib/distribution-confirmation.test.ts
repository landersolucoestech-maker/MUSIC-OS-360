import { describe, expect, it } from "vitest";
import {
  EMPTY_DISTRIBUTION_CONFIRMATION,
  buildDistributionConfirmationMetadata,
  distributionConfirmationProblems,
  isDistributionTarget,
} from "./distribution-confirmation";

const valid = { source: "manual_operational", reference: "  TICKET-1  ", confirmedAt: "2026-10-05", note: " ok " };

describe("distribution confirmation", () => {
  it("only the distributed status asks for a confirmation", () => {
    expect(isDistributionTarget("distributed")).toBe(true);
    expect(isDistributionTarget("scheduled")).toBe(false);
  });

  it("an empty draft names every missing field", () => {
    expect(distributionConfirmationProblems(EMPTY_DISTRIBUTION_CONFIRMATION)).toHaveLength(3);
  });

  it("rejects an unknown origin, a short reference and a malformed date", () => {
    expect(distributionConfirmationProblems({ ...valid, source: "automatic" })).toEqual(["origem da confirmação"]);
    expect(distributionConfirmationProblems({ ...valid, reference: "ab" })).toEqual(["referência (protocolo, ticket ou link)"]);
    expect(distributionConfirmationProblems({ ...valid, confirmedAt: "05/10/2026" })).toEqual(["data da confirmação"]);
  });

  it("a complete draft has no problems and builds the metadata patch without server-stamped fields", () => {
    expect(distributionConfirmationProblems(valid)).toEqual([]);
    expect(buildDistributionConfirmationMetadata(valid)).toEqual({
      distribution_confirmation: { source: "manual_operational", reference: "TICKET-1", confirmed_at: "2026-10-05", note: "ok" },
    });
  });

  it("omits an empty note", () => {
    const meta = buildDistributionConfirmationMetadata({ ...valid, note: "  " }) as { distribution_confirmation: Record<string, unknown> };
    expect(meta.distribution_confirmation).not.toHaveProperty("note");
  });
});
