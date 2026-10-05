import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTIST_ROLES, PRODUCER_ROLES } from "./credit-roles";

// Each role is the option value the credit Select of the release form offers and persists verbatim.
describe("release form credit role options", () => {
  it.each(["Artista Principal", "Intérprete", "Coro"])("artist credit select offers %s", (role) => {
    expect(ARTIST_ROLES).toContain(role);
  });
  it.each(["Produtor", "Produtor Executivo", "Mixagem", "Engenheiro de Masterização", "Engenheiro de Gravação"])(
    "producer/engineering credit select offers %s",
    (role) => {
      expect(PRODUCER_ROLES).toContain(role);
    },
  );
  it("keeps the exact option sets, in order", () => {
    expect(ARTIST_ROLES).toEqual(["Artista Principal", "Featuring", "Intérprete", "Remixer", "DJ", "Coro"]);
    expect(PRODUCER_ROLES).toEqual([
      "Produtor",
      "Co-Produtor",
      "Produtor Executivo",
      "Mixagem",
      "Engenheiro de Masterização",
      "Engenheiro de Gravação",
    ]);
  });
  it("rejects near-misses (unaccented, English, wrong-list roles)", () => {
    for (const near of ["Interprete", "Engenheiro de Masterizacao", "Engenheiro de Gravacao", "Artista principal", "Mixing", "Coros"]) {
      expect(ARTIST_ROLES).not.toContain(near);
      expect(PRODUCER_ROLES).not.toContain(near);
    }
    expect(ARTIST_ROLES).not.toContain("Produtor");
    expect(PRODUCER_ROLES).not.toContain("Coro");
  });
  it("the form modal feeds its credit selects from this module", () => {
    const src = readFileSync(join(__dirname, "../components/ReleaseFormModal.tsx"), "utf8");
    expect(src).toContain('from "@/modules/releases/lib/credit-roles"');
    expect(src).toContain("roles={ARTIST_ROLES}");
    expect(src).toContain("roles={PRODUCER_ROLES}");
  });
});
