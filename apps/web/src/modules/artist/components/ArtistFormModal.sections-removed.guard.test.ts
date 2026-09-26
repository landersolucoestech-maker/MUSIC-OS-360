/**
 * ArtistFormModal.sections-removed.guard.test.ts
 *
 * Permanent guard (Task AA): the "Classificação e Vínculos",
 * "Equipe de Gestão" and "Mídia Adicional" sections are no longer part of
 * artist create/edit. The fields behind them still exist in the domain
 * (type/status/contrato_id are widely used; manager_*, produtor_executivo,
 * agencia_booking, label_parceira and galeria_urls remain in the Reports
 * contract; galeria_urls, documentos and contatos_equipe remain shown in the
 * 360 profile) — only the create/edit UI was removed. This test fails if any
 * of the three sections, their controls, or the local state that fed them
 * come back to this file.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ArtistFormModal.tsx"), "utf8");

describe("ArtistFormModal — the three discontinued sections do not reappear", () => {
  it("no discontinued section title is rendered", () => {
    expect(SOURCE).not.toMatch(/>\s*Classificação e Vínculos\s*</);
    expect(SOURCE).not.toMatch(/>\s*Equipe de Gestão\s*</);
    expect(SOURCE).not.toMatch(/>\s*Mídia Adicional\s*</);
  });

  it("no control exclusive to those sections is rendered (data-testid)", () => {
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

  it("no local state exclusive to those sections was reintroduced", () => {
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

  it("the create/update payload no longer sends fields exclusive to those sections", () => {
    expect(SOURCE).not.toMatch(/manager_nome\s*:/);
    expect(SOURCE).not.toMatch(/manager_contato\s*:/);
    expect(SOURCE).not.toMatch(/produtor_executivo\s*:/);
    expect(SOURCE).not.toMatch(/agencia_booking\s*:/);
    expect(SOURCE).not.toMatch(/label_parceira\s*:/);
    expect(SOURCE).not.toMatch(/galeria_urls\s*:/);
  });
});
