import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserViewModal } from "./UserViewModal";

vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

const member = (status: unknown) => ({
  id: "u1", fullName: "Ana Souza", email: "ana@example.com", role: "admin", status,
});

const badgeOf = (label: string) => screen.getByText(label, { selector: "div,span" }) as HTMLElement;

describe("UserViewModal legacy member status wiring", () => {
  it.each([
    ["ativo", "Ativo", "bg-success-soft"],
    ["active", "Ativo", "bg-success-soft"],
    ["inativo", "Inativo", "bg-muted"],
    ["inactive", "Inativo", "bg-muted"],
    ["suspenso", "Suspenso", "bg-muted"],
    ["suspended", "Suspenso", "bg-muted"],
    ["pendente", "Pendente", "bg-muted"],
    ["invited", "Pendente", "bg-muted"],
  ])("status %s renders the PT-BR label %s with the matching variant", (stored, label, variantClass) => {
    render(<UserViewModal open onOpenChange={() => {}} user={member(stored)} />);
    const badge = badgeOf(label);
    expect(badge.className).toContain(variantClass);
    if (variantClass === "bg-muted") expect(badge.className).not.toContain("bg-success-soft");
  });

  it("a legacy active member is never shown as neutral/inactive", () => {
    render(<UserViewModal open onOpenChange={() => {}} user={member("ativo")} />);
    expect(screen.queryByText("Inativo")).toBeNull();
    expect(badgeOf("Ativo").className).not.toContain("bg-muted");
  });

  it("an unrecognised status never gets the success variant (the badge variant falls back to inactive)", () => {
    render(<UserViewModal open onOpenChange={() => {}} user={member("whatever")} />);
    // The label reader defaults to Ativo while the variant reader is called with an inactive fallback: the variant must stay neutral.
    expect(badgeOf("Ativo").className).not.toContain("bg-success-soft");
    expect(badgeOf("Ativo").className).toContain("bg-muted");
  });
});
