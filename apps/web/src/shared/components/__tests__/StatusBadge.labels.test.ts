/**
 * Guard: status/priority badges render PT-BR labels only. Canonical enum values
 * (English, technical) must never reach the UI raw or "prettified" into English.
 */
import { describe, expect, it } from "vitest";
import { STATUS_LABELS_PT_BR_BY_DOMAIN, type StatusDomain } from "@music-os-360/types";
import { UNKNOWN_STATUS_LABEL, statusLabel, statusToVariant } from "../StatusBadge";

const domains = Object.keys(STATUS_LABELS_PT_BR_BY_DOMAIN) as StatusDomain[];

describe("statusLabel — PT-BR only", () => {
  it.each(domains)("every canonical %s status has a PT-BR label (with and without domain)", (domain) => {
    for (const value of Object.keys(STATUS_LABELS_PT_BR_BY_DOMAIN[domain])) {
      for (const label of [statusLabel(value, domain), statusLabel(value)]) {
        expect(label).not.toBe(value);
        expect(label).not.toBe(UNKNOWN_STATUS_LABEL);
        expect(label).not.toMatch(/_/);
      }
    }
  });

  it("uses the domain wording when given", () => {
    expect(statusLabel("signed", "contract")).toBe("Assinado");
    expect(statusLabel("under_review", "contract")).toBe("Em análise");
  });

  it("never prettifies an unknown value into English", () => {
    expect(statusLabel("totally_new_state")).toBe(UNKNOWN_STATUS_LABEL);
    expect(statusLabel("awaiting_signature")).toBe("Aguardando assinatura");
  });
});

describe("legacy Portuguese status slugs (dual-read)", () => {
  it.each([
    ["concluido", "Concluído", "success"],
    ["em_andamento", "Em Andamento", "info"],
    ["pendente", "Pendente", "warning"],
    ["cancelado", "Cancelado", "danger"],
    ["rascunho", "Rascunho", "neutral"],
  ])("%s resolves to the canonical label and variant", (legacy, label, variant) => {
    expect(statusLabel(legacy)).toBe(label);
    expect(statusToVariant(legacy)).toBe(variant);
  });
});
