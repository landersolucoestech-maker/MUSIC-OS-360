import { describe, it, expect } from "vitest";
import { leadValidationSchema, serviceLeadSchemas } from "./index";

const basePayload = {
  nomeCompleto: "Fulano de Tal",
  clientType: "artist",
  serviceType: "producaoMusical",
  // "objetivo" is required for the producaoMusical service type.
  payloadServico: { objetivo: "Lançamento de single" },
  dadosInternosCRM: { statusLead: "novo" },
};

describe("leadValidationSchema — dadosInternosCRM.valorEstimado/probabilidadeFechamento", () => {
  it("accepts a complete valid payload", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: 5000, probabilidadeFechamento: 50 },
    });
    expect(result.success).toBe(true);
  });

  it("treats an absent (undefined) numeric field as not provided", () => {
    const result = leadValidationSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dadosInternosCRM.valorEstimado).toBeUndefined();
  });

  it("treats NaN (cleared DOM input via valueAsNumber) as not provided, not as an error", () => {
    // register(..., { valueAsNumber: true }) yields NaN when the field is cleared —
    // without the preprocess, this broke validation with "Expected number, received nan".
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: NaN },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dadosInternosCRM.valorEstimado).toBeUndefined();
  });

  it("rejects a negative value", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: -10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects probabilidadeFechamento above 100", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", probabilidadeFechamento: 150 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown field in dadosInternosCRM (.strict())", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", campoInventado: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown root-level field (.strict())", () => {
    const result = leadValidationSchema.safeParse({ ...basePayload, campoInventado: "x" });
    expect(result.success).toBe(false);
  });
});

describe("serviceLeadSchemas — payloadServico por tipo (.strict())", () => {
  it("accepts only the fields defined for the selected service type", () => {
    const schema = serviceLeadSchemas.producaoMusical;
    const result = schema.validation.safeParse({ objetivo: "Lançamento de single" });
    expect(result.success).toBe(true);
  });

  it("rejects a field from another service type leaked into payloadServico", () => {
    const schema = serviceLeadSchemas.producaoMusical;
    const result = schema.validation.safeParse({ campoDeOutroTipoDeServico: "x" });
    expect(result.success).toBe(false);
  });
});
