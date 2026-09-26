/**
 * form-to-payload.mapper.test.ts
 *
 * Permanent guard (2026-07-18 audit — no-metadata rule, releases):
 * formToLancamentoPayload used to write isrc_global, notas_internas, notes,
 * gravadora, copyright, genero, idioma, assets and cronograma inside
 * `metadata`, even though the read mapper (entity-to-form.mapper.ts) and the
 * `Lancamento` type already expected these columns as top-level fields — the
 * ReleasesFormFieldColumns20260718000010 migration closed that gap in the
 * database/DTO; this test guarantees the write mapper uses the columns.
 */
import { describe, it, expect } from "vitest";
import { formToLancamentoPayload } from "./form-to-payload.mapper";
import type { LancamentoFormFields } from "./entity-to-form.mapper";
import { emptyLancamentoFormFields } from "./entity-to-form.mapper";

function baseFields(overrides: Partial<LancamentoFormFields> = {}): LancamentoFormFields {
  return {
    ...emptyLancamentoFormFields(),
    title: "Meu Lançamento",
    type: "single",
    isrcGlobal: "BR-XXX-25-00001",
    notasInternas: "nota interna",
    notasDistribuicao: "nota de distribuição",
    gravadora: "Gravadora X",
    copyright: "(C) 2026 Gravadora X",
    genero: "MPB",
    idioma: "pt-BR",
    ...overrides,
  };
}

describe("formToLancamentoPayload — canonical releases contract", () => {
  it("never sends `metadata` — each formal field goes to its own column", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload).not.toHaveProperty("metadata");
  });

  it("sends isrc_global, notas_internas, gravadora, copyright, music_genre, idioma as top-level fields", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload.isrc_global).toBe("BR-XXX-25-00001");
    expect(payload.notas_internas).toBe("nota interna");
    expect(payload.gravadora).toBe("Gravadora X");
    expect(payload.copyright).toBe("(C) 2026 Gravadora X");
    expect(payload.music_genre).toBe("MPB");
    expect(payload.idioma).toBe("pt-BR");
  });

  it("maps notasDistribuicao (form field name) to the canonical `notes` column", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload.notes).toBe("nota de distribuição");
  });

  it("sends assets/cronograma as dedicated jsonb columns when filled", () => {
    const payload = formToLancamentoPayload(
      baseFields({ assetCapaUrl: "https://x/capa.png", cronGravacao: "2026-08-01" }),
    );
    expect(payload.assets).toMatchObject({ capa_url: "https://x/capa.png" });
    expect(payload.cronograma).toMatchObject({ data_gravacao: "2026-08-01" });
  });

  it("does not send assets/cronograma when no subfield was filled", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload).not.toHaveProperty("assets");
    expect(payload).not.toHaveProperty("cronograma");
  });
});

/**
 * find-ed7823e9 (incompatible consumer): editing a release's metadata must
 * never send status. The old backend→form→backend mapping was lossy
 * (distributed→scheduled, archived→released,
 * assets_pending→metadata_pending, null→review) and every edit triggered a
 * nonexistent workflow transition (400). Status only changes via the workflow.
 */
import { lancamentoToFormFields } from "./entity-to-form.mapper";

describe("formToLancamentoPayload — status is never written by the form", () => {
  const statuses = [
    null, "draft", "metadata_pending", "assets_pending", "review", "approved",
    "scheduled", "distributed", "released", "archived", "cancelled",
  ];
  for (const status of statuses) {
    it(`round-trip of a lançamento in ${String(status)} does not send status on edit`, () => {
      const fields = lancamentoToFormFields({ id: "r1", title: "X", status } as never);
      const payload = formToLancamentoPayload(fields, "edit");
      expect(payload).not.toHaveProperty("status");
    });
  }

  it("creation also does not send status (backend sets DRAFT)", () => {
    expect(formToLancamentoPayload(baseFields(), "create")).not.toHaveProperty("status");
  });
});
