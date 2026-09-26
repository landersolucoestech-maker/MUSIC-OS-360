/**
 * registro-musicas.mapper.test.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — contrato de works): fixa
 * comportamentalmente o contrato canônico do formulário de obras, para que
 * nenhuma alteração futura reintroduza os anti-padrões já corrigidos:
 *   - Rodada 8 (correção): `cod_abramus` foi renomeado para `cod_entidade`
 *     (migration RestoreEcadAddEntityCodeColumn 20260718000017) — continua
 *     sendo UMA coluna simples, só que o nome não amarra o campo a uma única
 *     sociedade (o valor pode ser um código na ABRAMUS, na UBC, na SOCINPRO,
 *     entre outras). `cod_ecad` CONTINUA existindo como coluna própria — ECAD
 *     é entidade central e obrigatória, não fungível com `cod_entidade`.
 *   - `compositor` (singular) e `editora` são campos legados/bulk — o
 *     formulário interativo NUNCA os envia; a fonte real de autoria é
 *     `participantes`, da qual `compositores`/`letristas` são derivados.
 *   - `metadata` nunca recebe campos formais do formulário de obras.
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
