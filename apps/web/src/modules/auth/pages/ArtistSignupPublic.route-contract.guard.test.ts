/**
 * ArtistSignupPublic.route-contract.guard.test.ts
 *
 * Permanent guard: the public artist registration form (Artist
 * Public Form — official intake channel, product decision 2026-08-22)
 * called POST /public/artists, a route that never existed on the backend (the
 * real one is /public/artist-registration, LeadsController/
 * public-registration.controller.ts) — every real submission returned 404. Also,
 * the payload used pt-BR field names (nome_artistico, nome_civil...)
 * incompatible with PublicArtistRegistrationDto (artistName/artisticName/
 * fullName/email — camelCase). This test fails if either of the two
 * regressions comes back.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ArtistSignupPublic.tsx"), "utf8");

describe("ArtistSignupPublic — real contract with /public/artist-registration", () => {
  it("calls the real backend route (not /public/artists, which never existed)", () => {
    expect(SOURCE).toMatch(/"\/public\/artist-registration"/);
    expect(SOURCE).not.toMatch(/"\/public\/artists"/);
  });

  it("sends the real DTO's required fields (artistName/artisticName/fullName/email/acceptedTerms)", () => {
    expect(SOURCE).toMatch(/artistName:\s*stageName\.trim\(\)/);
    expect(SOURCE).toMatch(/artisticName:\s*stageName\.trim\(\)/);
    expect(SOURCE).toMatch(/fullName:\s*name\.trim\(\)/);
    expect(SOURCE).toMatch(/email:\s*email\.trim\(\)/);
    expect(SOURCE).toMatch(/acceptedTerms,/);
  });

  it("preserves fields without their own DTO column via additionalData (drops no data)", () => {
    expect(SOURCE).toMatch(/additionalData/);
    expect(SOURCE).toMatch(/banco:\s*banco/);
  });
});
