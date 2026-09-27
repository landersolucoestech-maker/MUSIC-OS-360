/**
 * ProjectFormModal.metadata-guard.test.ts
 *
 * Permanent guard (audit 2026-07-18 — projects CRITICAL confirmed):
 * ProjectFormModal.tsx serialized musicas[] with JSON.stringify() inside
 * `descricao` (free text) — forbidden by the product rule. Normalized into
 * project_tracks (migration 20260718000013). This test fails if the file
 * serializes musicas into descricao again.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "ProjectFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("ProjectFormModal — does not serialize musicas into descricao", () => {
  it("no longer uses JSON.stringify(tracksToSave) or JSON.parse(project.descricao)", () => {
    expect(SOURCE).not.toMatch(/JSON\.stringify\(tracksToSave\)/);
    expect(SOURCE).not.toMatch(/JSON\.parse\(project\.descricao/);
  });

  it("sends musicas as a structured payload field (own storage via project_tracks)", () => {
    expect(SOURCE).toMatch(/musicas:\s*tracksToSave/);
  });

  it("reads musicas from `projeto.musicas` (hydrated by the API), not from descricao", () => {
    expect(SOURCE).toMatch(/\(project as \{ musicas\?: TrackData\[\] \}\)\.musicas/);
  });
});
