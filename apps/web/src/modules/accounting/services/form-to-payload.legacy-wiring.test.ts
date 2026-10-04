import { describe, expect, it } from "vitest";
import { formToTransactionPayload } from "./form-to-payload.mapper";
import { initialFormData, type TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

function payloadOf(overrides: Partial<TransactionFormData>) {
  return formToTransactionPayload({ ...initialFormData, ...overrides });
}

describe("formToTransactionPayload: legacy category/subcategory are sent canonical", () => {
  it.each([
    ["servicos", "services"],
    ["receitas-musicais", "music_revenue"],
    ["caches", "performance_fees"],
    ["tecnologia", "technology"],
    ["recebimentos externos de direitos", "external_rights_receipts"],
  ])("category %s is sent as %s", (legacy, canonical) => {
    expect(payloadOf({ category: legacy }).category).toBe(canonical);
  });

  it.each([
    ["gravacao-estudio", "studio_recording"],
    ["direitos-conexos", "neighboring_rights"],
    ["show-evento", "show_event"],
    ["simples-nacional", "simples_nacional"],
  ])("subcategory %s is sent as %s", (legacy, canonical) => {
    expect(payloadOf({ subcategory: legacy }).subcategory).toBe(canonical);
  });

  it("trims before mapping (form text with surrounding spaces)", () => {
    const payload = payloadOf({ category: "  servicos ", subcategory: " gravacao-estudio  " });
    expect(payload.category).toBe("services");
    expect(payload.subcategory).toBe("studio_recording");
  });

  it("canonical ids and free text pass through untouched (negative: no over-mapping)", () => {
    const payload = payloadOf({ category: "services", subcategory: "Receitas Musicais" });
    expect(payload.category).toBe("services");
    expect(payload.subcategory).toBe("Receitas Musicais");
  });

  it("an empty value stays null", () => {
    const payload = payloadOf({ category: "", subcategory: "   " });
    expect(payload.category).toBeNull();
    expect(payload.subcategory).toBeNull();
  });

  it("never sends a legacy slug for either field", () => {
    const payload = payloadOf({ category: "caches", subcategory: "show-evento" });
    expect(payload.category).not.toBe("caches");
    expect(payload.subcategory).not.toBe("show-evento");
  });
});
