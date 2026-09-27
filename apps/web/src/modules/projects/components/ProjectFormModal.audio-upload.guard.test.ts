/**
 * ProjectFormModal.audio-upload.guard.test.ts
 *
 * Permanent guard (Task T — continuity): `uploadFile` was a stub that
 * always returned `null` — the per-song audio upload never sent anything
 * anywhere, but showed "Arquivo de áudio carregado localmente." as
 * if it had worked (false success). `musica.audioUrl` was never
 * filled, so even after saving the project the audio was lost. This test
 * fails if the stub comes back (or if the real R2 upload is removed).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ProjectFormModal.tsx"), "utf8");

describe("ProjectFormModal — audio upload uses the real backend (Task T)", () => {
  it("no longer contains the stub that always returned null", () => {
    expect(SOURCE).not.toMatch(/async\s*\(_file: File\)[^{]*=>\s*null/);
  });

  it("uses useUploadToR2 to actually upload the file", () => {
    expect(SOURCE).toMatch(/useUploadToR2/);
    expect(SOURCE).toMatch(/category:\s*"audio"/);
  });

  it("never shows success without a real URL (no 'carregado localmente' toast masking a failure)", () => {
    expect(SOURCE).not.toMatch(/Arquivo de áudio carregado localmente/);
  });
});
