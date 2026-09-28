/**
 * artist-type-canonical.guard.test.ts
 *
 * Permanent guard (Artists Schema 15): the concept of "artist line-up type"
 * (solo/band/duo/trio/group/collective, and the old "artista_solo" form) was
 * REMOVED from the Artist domain — not normalized, not replaced by another
 * field. `ArtistaTipo` no longer exists as an exported type, `tipoArtista` no
 * longer exists in any form/mapper shape, and `Artista.tipo` no longer exists
 * as a property.
 *
 * If this test fails, someone reintroduced the field (with any vocabulary)
 * without it being a deliberate, reviewed product decision.
 *
 * It does NOT use a naive grep for "tipo" — the word is legitimate in other
 * fields (profile_type, ArtistRelationship.type, artist-form.definition.ts has
 * dozens of unrelated "tipo"). It checks the exact identifiers of the removed
 * concept.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { emptyPreservedInput, artistToPreservedInput } from "./forms/artist-form.definition";
import { artistToFormFields, formToArtistPayload } from "./services/artist.mapper";

const REMOVED_IDENTIFIERS = [/\bArtistaTipo\b/, /\btipoArtista\b/];

const FILES_TO_SCAN = [
  path.resolve(__dirname, "../../shared/types/enums.ts"),
  path.resolve(__dirname, "./services/artist.mapper.ts"),
  path.resolve(__dirname, "./forms/artist-form.definition.ts"),
  path.resolve(__dirname, "./types/artist.types.ts"),
];

describe("artists domain — the tipo field (artist line-up) was removed, not normalized", () => {
  it.each(FILES_TO_SCAN)("%s declares neither ArtistaTipo nor tipoArtista", (file) => {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of REMOVED_IDENTIFIERS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("emptyPreservedInput() has no tipoArtista property", () => {
    expect(emptyPreservedInput()).not.toHaveProperty("tipoArtista");
  });

  it("artistToFormFields() returns no tipoArtista for any artist", () => {
    const fields = artistToFormFields({ id: "a", stageName: "X" });
    expect(fields).not.toHaveProperty("tipoArtista");
  });

  it("artistToPreservedInput() returns no tipoArtista", () => {
    const preserved = artistToPreservedInput({ id: "a", stageName: "X" });
    expect(preserved).not.toHaveProperty("tipoArtista");
  });

  it("formToArtistPayload() never sends the tipo key to the backend", () => {
    const fields = artistToFormFields({ id: "a", stageName: "X" });
    const payload = formToArtistPayload({ ...fields, contractId: "" });
    expect(payload).not.toHaveProperty("tipo");
  });
});
