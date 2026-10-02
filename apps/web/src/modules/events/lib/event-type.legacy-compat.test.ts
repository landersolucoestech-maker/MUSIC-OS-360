import { describe, expect, it } from "vitest";
import {
  BACKEND_EVENT_TYPES,
  EVENT_CATEGORY_IDS,
  canonicalEventCategory,
  eventCategoryToBackendType,
} from "./event-type";

// [legacy free-text value, canonical category id it is read as, coarse events.type it maps to]
// Values that are historic coarse aliases only (not categories) pass through the category reader.
const LEGACY_EVENT_VALUES: ReadonlyArray<readonly [string, string, string]> = [
  ["entrevista", "entrevista", "interview"],
  ["evento_corporativo", "shows", "other"],
  ["gravacao", "gravacao", "recording"],
  ["gravacoes", "gravacoes", "recording"],
  ["lancamento", "shows", "show"],
  ["reuniao", "meetings", "meeting"],
  ["rodeio", "shows", "show"],
  ["show_teatro", "shows", "show"],
  ["turne", "turne", "tour"],
];

describe("event type legacy readers (legacy in, canonical out)", () => {
  it.each(LEGACY_EVENT_VALUES)("%s -> category %s, backend type %s", (legacy, category, backendType) => {
    expect(canonicalEventCategory(legacy)).toBe(category);
    expect(eventCategoryToBackendType(legacy, {})).toBe(backendType);
    // accent/case/whitespace tolerant on read
    expect(canonicalEventCategory(`  ${legacy.toUpperCase()} `)).toBe(category);
    // the coarse result is always a member of the persisted enum (never a legacy spelling)
    expect(BACKEND_EVENT_TYPES as readonly string[]).toContain(backendType);
  });

  it("legacy values that resolve to a category resolve to a canonical English id", () => {
    for (const [, category] of LEGACY_EVENT_VALUES) {
      if (category === "shows" || category === "meetings") expect(EVENT_CATEGORY_IDS as readonly string[]).toContain(category);
    }
  });

  it("an operational granularMap entry wins over the legacy alias table", () => {
    expect(eventCategoryToBackendType("rodeio", { shows: "festival" })).toBe("festival");
  });

  it("unknown values are not guessed", () => {
    expect(canonicalEventCategory("valor_desconhecido")).toBe("valor_desconhecido");
    expect(eventCategoryToBackendType("valor_desconhecido", {})).toBe("other");
    expect(canonicalEventCategory(undefined)).toBe("");
  });
});
