/**
 * ArtistaSignupPublic.route-contract.guard.test.ts
 *
 * Guarda permanente: o formulário público de cadastro de artista (Artist
 * Public Form — canal oficial de captação, decisão de produto 2026-08-22)
 * chamava POST /public/artists, uma rota que nunca existiu no backend (o
 * real é /public/artist-registration, LeadsController/
 * public-registration.controller.ts) — todo envio real retornava 404. Além
 * disso o payload usava nomes de campo pt-BR (nome_artistico, nome_civil...)
 * incompatíveis com PublicArtistRegistrationDto (artistName/artisticName/
 * fullName/email — camelCase). Este teste falha se qualquer uma das duas
 * regressões voltar.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ArtistaSignupPublic.tsx"), "utf8");

describe("ArtistaSignupPublic — real contract with /public/artist-registration", () => {
  it("calls the real backend route (not /public/artists, which never existed)", () => {
    expect(SOURCE).toMatch(/"\/public\/artist-registration"/);
    expect(SOURCE).not.toMatch(/"\/public\/artists"/);
  });

  it("sends the real DTO's required fields (artistName/artisticName/fullName/email/acceptedTerms)", () => {
    expect(SOURCE).toMatch(/artistName:\s*nomeArtistico\.trim\(\)/);
    expect(SOURCE).toMatch(/artisticName:\s*nomeArtistico\.trim\(\)/);
    expect(SOURCE).toMatch(/fullName:\s*nome\.trim\(\)/);
    expect(SOURCE).toMatch(/email:\s*email\.trim\(\)/);
    expect(SOURCE).toMatch(/acceptedTerms,/);
  });

  it("preserves fields without their own DTO column via additionalData (drops no data)", () => {
    expect(SOURCE).toMatch(/additionalData/);
    expect(SOURCE).toMatch(/banco:\s*banco/);
  });
});
