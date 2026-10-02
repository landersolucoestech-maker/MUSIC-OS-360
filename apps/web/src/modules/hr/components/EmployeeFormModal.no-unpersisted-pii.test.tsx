import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { employeeSchema } from "../schemas/employee-schema";

const addMutate = vi.fn().mockResolvedValue(undefined);
const updateMutate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/modules/hr/hooks/useEmployees", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/hr/hooks/useEmployees")>()),
  useEmployees: () => ({
    addEmployee: { mutateAsync: addMutate, isPending: false },
    updateEmployee: { mutateAsync: updateMutate, isPending: false },
  }),
}));
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: [], isLoading: false }) }));

import { EmployeeFormModal } from "./EmployeeFormModal";

const REMOVED_FIELDS = ["rg", "birthDate", "address"] as const;
const REMOVED_PAYLOAD_KEYS = ["rg", "birthDate", "address", "data_nascimento", "endereco", "birth_date"];

describe("EmployeeFormModal does not collect unpersisted personal data", () => {
  it("renders no rg, birth date or address control", () => {
    const { container } = render(<EmployeeFormModal open onOpenChange={() => undefined} mode="create" />);
    expect(screen.queryByTestId("input-rg")).toBeNull();
    expect(screen.queryByTestId("input-address")).toBeNull();
    expect(screen.queryByTestId("datepicker-birth-date")).toBeNull();
    expect(container.ownerDocument.querySelector("#rg, #address, #birth_date")).toBeNull();
    expect(screen.queryByLabelText("RG")).toBeNull();
    expect(screen.queryByLabelText("Endereço")).toBeNull();
    expect(screen.queryByText("Data de Nascimento")).toBeNull();
  });

  it("submits a payload without the removed fields", async () => {
    render(<EmployeeFormModal open onOpenChange={() => undefined} mode="create" />);
    fireEvent.change(screen.getByTestId("input-full-name"), { target: { value: "Maria Silva" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    const payload = addMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.name).toBe("Maria Silva");
    for (const key of REMOVED_PAYLOAD_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(false);
    }
  });

  it("schema no longer declares the removed fields", () => {
    for (const field of REMOVED_FIELDS) {
      expect(Object.keys(employeeSchema.shape)).not.toContain(field);
    }
  });
});
