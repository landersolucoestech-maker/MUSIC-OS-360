import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserFormModal } from "./UserFormModal";

vi.mock("@/modules/settings/hooks/useUsers", () => ({
  useUsers: () => ({ updateUser: { mutateAsync: vi.fn() } }),
}));

describe("UserFormModal edit mode", () => {
  it("prefills the phone field from the canonical `phone` property", () => {
    const member = { id: "u1", name: "Ana Souza", email: "ana@example.com", phone: "(11) 91234-5678", status: "active", role: "admin_master" };
    render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    expect((screen.getByPlaceholderText("(00) 00000-0000") as HTMLInputElement).value).toBe("(11) 91234-5678");
  });

  it("leaves the phone field empty when the member has no phone", () => {
    const member = { id: "u2", name: "Bia", email: "bia@example.com", phone: null, status: "active", role: "admin_master" };
    render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    expect((screen.getByPlaceholderText("(00) 00000-0000") as HTMLInputElement).value).toBe("");
  });
});

describe("UserFormModal edit mode: legacy member status prefill", () => {
  const statusTrigger = () => screen.getAllByRole("combobox")[0] as HTMLElement;
  const legacy: Array<[string, string]> = [
    ["ativo", "Ativo"],
    ["inativo", "Inativo"],
    ["suspenso", "Suspenso"],
  ];

  it.each(legacy)("a member stored with legacy status %s preselects the %s option", (stored, label) => {
    const member = { id: "u3", name: "Caio", email: "caio@example.com", phone: null, status: stored, role: "admin_master" };
    render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    expect(statusTrigger().textContent).toBe(label);
  });

  it("an unrecognised status falls back to the canonical Ativo default, never a raw value", () => {
    const member = { id: "u4", name: "Dani", email: "dani@example.com", phone: null, status: "whatever", role: "admin_master" };
    render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    expect(statusTrigger().textContent).toBe("Ativo");
  });
});
