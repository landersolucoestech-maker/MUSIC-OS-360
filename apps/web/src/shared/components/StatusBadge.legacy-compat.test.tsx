import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, statusToVariant, statusLabel } from "./StatusBadge";

// legacy Portuguese slug -> canonical English status
const LEGACY: Array<[string, string]> = [
  ["pendente", "pending"], ["agendada", "scheduled"], ["analise", "analysis"], ["arquivado", "archived"],
  ["atrasado", "overdue"], ["concluida", "completed"], ["conectado", "connected"], ["em_analise", "analysis"],
  ["em_producao", "in_production"], ["pausado", "paused"], ["producao", "in_production"], ["revisao", "review"],
  ["aprovado", "approved"], ["ativa", "active"], ["planejamento", "planning"], ["agendado", "scheduled"],
  ["publicado", "published"], ["pago", "paid"], ["ativo", "active"], ["inativo", "inactive"], ["rejeitado", "rejected"],
];

describe("StatusBadge legacy Portuguese status slugs", () => {
  it.each(LEGACY)("renders legacy %s exactly as canonical %s", (legacy, canonical) => {
    expect(statusToVariant(legacy)).toBe(statusToVariant(canonical));
    expect(statusLabel(legacy)).toBe(statusLabel(canonical));
    const { unmount } = render(<StatusBadge status={legacy} />);
    expect(screen.getByText(statusLabel(canonical))).toBeTruthy();
    unmount();
  });

  it("an unknown slug stays unrecognized (the alias map is not a catch-all)", () => {
    expect(statusLabel("totalmente_desconhecido")).toBe("Status não reconhecido");
  });
});
