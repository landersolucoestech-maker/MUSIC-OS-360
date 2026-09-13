import { describe, it, expect } from "vitest";
import { leadValidationSchema, serviceLeadSchemas } from "./index";

const basePayload = {
  nomeCompleto: "Fulano de Tal",
  tipoCliente: "artist",
  tipoServico: "producaoMusical",
  // "objetivo" é obrigatório para o tipo de serviço producaoMusical.
  payloadServico: { objetivo: "Lançamento de single" },
  dadosInternosCRM: { statusLead: "novo" },
};

describe("leadValidationSchema — dadosInternosCRM.valorEstimado/probabilidadeFechamento", () => {
  it("aceita payload válido completo", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: 5000, probabilidadeFechamento: 50 },
    });
    expect(result.success).toBe(true);
  });

  it("trata campo numérico ausente (undefined) como não informado", () => {
    const result = leadValidationSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dadosInternosCRM.valorEstimado).toBeUndefined();
  });

  it("trata NaN (input DOM limpo via valueAsNumber) como não informado, não como erro", () => {
    // register(..., { valueAsNumber: true }) produz NaN quando o campo é limpo —
    // sem o preprocess, isso quebrava a validação com "Expected number, received nan".
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: NaN },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dadosInternosCRM.valorEstimado).toBeUndefined();
  });

  it("rejeita valor negativo", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", valorEstimado: -10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita probabilidadeFechamento acima de 100", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", probabilidadeFechamento: 150 },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita campo desconhecido em dadosInternosCRM (.strict())", () => {
    const result = leadValidationSchema.safeParse({
      ...basePayload,
      dadosInternosCRM: { statusLead: "novo", campoInventado: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita campo desconhecido no nível raiz (.strict())", () => {
    const result = leadValidationSchema.safeParse({ ...basePayload, campoInventado: "x" });
    expect(result.success).toBe(false);
  });
});

describe("serviceLeadSchemas — payloadServico por tipo (.strict())", () => {
  it("aceita apenas os campos definidos para o tipo de serviço selecionado", () => {
    const schema = serviceLeadSchemas.producaoMusical;
    const result = schema.validation.safeParse({ objetivo: "Lançamento de single" });
    expect(result.success).toBe(true);
  });

  it("rejeita campo de outro tipo de serviço vazado no payloadServico", () => {
    const schema = serviceLeadSchemas.producaoMusical;
    const result = schema.validation.safeParse({ campoDeOutroTipoDeServico: "x" });
    expect(result.success).toBe(false);
  });
});
