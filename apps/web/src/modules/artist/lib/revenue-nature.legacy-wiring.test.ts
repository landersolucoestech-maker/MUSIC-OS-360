import { describe, expect, it } from "vitest";
import { NATURE_BUCKETS, matchesNatureBucket } from "./revenue-nature";

const bucket = (label: string) => NATURE_BUCKETS.find((b) => b.label === label)!;

describe("matchesNatureBucket applies the legacy -> canonical category mapping", () => {
  // The legacy slug contains no bucket keyword itself ("sinc" is not "sync"): only its canonical
  // id (synchronization) lands it in the licensing bucket.
  it("legacy slug whose raw spelling has no keyword is bucketed through its canonical id", () => {
    const legacy = "sincronizacao";
    expect(legacy.includes("sync")).toBe(false);
    expect(matchesNatureBucket(bucket("Licenciamentos"), legacy)).toBe(true);
    expect(matchesNatureBucket(bucket("Licenciamentos"), "synchronization")).toBe(true);
  });

  it("negative: the same legacy slug does not land in unrelated buckets", () => {
    for (const label of ["Royalties", "Shows", "Publicidade", "Distribuição"]) {
      expect(matchesNatureBucket(bucket(label), "sincronizacao")).toBe(false);
    }
  });

  it("negative: unrelated and empty categories match no bucket", () => {
    for (const b of NATURE_BUCKETS) {
      expect(matchesNatureBucket(b, "receitas-musicais")).toBe(false);
      expect(matchesNatureBucket(b, null)).toBe(false);
    }
  });
});
