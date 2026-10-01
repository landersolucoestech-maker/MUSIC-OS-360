import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The release form persists its state in releases.metadata (jsonb). Those KEYS are canonical
 * English (migration 20260930000019); the Portuguese spellings may only appear in the dual-read
 * helper (lib/release-metadata.ts) and in the legacy `projects.description` JSON reader.
 */
const source = readFileSync(join(__dirname, "ReleaseFormModal.tsx"), "utf8");
const LEGACY_KEYS = [
  "variosArtistas", "generoSecundario", "copyrightDataLancamento", "copyrightDataGravacao", "artistasAdicionaisAlbum",
  "isVersionAlternativa", "tipoVersao", "artistasAdicionais", "musicos",
];

describe("ReleaseFormModal persisted metadata keys", () => {
  it.each(LEGACY_KEYS)("never mentions the legacy key %s", (key) => {
    expect(source).not.toMatch(new RegExp(`\\b${key}\\b`));
  });

  it("writes the canonical tracks key through the dual-read canonicalizer and never `faixas`", () => {
    expect(source).toContain("tracks: savableTracks");
    expect(source).not.toMatch(/\bfaixas\s*:/);
    expect(source).not.toMatch(/\[\s*"faixas"\s*\]/);
    expect(source).toContain("canonicalReleaseMetadata(enrichedMeta)");
  });
});
