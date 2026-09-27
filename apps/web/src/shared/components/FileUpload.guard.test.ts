import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Permanent guard (audit 2026-07-19 — artists rebuild):
 * `FileUpload` (used by artists/accounting/contracts/rh) had a fake upload
 * stub (`setTimeout` + fictitious path) and, for images, persisted a base64 data
 * URL in the text column itself — neither is a real storage
 * reference. It now uses `useUploadToR2` (real presigned URL).
 */
const src = fs.readFileSync(path.resolve(__dirname, "FileUpload.tsx"), "utf8");

describe("FileUpload — real upload (R2), never stub/base64", () => {
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
