/**
 * Projects.metadata-guard.test.ts
 *
 * Permanent guard (audit 2026-07-18 — projects CRITICAL confirmed):
 * the bulk project import serialized the tracks array with JSON.stringify()
 * inside `descricao` — a real anti-pattern, fixed by the normalization into
 * project_tracks (migration 20260718000013).
 *
 * Part 86: bulk import no longer exists in Projects.tsx — Import
 * and Export now exist exclusively in the Reports Center
 * (modules/reports/), whose dedicated resolver for the computed field
 * `projects.tracks` (apps/api/.../computed-fields/project-tracks.field.ts)
 * is today the only bulk-import path and never writes to `descricao`
 * (covered by computed-fields/project-tracks.field.spec.ts and
 * import-commit.service.spec.ts). This test therefore guarantees the
 * structural absence of a SECOND client-side writer in Projects.tsx — if
 * it reappears, it must keep sending tracks structured, never serialized.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "Projects.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("Projects.tsx — no client-side bulk import (centralized in Reports, Part 86)", () => {
  it("no longer uses JSON.stringify(musicasParaSalvar) anywhere in the file", () => {
    expect(SOURCE).not.toMatch(/JSON\.stringify\(musicasParaSalvar\)/);
  });

  it("does not reintroduce a second bulk-import writer (addProjeto mutation outside the create/edit modal)", () => {
    expect(SOURCE).not.toMatch(/importXlsx/);
    expect(SOURCE).not.toMatch(/addProjeto\.mutateAsync/);
  });
});
