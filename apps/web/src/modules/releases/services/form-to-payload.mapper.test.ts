/**
 * form-to-payload.mapper.test.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — regra sem-metadata, lançamentos):
 * formToLancamentoPayload gravava isrc_global, notas_internas, notes,
 * gravadora, copyright, genero, idioma, assets e cronograma dentro de
 * `metadata`, apesar do mapper de leitura (entity-to-form.mapper.ts) e do
 * type `Lancamento` já esperarem essas colunas como campos de topo — a
 * migration ReleasesFormFieldColumns20260718000010 fechou essa lacuna no
 * banco/DTO; este teste garante que o mapper de escrita usa as colunas.
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

describe("formToLancamentoPayload — contrato canônico de releases", () => {
  it("nunca envia `metadata` — cada campo formal vai para sua própria coluna", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload).not.toHaveProperty("metadata");
  });

  it("envia isrc_global, notas_internas, gravadora, copyright, music_genre, idioma como campos de topo", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload.isrc_global).toBe("BR-XXX-25-00001");
    expect(payload.notas_internas).toBe("nota interna");
    expect(payload.gravadora).toBe("Gravadora X");
    expect(payload.copyright).toBe("(C) 2026 Gravadora X");
    expect(payload.music_genre).toBe("MPB");
    expect(payload.idioma).toBe("pt-BR");
  });

  it("mapeia notasDistribuicao (nome do form) para a coluna canônica `notes`", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload.notes).toBe("nota de distribuição");
  });

  it("envia assets/cronograma como colunas jsonb dedicadas quando preenchidos", () => {
    const payload = formToLancamentoPayload(
      baseFields({ assetCapaUrl: "https://x/capa.png", cronGravacao: "2026-08-01" }),
    );
    expect(payload.assets).toMatchObject({ capa_url: "https://x/capa.png" });
    expect(payload.cronograma).toMatchObject({ data_gravacao: "2026-08-01" });
  });

  it("não envia assets/cronograma quando nenhum subcampo foi preenchido", () => {
    const payload = formToLancamentoPayload(baseFields());
    expect(payload).not.toHaveProperty("assets");
    expect(payload).not.toHaveProperty("cronograma");
  });
});
