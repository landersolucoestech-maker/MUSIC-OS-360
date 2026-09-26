import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Guarda permanente (auditoria 2026-07-19 — reconstrução de artists):
 * `FileUpload` (usado por artists/accounting/contracts/rh) tinha um stub fake
 * de upload (`setTimeout` + path fictício) e, para imagens, persistia um data
 * URL base64 na própria coluna de texto — nenhuma das duas é uma referência
 * real de storage. Agora usa `useUploadToR2` (presigned URL real).
 */
const src = fs.readFileSync(path.resolve(__dirname, "FileUpload.tsx"), "utf8");

describe("FileUpload — upload real (R2), nunca stub/base64", () => {
  it("uses useUploadToR2 to persist the file", () => {
    expect(src).toMatch(/useUploadToR2/);
  });

  it("no longer uses the setTimeout stub or a fake path", () => {
    expect(src).not.toMatch(/setTimeout\(r, 40\)/);
    expect(src).not.toMatch(/\$\{options\?\.folder/);
  });

  it("no longer persists a base64 data URL as the file's source of truth", () => {
    expect(src).not.toMatch(/readAsDataURL/);
  });
});
