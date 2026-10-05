import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPE_LABELS } from "./activity-type";

describe("ACTIVITY_TYPE_LABELS", () => {
  it("maps English activity codes to the PT-BR labels previously used as values", () => {
    expect(ACTIVITY_TYPE_LABELS).toEqual({
      legal: "Jurídico",
      financial: "Financeiro",
      schedule: "Agenda",
      production: "Produção",
      marketing: "Marketing",
    });
  });
});
