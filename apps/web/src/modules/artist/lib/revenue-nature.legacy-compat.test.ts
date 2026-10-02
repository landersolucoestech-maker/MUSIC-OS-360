import { describe, expect, it } from "vitest";
import { NATURE_BUCKETS, matchesNatureBucket } from "./revenue-nature";

const bucket = (label: string) => NATURE_BUCKETS.find((b) => b.label === label)!;

describe("revenue nature legacy Portuguese category keywords", () => {
  it.each(["anuncio", "anuncio-digital", "patrocinio"])("stored legacy category %j lands in Publicidade", (category) => {
    expect(matchesNatureBucket(bucket("Publicidade"), category)).toBe(true);
    expect(matchesNatureBucket(bucket("Royalties"), category)).toBe(false);
  });

  it("canonical English categories still match their bucket", () => {
    expect(matchesNatureBucket(bucket("Publicidade"), "sponsorship")).toBe(true);
  });
});
