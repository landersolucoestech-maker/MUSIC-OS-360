import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserEditorModal } from "./UserEditorModal";
import type { UserAccount } from "@/modules/settings/hooks/useUsers";

/**
 * RBAC S4a (web): the role picker sends canonical English slugs, shows PT-BR names, collapses the
 * legacy/canonical rows of one role into one option and pre-selects a member persisted under a legacy slug.
 */
const updateMutateAsync = vi.fn();
const inviteMutateAsync = vi.fn();

const row = (id: string, slug: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, slug, name, is_assignable: true, archived_at: null, ...extra,
});
const ROLES = [
  row("r-jur", "juridico", "Jurídico"),
  row("r-legal", "legal", "Jurídico", { is_assignable: false }),
  row("r-artist", "artist", "Artista"),
  row("r-artista", "artista", "Artista (legado)"),
  row("r-admin", "admin", "Administrador"),
];

vi.mock("@/modules/settings/hooks/useRoles", () => ({
  useRoles: () => ({ roles: ROLES, inviteUser: { mutateAsync: inviteMutateAsync, isPending: false } }),
}));
vi.mock("@/modules/settings/hooks/useUsers", () => ({
  useUsers: () => ({ updateUser: { mutateAsync: updateMutateAsync, isPending: false } }),
}));

const member = (role: string): UserAccount => ({
  id: "u1", email: "ana@example.com", full_name: "Ana Souza", phone: "", avatar_url: null, role, status: "active", created_at: "2026-01-01",
});

describe("UserEditorModal canonical role slugs", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([["juridico"], ["legal"]])("a member persisted as %s is pre-selected as the single Jurídico option and saved as legal", async (persisted) => {
    render(<UserEditorModal open onOpenChange={() => {}} user={member(persisted)} mode="edit" />);
    expect(screen.getAllByText("Jurídico").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", role: "legal" }));
  });

  it("a legacy artista member is saved as artist (same option as the canonical row)", async () => {
    render(<UserEditorModal open onOpenChange={() => {}} user={member("artista")} mode="edit" />);
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ role: "artist" }));
  });

  it("unmapped roles are sent unchanged (admin stays admin; never rewritten to something else)", async () => {
    render(<UserEditorModal open onOpenChange={() => {}} user={member("admin")} mode="edit" />);
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("an unknown persisted role is never silently mapped to a real one: it is forwarded verbatim for the API to reject", async () => {
    render(<UserEditorModal open onOpenChange={() => {}} user={member("constructor")} mode="edit" />);
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ role: "constructor" }));
  });
});
