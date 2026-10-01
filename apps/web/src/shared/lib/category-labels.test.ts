import { describe, expect, it } from "vitest";
import { formatCategoryLabel } from "./category-labels";
import { transactionCategoryLabel } from "@/modules/accounting/constants/transaction-constants";

describe("formatCategoryLabel", () => {
  it("keeps the dictionary labels of every value a producer can still emit", () => {
    expect(formatCategoryLabel("cessao_direitos")).toBe("Cessão de Direitos");
    expect(formatCategoryLabel("gravacao")).toBe("Gravação");
    expect(formatCategoryLabel("producao_musical")).toBe("Produção Musical");
    expect(formatCategoryLabel("suporte_financeiro")).toBe("Suporte Financeiro");
    expect(formatCategoryLabel("juridico")).toBe("Honorários Jurídicos");
    expect(formatCategoryLabel("external_rights_receipts")).toBe("Recebimentos externos de direitos");
    expect(formatCategoryLabel("Cachê")).toBe("Cachê de Shows");
    expect(formatCategoryLabel(null)).toBe("—");
  });

  it("no longer special-cases the removed dead slugs: they fall back to a readable label, never a raw slug", () => {
    const removed = [
      "adiantamento_artista", "folha_pagamento", "gestao_carreira", "gravacao_distribuicao",
      "direitos_autorais", "registro_autoral", "recebimentos_externos_de_direitos", "desenvolvimento_site",
      "agenciamento_gestao", "edicao_musical", "licenciamento_musical", "distribuicao_digital",
      "patrocinio", "seguros", "sincronizacao", "videoclipe", "consultoria", "infraestrutura",
    ];
    for (const slug of removed) {
      const label = formatCategoryLabel(slug);
      expect(label).not.toContain("_");
      expect(label).toBe(label.charAt(0).toUpperCase() + label.slice(1));
    }
    expect(formatCategoryLabel("folha_pagamento")).toBe("Folha Pagamento");
    expect(formatCategoryLabel("gestao_carreira")).toBe("Gestao Carreira");
  });

  it("legacy transaction slugs still resolve to accented labels through canonicalization, not the dictionary", () => {
    expect(transactionCategoryLabel("patrocinio")).toBe("Patrocínio");
    expect(transactionCategoryLabel("sincronizacao")).toBe("Sincronização");
    expect(transactionCategoryLabel("videoclipe")).toBe("Videoclipe");
    expect(transactionCategoryLabel("consultoria")).toBe("Consultoria");
    expect(transactionCategoryLabel("infraestrutura")).toBe("Infraestrutura");
    expect(transactionCategoryLabel("direitos-autorais")).toBe("Direitos autorais");
  });
});
