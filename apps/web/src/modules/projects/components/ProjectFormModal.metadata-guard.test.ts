/**
 * ProjectFormModal.metadata-guard.test.ts
 *
 * Permanent guard (audit 2026-07-18 — projects CRITICAL confirmed):
 * ProjectFormModal.tsx serialized the tracks array with JSON.stringify() inside
 * `descricao` (free text) — forbidden by the product rule. Normalized into
 * project_tracks (migration 20260718000013; wire field `tracks` since CZ-031).
 * This test fails if the file serializes the tracks into descricao again.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "ProjectFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("ProjectFormModal — does not serialize tracks into descricao", () => {
  it("no longer uses JSON.stringify(tracksToSave) or JSON.parse(project.descricao)", () => {
    expect(SOURCE).not.toMatch(/JSON\.stringify\(tracksToSave\)/);
    expect(SOURCE).not.toMatch(/JSON\.parse\(project\.descricao/);
  });

  it("sends tracks as a structured payload field (own storage via project_tracks)", () => {
    expect(SOURCE).toMatch(/tracks:\s*tracksToSave/);
  });

  it("reads tracks from `project.tracks` (hydrated by the API), not from descricao", () => {
    expect(SOURCE).toMatch(/\(project as \{ tracks\?: TrackData\[\] \}\)\.tracks/);
  });
});
