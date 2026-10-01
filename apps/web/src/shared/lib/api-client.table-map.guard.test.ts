import { describe, expect, it } from "vitest";
import { PENDING_TABLES, TABLE_ENDPOINT } from "./api-client";

describe("storage table map safety", () => {
  it("never maps a document table onto the employees route (a delete would soft-delete an employee)", () => {
    expect(Object.keys(TABLE_ENDPOINT)).not.toContain("employee_documents");
    expect(Object.keys(PENDING_TABLES)).toContain("employee_documents");
  });

  it("maps /hr/employees only from the employees table", () => {
    const owners = Object.entries(TABLE_ENDPOINT).filter(([, endpoint]) => endpoint === "/hr/employees").map(([table]) => table);
    expect(owners).toEqual(["employees"]);
  });
});
