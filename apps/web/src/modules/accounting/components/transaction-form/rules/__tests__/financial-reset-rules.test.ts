import { describe, it, expect } from "vitest";
import { applyResets } from "../financial-reset-rules";

// ── tipoTransacao resets ───────────────────────────────────────────────────
describe("applyResets — tipoTransacao", () => {
  it("always resets categoria and downstream fields", () => {
    const result = applyResets("tipoTransacao", "despesa");
    expect(result.categoria).toBe("");
    expect(result.subcategoria).toBe("");
    expect(result.itemInvestimento).toBe("");
    expect(result.artistaVinculado).toBe("");
    expect(result.projetoVinculado).toBe("");
    expect(result.contratoVinculado).toBe("");
    expect(result.eventoVinculado).toBe("");
    expect(result.motivoViagem).toBe("");
    expect(result.nomePublicidade).toBe("");
    expect(result.orgaoArrecadador).toBe("");
  });

  it("resets tipoCliente when new value is 'imposto'", () => {
    const result = applyResets("tipoTransacao", "imposto");
    expect(result.tipoCliente).toBe("");
  });

  it("resets tipoCliente when new value is 'transferencia'", () => {
    const result = applyResets("tipoTransacao", "transferencia");
    expect(result.tipoCliente).toBe("");
  });

  it("resets tipoCliente when new value is 'investimento'", () => {
    const result = applyResets("tipoTransacao", "investimento");
    expect(result.tipoCliente).toBe("");
  });

  it("does NOT reset tipoCliente when new value is 'despesa'", () => {
    const result = applyResets("tipoTransacao", "despesa");
    expect(result.tipoCliente).toBeUndefined();
  });

  it("does NOT reset tipoCliente when new value is 'receita'", () => {
    const result = applyResets("tipoTransacao", "receita");
    expect(result.tipoCliente).toBeUndefined();
  });
});

// ── tipoCliente resets ─────────────────────────────────────────────────────
describe("applyResets — tipoCliente", () => {
  it("resets all dependent fields when tipoCliente changes", () => {
    const result = applyResets("tipoCliente", "empresa");
    expect(result.categoria).toBe("");
    expect(result.subcategoria).toBe("");
    expect(result.artistaVinculado).toBe("");
    expect(result.projetoVinculado).toBe("");
    expect(result.contratoVinculado).toBe("");
    expect(result.eventoVinculado).toBe("");
    expect(result.motivoViagem).toBe("");
    expect(result.nomePublicidade).toBe("");
  });

  it("does not reset itemInvestimento or orgaoArrecadador (not in tipoCliente map)", () => {
    const result = applyResets("tipoCliente", "artista");
    expect(result.itemInvestimento).toBeUndefined();
    expect(result.orgaoArrecadador).toBeUndefined();
  });

  it("does not reset tipoTransacao", () => {
    const result = applyResets("tipoCliente", "pessoa");
    expect(result.tipoTransacao).toBeUndefined();
  });
});

// ── categoria resets ───────────────────────────────────────────────────────
describe("applyResets — categoria", () => {
  it("resets subcategoria and all downstream fields", () => {
    const result = applyResets("categoria", "servicos");
    expect(result.subcategoria).toBe("");
    expect(result.itemInvestimento).toBe("");
    expect(result.artistaVinculado).toBe("");
    expect(result.projetoVinculado).toBe("");
    expect(result.contratoVinculado).toBe("");
    expect(result.eventoVinculado).toBe("");
    expect(result.motivoViagem).toBe("");
    expect(result.nomePublicidade).toBe("");
  });

  it("does not reset tipoTransacao or tipoCliente", () => {
    const result = applyResets("categoria", "marketing");
    expect(result.tipoTransacao).toBeUndefined();
    expect(result.tipoCliente).toBeUndefined();
  });
});

// ── artistaVinculado resets ────────────────────────────────────────────────
describe("applyResets — artistaVinculado", () => {
  it("resets projetoVinculado, eventoVinculado, contratoVinculado", () => {
    const result = applyResets("artistaVinculado", "artista-1");
    expect(result.projetoVinculado).toBe("");
    expect(result.eventoVinculado).toBe("");
    expect(result.contratoVinculado).toBe("");
  });

  it("does not reset unrelated fields", () => {
    const result = applyResets("artistaVinculado", "artista-1");
    expect(result.tipoTransacao).toBeUndefined();
    expect(result.categoria).toBeUndefined();
    expect(result.subcategoria).toBeUndefined();
  });
});

// ── tipoPagamento resets ───────────────────────────────────────────────────
describe("applyResets — tipoPagamento", () => {
  it("resets parcelas fields when switching to 'avista'", () => {
    const result = applyResets("tipoPagamento", "avista");
    expect(result.quantidadeParcelas).toBe("");
    expect(result.intervaloParcelas).toBe("mensal");
    expect(result.dataPrimeiraParcela).toBe("");
  });

  it("does NOT reset parcelas fields when switching to 'parcelado'", () => {
    const result = applyResets("tipoPagamento", "parcelado");
    expect(result.quantidadeParcelas).toBeUndefined();
    expect(result.intervaloParcelas).toBeUndefined();
    expect(result.dataPrimeiraParcela).toBeUndefined();
  });

  it("keeps intervaloParcelas default value ('mensal') when resetting to avista", () => {
    const result = applyResets("tipoPagamento", "avista");
    expect(result.intervaloParcelas).toBe("mensal");
  });
});

// ── fields with no reset entries ───────────────────────────────────────────
describe("applyResets — fields not in RESET_MAP", () => {
  it("resets dependent linkage fields for subcategoria", () => {
    const result = applyResets("subcategoria", "design-grafico");
    expect(result).toMatchObject({
      artistaVinculado: "",
      projetoVinculado: "",
      contratoVinculado: "",
      eventoVinculado: "",
      fornecedorCliente: "",
      orgaoArrecadador: "",
      tipoVinculacao: "",
      centroCusto: "",
      competencia: "",
      contaOrigem: "",
      contaDestino: "",
    });
  });

  it("returns empty object for descricao (no entry)", () => {
    const result = applyResets("descricao", "anything");
    expect(result).toEqual({});
  });

  it("returns empty object for valor (no entry)", () => {
    const result = applyResets("valor", "500");
    expect(result).toEqual({});
  });
});
