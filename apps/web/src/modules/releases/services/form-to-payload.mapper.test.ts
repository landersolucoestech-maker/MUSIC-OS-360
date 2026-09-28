/**
 * form-to-payload.mapper.test.ts
 *
 * Permanent guard (2026-07-18 audit — no-metadata rule, releases):
 * formToReleasePayload used to write isrc_global, internal notes, notes,
 * record label, copyright, genre, language, assets and schedule inside
 * `metadata`, even though the read mapper (entity-to-form.mapper.ts) and the
 * `Release` type already expected these columns as top-level fields — the
 * ReleasesFormFieldColumns20260718000010 migration closed that gap in the
 * database/DTO; this test guarantees the write mapper uses the columns.
 */
import { describe, it, expect } from "vitest";
import { formToReleasePayload } from "./form-to-payload.mapper";
import type { ReleaseFormFields } from "./entity-to-form.mapper";
import { emptyReleaseFormFields } from "./entity-to-form.mapper";

function baseFields(overrides: Partial<ReleaseFormFields> = {}): ReleaseFormFields {
  return {
    ...emptyReleaseFormFields(),
    title: "Meu Lançamento",
    type: "single",
    isrcGlobal: "BR-XXX-25-00001",
    internalNotes: "nota interna",
    distributionNotes: "nota de distribuição",
    recordLabel: "Gravadora X",
    copyright: "(C) 2026 Gravadora X",
    genre: "MPB",
    language: "pt-br",
    ...overrides,
  };
}

describe("formToReleasePayload — canonical releases contract", () => {
  it("never sends `metadata` — each formal field goes to its own column", () => {
    const payload = formToReleasePayload(baseFields());
    expect(payload).not.toHaveProperty("metadata");
  });

  it("sends isrc_global, internal_notes, record_label, copyright, music_genre, language as top-level fields (CZ-038)", () => {
    const payload = formToReleasePayload(baseFields());
    expect(payload.isrc_global).toBe("BR-XXX-25-00001");
    expect(payload.internal_notes).toBe("nota interna");
    expect(payload.record_label).toBe("Gravadora X");
    expect(payload.copyright).toBe("(C) 2026 Gravadora X");
    expect(payload.music_genre).toBe("MPB");
    expect(payload.language).toBe("pt-br");
    for (const legacy of ["notas_internas", "gravadora", "idioma", "cronograma"]) expect(payload).not.toHaveProperty(legacy);
  });

  it("maps distributionNotes (form field name) to the canonical `notes` column", () => {
    const payload = formToReleasePayload(baseFields());
    expect(payload.notes).toBe("nota de distribuição");
  });

  it("sends assets/schedule as dedicated jsonb columns with English keys when filled", () => {
    const payload = formToReleasePayload(
      baseFields({ assetCoverUrl: "https://x/capa.png", scheduleRecordingDate: "2026-08-01" }),
    );
    expect(payload.assets).toMatchObject({ cover_url: "https://x/capa.png" });
    expect(payload.schedule).toMatchObject({ recording_date: "2026-08-01" });
  });

  it("does not send assets/schedule when no subfield was filled", () => {
    const payload = formToReleasePayload(baseFields());
    expect(payload).not.toHaveProperty("assets");
    expect(payload).not.toHaveProperty("schedule");
  });
});

/**
 * find-ed7823e9 (incompatible consumer): editing a release's metadata must
 * never send status. The old backend→form→backend mapping was lossy
 * (distributed→scheduled, archived→released,
 * assets_pending→metadata_pending, null→review) and every edit triggered a
 * nonexistent workflow transition (400). Status only changes via the workflow.
 */
import { releaseToFormFields } from "./entity-to-form.mapper";

describe("formToReleasePayload — status is never written by the form", () => {
  const statuses = [
    null, "draft", "metadata_pending", "assets_pending", "review", "approved",
    "scheduled", "distributed", "released", "archived", "cancelled",
  ];
  for (const status of statuses) {
    it(`round-trip of a lançamento in ${String(status)} does not send status on edit`, () => {
      const fields = releaseToFormFields({ id: "r1", title: "X", status } as never);
      const payload = formToReleasePayload(fields, "edit");
      expect(payload).not.toHaveProperty("status");
    });
  }

  it("creation also does not send status (backend sets DRAFT)", () => {
    expect(formToReleasePayload(baseFields(), "create")).not.toHaveProperty("status");
  });
});
