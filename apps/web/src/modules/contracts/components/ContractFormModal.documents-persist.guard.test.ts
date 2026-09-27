/**
 * ContractFormModal.documents-persist.guard.test.ts
 *
 * Permanent guard (REM-02 — Remaining Product Completion Backlog):
 * "Documentos Anexos" did a real upload to R2 via FileUpload/useUploadToR2,
 * but the `documents` array was never included in the saved payload — false
 * success: the upload worked, but the reference never survived a
 * reload (contracts.documents did not exist, and handleSubmit did not even read the
 * `documents` state). This test fails if the regression comes back.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ContractFormModal.tsx"), "utf8");

describe("ContractFormModal — attached documents persist on the contract (REM-02)", () => {
  it("includes documents in the payload sent to the backend", () => {
    expect(SOURCE).toMatch(/documents:\s*documents\s*\?\?\s*\[\]/);
  });

  it("passes the documents state to onSubmit at both submit points", () => {
    const matches = SOURCE.match(/onSubmit\(\{\s*\.\.\.data,\s*documents\s*\}\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("populates documents from the contract when editing (does not always reset to empty)", () => {
    expect(SOURCE).toMatch(/setDocuments\(initialData\.documents\s*\?\?\s*\[\]\)/);
    expect(SOURCE).toMatch(/documents:\s*Array\.isArray\(c\.documents\)/);
  });
});
