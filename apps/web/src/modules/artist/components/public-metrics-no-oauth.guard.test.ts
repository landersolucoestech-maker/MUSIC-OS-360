import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * SUBCLUSTER C — public artist metrics are NOT an account connection.
 *
 * They come from Soundcharts with PLATFORM credentials (INTERNAL_PLATFORM),
 * resolved by the artist's own identifiers. So the metrics UI must never ask
 * the customer for OAuth or suggest an account needs "linking" — that would send
 * the user to perform an action that does not exist and would fix nothing.
 *
 * A textual guard on purpose: the defect is in COPY, and it is exactly what
 * comes back when someone edits the screen without knowing the architecture.
 */
const FILE = join(__dirname, "ArtistPlatformMetrics.tsx");
const source = readFileSync(FILE, "utf8");

describe("Public artist metrics do not ask for an account connection", () => {
  it("does not suggest linking/connecting an account for public metrics", () => {
    for (const forbidden of [
      "sem conta vinculada",
      "Conecte seu Instagram",
      "Conecte seu TikTok",
      "Conecte sua conta Soundcharts",
      "Conta não vinculada",
      "Vincular conta",
    ]) {
      expect(source, `copy proibida encontrada: "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("offers no OAuth flow from the metrics screen", () => {
    for (const forbidden of ["oauth/init", "oauth/exchange", "connectAccount("]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("uses an honest cause when the profile is not found at the source", () => {
    expect(source).toContain("perfil não localizado na fonte");
  });
});
