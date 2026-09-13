/**
 * artista-tipo-canonical.guard.test.ts
 *
 * Guarda permanente (Artists Schema 15): o conceito de "tipo de formação do
 * artista" (solo/banda/duo/trio/grupo/coletivo, e a forma antiga
 * "artista_solo") foi REMOVIDO do domínio Artist — não normalizado, não
 * substituído por outro campo. `ArtistaTipo` não existe mais como tipo
 * exportado, `tipoArtista` não existe mais em nenhuma das formas de
 * formulário/mapper, e `Artista.tipo` não existe mais como propriedade.
 *
 * Se este teste falhar, alguém reintroduziu o campo (com qualquer
 * vocabulário) sem essa ser uma decisão de produto deliberada e revisada.
 *
 * NÃO usa grep ingênuo por "tipo" — a palavra é legítima em outros campos
 * (tipo_perfil, ArtistaRelacionamento.tipo, artist-form.definition.ts tem
 * dezenas de outros "tipo" não relacionados). Verifica pontualmente pelos
 * identificadores exatos do conceito removido.
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

describe("artists domain — o campo tipo (formação do artista) foi removido, não normalizado", () => {
  it.each(FILES_TO_SCAN)("%s não declara ArtistaTipo nem tipoArtista", (file) => {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of REMOVED_IDENTIFIERS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("emptyPreservedInput() não tem propriedade tipoArtista", () => {
    expect(emptyPreservedInput()).not.toHaveProperty("tipoArtista");
  });

  it("artistToFormFields() não devolve tipoArtista para nenhum artista", () => {
    const fields = artistToFormFields({ nome_artistico: "X" } as never);
    expect(fields).not.toHaveProperty("tipoArtista");
  });

  it("artistToPreservedInput() não devolve tipoArtista", () => {
    const preserved = artistToPreservedInput({ nome_artistico: "X" } as never);
    expect(preserved).not.toHaveProperty("tipoArtista");
  });

  it("formToArtistPayload() nunca envia a chave tipo ao backend", () => {
    const fields = artistToFormFields({ nome_artistico: "X" } as never);
    const payload = formToArtistPayload({ ...fields, contratoId: "" });
    expect(payload).not.toHaveProperty("tipo");
  });
});
