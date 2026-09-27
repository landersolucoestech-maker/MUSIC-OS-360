import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/modules/hr/hooks/useEmployees", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/hr/hooks/useEmployees")>()),
  useEmployees: () => ({ addEmployee: { mutateAsync: vi.fn(), isPending: false }, updateEmployee: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock("@/modules/settings/hooks/useUsuarios", () => ({ useUsers: () => ({ users: [], isLoading: false }) }));

import { EmployeeFormModal } from "./EmployeeFormModal";

describe("EmployeeFormModal validation copy", () => {
  it("shows the full-name validation message (errors are keyed by the schema field)", async () => {
    render(<EmployeeFormModal open onOpenChange={() => undefined} mode="create" />);
    fireEvent.change(screen.getByPlaceholderText("Nome completo do funcionário"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
    expect(await screen.findByText("Nome deve ter no mínimo 2 caracteres")).toBeTruthy();
  });
});
