/**
 * CZ-043 — every CRM contact value the user sees goes through a PT-BR label,
 * with a PT-BR fallback (never the raw technical value) for unknown values.
 */
import { describe, expect, it } from "vitest";
import { contactStatusOptions, contactTypeOptions, labelFor, UNKNOWN_OPTION_LABEL } from "./index";
import { TIMELINE_ACTION_LABELS, timelineActionLabel, UNKNOWN_TIMELINE_ACTION_LABEL } from "./timeline";
import { INTERACTION_TYPE_OPTIONS, interactionTypeLabel, UNKNOWN_INTERACTION_TYPE_LABEL } from "../shared/interactions";

describe("interaction types", () => {
  it("uses the canonical English values with PT-BR labels", () => {
    expect(INTERACTION_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      "call", "whatsapp", "email", "meeting", "proposal", "follow_up", "note",
    ]);
    expect(interactionTypeLabel("call")).toBe("Ligação");
    expect(interactionTypeLabel("meeting")).toBe("Reunião");
    expect(interactionTypeLabel("note")).toBe("Observação");
  });

  it("never shows a raw/legacy value", () => {
    expect(interactionTypeLabel("ligacao")).toBe(UNKNOWN_INTERACTION_TYPE_LABEL);
  });
});

describe("timeline actions", () => {
  it("labels every canonical action in PT-BR", () => {
    for (const action of ["note", "call", "meeting", "email", "whatsapp", "other", "created", "updated", "removed"]) {
      expect(timelineActionLabel(action)).toBe(TIMELINE_ACTION_LABELS[action as keyof typeof TIMELINE_ACTION_LABELS]);
    }
    expect(timelineActionLabel("note")).toBe("Nota");
  });

  it("labels the attachment actions the API records (clients.service recordActivity)", () => {
    expect(timelineActionLabel("attachment_uploaded")).toBe("Anexo enviado");
    expect(timelineActionLabel("attachment_removed")).toBe("Anexo removido");
  });

  it("never shows a raw/unknown action", () => {
    expect(timelineActionLabel("nota")).toBe(UNKNOWN_TIMELINE_ACTION_LABEL);
    expect(timelineActionLabel("toString")).toBe(UNKNOWN_TIMELINE_ACTION_LABEL);
  });
});

describe("labelFor", () => {
  it("maps the canonical status values (DB CHECK) to PT-BR", () => {
    expect(contactStatusOptions.map((o) => o.value)).toEqual(["active", "inactive", "prospect"]);
    expect(labelFor(contactStatusOptions, "prospect")).toBe("Em prospecção");
  });

  it("returns a PT-BR fallback for unknown values and a dash for empty ones", () => {
    expect(labelFor(contactTypeOptions, "SOME_NEW_SLUG")).toBe(UNKNOWN_OPTION_LABEL);
    expect(labelFor(contactTypeOptions, undefined)).toBe("—");
  });
});
