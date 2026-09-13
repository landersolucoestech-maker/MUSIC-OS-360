/**
 * ArtistFormModal.sections-removed.guard.test.ts
 *
 * Guarda permanente (Task AA): as seções "Classificação e Vínculos",
 * "Equipe de Gestão" e "Mídia Adicional" deixaram de fazer parte do
 * cadastro/edição de Artista. Os campos por trás delas continuam existindo
 * no domínio (type/status/contrato_id são usados amplamente; manager_*,
 * produtor_executivo, agencia_booking, label_parceira e galeria_urls
 * seguem no contrato de Relatórios; galeria_urls, documentos e
 * contatos_equipe seguem exibidos no Perfil 360) — só a UI de
 * cadastro/edição foi removida. Este teste falha se qualquer uma das três
 * seções, seus controles, ou o estado local que as alimentava, voltarem a
 * este arquivo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ArtistFormModal.tsx"), "utf8");

describe("ArtistFormModal — as três seções descontinuadas não reaparecem", () => {
  it("nenhum título de seção descontinuada é renderizado", () => {
    expect(SOURCE).not.toMatch(/>\s*Classificação e Vínculos\s*</);
    expect(SOURCE).not.toMatch(/>\s*Equipe de Gestão\s*</);
    expect(SOURCE).not.toMatch(/>\s*Mídia Adicional\s*</);
  });

  it("nenhum controle exclusivo dessas seções é renderizado (data-testid)", () => {
    const removedTestIds = [
      "select-type-artista",
      "select-status-artista",
      "select-contrato",
      "button-remover-contrato",
      "input-manager-nome",
      "input-manager-contato",
      "input-produtor-executivo",
      "input-agencia-booking",
      "input-label-parceira",
      "input-galeria-url",
      "input-documento-nome",
      "input-documento-url",
    ];
    for (const testId of removedTestIds) {
      expect(SOURCE).not.toContain(`"${testId}"`);
    }
  });

  it("nenhum estado local exclusivo dessas seções foi reintroduzido", () => {
    const removedIdentifiers = [
      "managerNome", "managerContato", "produtorExecutivo",
      "agenciaBooking", "labelParceira", "documentosList",
      "galeriaUrls", "galeriaInput", "docNomeInput", "docUrlInput",
      "TIPO_ARTISTA_OPTIONS", "STATUS_ARTISTA_OPTIONS",
    ];
    for (const identifier of removedIdentifiers) {
      expect(SOURCE).not.toContain(identifier);
    }
  });

  it("o payload de create/update não envia mais campos exclusivos dessas seções", () => {
    expect(SOURCE).not.toMatch(/manager_nome\s*:/);
    expect(SOURCE).not.toMatch(/manager_contato\s*:/);
    expect(SOURCE).not.toMatch(/produtor_executivo\s*:/);
    expect(SOURCE).not.toMatch(/agencia_booking\s*:/);
    expect(SOURCE).not.toMatch(/label_parceira\s*:/);
    expect(SOURCE).not.toMatch(/galeria_urls\s*:/);
  });
});
