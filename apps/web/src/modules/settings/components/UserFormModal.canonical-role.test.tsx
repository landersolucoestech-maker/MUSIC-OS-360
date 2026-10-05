import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { UserFormModal } from "./UserFormModal";

vi.mock("@/modules/settings/hooks/useUsers", () => ({
  useUsers: () => ({ updateUser: { mutateAsync: vi.fn() } }),
}));

/** RBAC S4a (web): machine values of the access-level select are canonical English, labels PT-BR. */
const SOURCE = fs.readFileSync(path.resolve(__dirname, "UserFormModal.tsx"), "utf8");
const block = SOURCE.slice(SOURCE.indexOf("const ACCESS_LEVELS"), SOURCE.indexOf("];", SOURCE.indexOf("const ACCESS_LEVELS")));
const values = [...block.matchAll(/value:\s*"([^"]+)"/g)].map((m) => m[1]);

describe("UserFormModal ACCESS_LEVELS", () => {
  it("uses canonical English machine values for every role that has a canonical slug", () => {
    for (const canonical of ["legal", "marketing", "artist", "collaborator", "viewer"]) expect(values).toContain(canonical);
  });

  it("no longer emits the Portuguese role slugs that have a canonical form", () => {
    for (const legacy of ["juridico", "colaborador", "artista", "leitor", "comercial", "produtor", "rh_manager"]) {
      expect(values).not.toContain(legacy);
    }
  });

  it("does not offer the roles the API rejects with ROLE_UNKNOWN", () => {
    for (const rejected of ["admin_master", "ar_gestao", "financeiro_contabil"]) expect(values).not.toContain(rejected);
    expect(values).toHaveLength(5);
  });

  it("keeps PT-BR labels", () => {
    expect(block).toContain('label: "Jurídico"');
    expect(block).toContain('label: "Colaborador / Freelancer"');
    expect(block).toContain('label: "Leitor (somente leitura)"');
  });

  it.each([["juridico"], ["legal"]])("prefills a member persisted as %s with the Jurídico option", (role) => {
    const member = { id: "u1", name: "Ana", email: "ana@example.com", phone: null, status: "active", role };
    render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    expect(screen.getAllByText("Jurídico").length).toBeGreaterThan(0);
  });
});
