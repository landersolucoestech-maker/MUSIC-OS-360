/**
 * Guard: employee documents have no backend (employee_documents is in
 * PENDING_TABLES), so the HR page must not wire upload/delete/list for them.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const HR = fs.readFileSync(path.resolve(__dirname, "HR.tsx"), "utf8");

describe("HR documents tab is honestly unavailable", () => {
  it("renders the unavailable state and no document persistence", () => {
    expect(HR).toMatch(/<EmployeeDocumentsUnavailable \/>/);
    expect(HR).not.toMatch(/useEmployeeDocuments/);
    expect(HR).not.toMatch(/FileUpload/);
    expect(HR).not.toMatch(/deleteDocument|addDocument/);
    expect(fs.existsSync(path.resolve(__dirname, "../hooks/useEmployeeDocuments.ts"))).toBe(false);
  });
});
