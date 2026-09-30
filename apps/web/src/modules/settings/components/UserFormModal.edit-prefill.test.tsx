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
