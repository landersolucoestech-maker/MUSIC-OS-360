/**
 * registro-musicas.mapper.test.ts
 *
 * Permanent guard (2026-07-18 audit — works contract): behaviorally pins
 * the canonical contract of the works form, so that
 * no future change reintroduces the already fixed anti-patterns:
 *   - Round 8 (fix): `cod_abramus` was renamed to `cod_entidade`
 *     (migration RestoreEcadAddEntityCodeColumn 20260718000017) — it is still
 *     ONE simple column, only the name no longer ties the field to a single
 *     society (the value may be a code at ABRAMUS, UBC, SOCINPRO,
 *     among others). `cod_ecad` KEEPS existing as its own column — ECAD
 *     is a central, mandatory entity, not fungible with `cod_entidade`.
 *   - `compositor` (singular) and `editora` are legacy/bulk fields — the
 *     interactive form NEVER sends them; the real authorship source is
 *     `participantes`, from which `compositores`/`letristas` are derived.
 *   - `metadata` never receives formal fields of the works form.
 */
import { describe, it, expect } from "vitest";
import {
  formToObraPayload,
  participantesToCompositoresLetristas,
  type ParticipanteForm,
} from "./registro-musicas.mapper";

function baseInput(participantes: ParticipanteForm[] = []) {
  return {
    title: "Minha Obra",
    generoMusical: "MPB",
    idioma: "pt-BR",
    iswc: "",
    codEcad: "ECAD-456",
    codEntidade: "ABR-123",
    duracaoMin: "3",
    duracaoSeg: "30",
    instrumental: "nao",
    criadaPorIA: "nao" as const,
    tipoIA: "",
    iaHarmonia: { ferramenta: "", prompt: "" },
    iaMelodia: { ferramenta: "", prompt: "" },
    iaLetra: { ferramenta: "", prompt: "" },
    outrosTitulos: [],
    referenciasConexas: [],
    letraCompleta: "",
    participantes,
    situacao: "analise",
    projectId: null,
    artistId: null,
    tipoObra: "original",
    orgId: "tenant-test",
  };
}

describe("formToObraPayload — canonical works contract", () => {
  it("sends `cod_ecad` and `cod_entidade` (the real canonical names) — never `cod_abramus`/`codigo_abramus`/`codigo_entidade`", () => {
    const payload = formToObraPayload(baseInput());
    expect(payload).toHaveProperty("cod_ecad", "ECAD-456");
    expect(payload).toHaveProperty("cod_entidade", "ABR-123");
    expect(payload).not.toHaveProperty("cod_abramus");
    expect(payload).not.toHaveProperty("codigo_abramus");
    expect(payload).not.toHaveProperty("codigo_entidade");
  });

  it("never sends `metadata`, `compositor` (singular) or `editora` — they are not interactive form fields", () => {
    const payload = formToObraPayload(baseInput());
    expect(payload).not.toHaveProperty("metadata");
    expect(payload).not.toHaveProperty("compositor");
    expect(payload).not.toHaveProperty("editora");
    expect(payload).not.toHaveProperty("co_compositores");
    expect(payload).not.toHaveProperty("detentores");
  });

  it("derives `compositores`/`letristas` from `participantes` — never duplicates free data", () => {
    const participantes: ParticipanteForm[] = [
      { id: "1", name: "Fulano", classeFuncao: "compositor/autor", link: "", percentual: "50" },
      { id: "2", name: "Beltrano", classeFuncao: "tradutor", link: "", percentual: "50" },
    ];
    const payload = formToObraPayload(baseInput(participantes));
    expect(payload.compositores).toEqual(["Fulano"]);
    expect(payload.letristas).toEqual(["Beltrano"]);
    expect(payload.participantes).toEqual(participantes);
  });

  it("participantesToCompositoresLetristas returns null when there are no participants in the matching class", () => {
    const result = participantesToCompositoresLetristas([]);
    expect(result.compositores).toBeNull();
    expect(result.letristas).toBeNull();
  });
});
