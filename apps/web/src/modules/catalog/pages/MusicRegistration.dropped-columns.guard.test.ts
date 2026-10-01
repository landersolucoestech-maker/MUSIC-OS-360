import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * phonograms.compositores/interpretes/produtores were dropped by migration 20260923000002; the
 * phonogram list and the release view read the structured `participation` instead.
 */
const read = (relative: string) => readFileSync(join(__dirname, relative), "utf8");

describe("phonogram consumers of the dropped participant columns", () => {
  it.each([
    ["MusicRegistration.tsx", "MusicRegistration.tsx"],
    ["ReleaseViewModal.tsx", "../../releases/components/ReleaseViewModal.tsx"],
  ])("%s never reads phonogram.compositores/interpretes/produtores", (_name, relative) => {
    const source = read(relative);
    expect(source).not.toMatch(/phonogram\.(compositores|interpretes|produtores)/);
    expect(source).not.toMatch(/sortKey="(compositores|interpretes|produtores)"/);
    expect(source).not.toMatch(/"interpretes"/);
  });

  it("the phonograms list renders the participant columns through participantNames", () => {
    const source = read("MusicRegistration.tsx");
    expect(source).toContain("PHONOGRAM_LIST_PARTICIPANT_COLUMNS");
    expect(source).toContain("participantNames(phonogram, column.key)");
  });
});
