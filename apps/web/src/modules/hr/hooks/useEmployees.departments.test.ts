import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "./useEmployees";

// DEPARTMENTS are persisted verbatim as employees.department and offered in the employee form / HR filter selects.
describe("employee DEPARTMENTS (persisted verbatim)", () => {
  it.each(["Administrativo", "Comercial", "Financeiro", "Jurídico", "Operações", "Produção Musical", "RH"])(
    "offers %s",
    (dep) => {
      expect(DEPARTMENTS).toContain(dep);
      expect(DEPARTMENTS.filter((d) => d === dep)).toHaveLength(1);
    },
  );
  it("keeps the exact ordered list", () => {
    expect([...DEPARTMENTS]).toEqual([
      "Administrativo", "Financeiro", "Marketing", "Jurídico", "Produção Musical", "A&R", "TI", "RH", "Comercial", "Operações",
    ]);
  });
  it.each(["Juridico", "Operacoes", "Producao Musical", "rh", "Rh", "administrativo", "Comercial "])(
    "near-miss %j is not an offered department",
    (near) => {
      expect(DEPARTMENTS as readonly string[]).not.toContain(near);
    },
  );
});
