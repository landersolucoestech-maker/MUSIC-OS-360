import { describe, expect, it } from "vitest";
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import { skillFieldLabel, skillValueLabel, UNKNOWN_FIELD_LABEL } from "@/shared/lib/skill-output-labels.pt-br";
import { musicGenreLabel, releaseTypeLabel } from "@/modules/releases/lib/release-format";
import { legacyTarget } from "@/app/routes/legacy-redirects";

// Free text (stored values, AI output keys, URL query keys) must never resolve to an inherited Object member.
const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

describe("prototype keys: label lookups", () => {
  it.each(PROTOTYPE_KEYS)("formatCategoryLabel(%s) is a plain title-cased string", (key) => {
    const label = formatCategoryLabel(key);
    expect(typeof label).toBe("string");
    expect(label.toLowerCase()).toBe(key.replace(/_/g, "").toLowerCase());
  });

  it.each(PROTOTYPE_KEYS)("skill output %s uses the unknown-field label and the raw text", (key) => {
    expect(skillFieldLabel(key)).toBe(UNKNOWN_FIELD_LABEL);
    expect(skillValueLabel("status", key)).toBe(key);
    expect(skillValueLabel("platform", key)).toBe(key);
    expect(skillValueLabel(key, "x")).toBe("x");
  });

  it.each(PROTOTYPE_KEYS)("release type/genre %s fall back", (key) => {
    expect(releaseTypeLabel(key)).toBe("Tipo não informado");
    expect(musicGenreLabel(key)).toBe(key);
  });

  it.each(PROTOTYPE_KEYS)("legacy redirect keeps the %s query key verbatim", (key) => {
    const url = legacyTarget("/x", {}, `?${key}=1`, "");
    expect(url).toBe(`/x?${new URLSearchParams([[key, "1"]]).toString()}`);
  });
});
