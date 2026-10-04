// @ts-nocheck
// Wiring test: the CPF and phone inputs of EmployeeFormModal store the masked value.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/modules/hr/hooks/useEmployees", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/hr/hooks/useEmployees")>()),
  useEmployees: () => ({ addEmployee: { mutateAsync: vi.fn(), isPending: false }, updateEmployee: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: [], isLoading: false }) }));

import { EmployeeFormModal } from "./EmployeeFormModal";

describe("EmployeeFormModal masked inputs", () => {
  it("CPF and phone show the masked value", () => {
    render(<EmployeeFormModal open onOpenChange={() => undefined} mode="create" />);
    const cpf = screen.getByTestId("input-cpf");
    fireEvent.change(cpf, { target: { value: "12345678901" } });
    expect(cpf).toHaveValue("123.456.789-01");
    const phone = screen.getByTestId("input-phone");
    fireEvent.change(phone, { target: { value: "11987654321" } });
    expect(phone).toHaveValue("(11) 98765-4321");
    fireEvent.change(phone, { target: { value: "1133334444" } });
    expect(phone).toHaveValue("(11) 3333-4444");
  });

  it("negative: non-digit input is stripped, never stored raw", () => {
    render(<EmployeeFormModal open onOpenChange={() => undefined} mode="create" />);
    const cpf = screen.getByTestId("input-cpf");
    fireEvent.change(cpf, { target: { value: "abc" } });
    expect(cpf).toHaveValue("");
    const phone = screen.getByTestId("input-phone");
    fireEvent.change(phone, { target: { value: "(11) abc 9" } });
    expect(phone).toHaveValue("(11) 9");
  });
});
