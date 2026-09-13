/**
 * ContractFormModal.documents-persist.guard.test.ts
 *
 * Guarda permanente (REM-02 — Remaining Product Completion Backlog):
 * "Documentos Anexos" fazia upload real ao R2 via FileUpload/useUploadToR2,
 * mas o array `documents` nunca era incluído no payload salvo — falso
 * sucesso: o upload funcionava, mas a referência nunca sobrevivia a um
 * reload (contracts.documents não existia, e o handleSubmit nem lia o
 * estado `documents`). Este teste falha se a regressão voltar.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ContractFormModal.tsx"), "utf8");

describe("ContractFormModal — documents anexos persistem no contrato (REM-02)", () => {
  it("inclui documents no payload enviado ao backend", () => {
    expect(SOURCE).toMatch(/documents:\s*documents\s*\?\?\s*\[\]/);
  });

  it("repassa o estado documents para o onSubmit em ambos os pontos de submit", () => {
    const matches = SOURCE.match(/onSubmit\(\{\s*\.\.\.data,\s*documents\s*\}\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("popula documents a partir do contrato ao editar (não reinicia sempre vazio)", () => {
    expect(SOURCE).toMatch(/setDocuments\(initialData\.documents\s*\?\?\s*\[\]\)/);
    expect(SOURCE).toMatch(/documents:\s*Array\.isArray\(c\.documents\)/);
  });
});
