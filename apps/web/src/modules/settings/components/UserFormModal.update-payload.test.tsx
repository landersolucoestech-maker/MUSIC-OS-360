import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserFormModal } from "./UserFormModal";

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/settings/hooks/useUsers", () => ({
  useUsers: () => ({ updateUser: { mutateAsync } }),
}));

describe("UserFormModal update payload", () => {
  it("sends the access level as `role` (PATCH /users/:id/role { role }), never as the legacy `cargo` key", async () => {
    const member = { id: "u1", name: "Ana Souza", email: "ana@example.com", phone: null, status: "active", role: "legal" };
    const { container } = render(<UserFormModal open onOpenChange={() => {}} user={member} mode="edit" />);
    fireEvent.submit(container.ownerDocument.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({ id: "u1", full_name: "Ana Souza", role: "legal" });
    expect(payload).not.toHaveProperty("cargo");
  });
});
