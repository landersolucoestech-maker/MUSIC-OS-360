// @ts-nocheck
// Wiring test: the event view modal shows the PT-BR label of the persisted coarse events.type
// (getBackendEventTypeLabel), never the raw enum value.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/events/hooks/useScheduleParticipants", () => {
  return {
    scheduleParticipantKey: (p: any) => `${p.source}:${p.id}`,
    normalizeScheduleParticipants: (v: any) => (Array.isArray(v) ? v : []),
    summarizeScheduleParticipants: (ps: any[]) => ps.map((p) => p.label).join(", "),
    useScheduleParticipants: () => ({ getArtistParticipantById: () => undefined }) };
});

import { SchedulerViewModal } from "@/modules/events/components/SchedulerViewModal";

const view = (type: any) =>
  render(
    <SchedulerViewModal
      open
      onOpenChange={() => {}}
      event={{ id: "e1", title: "Evento X", type, status: "scheduled", starts_at: "2026-03-10T20:00:00.000Z" }}
    />,
  );

describe("SchedulerViewModal legacy wiring (type label)", () => {
  it.each([
    ["recording", "Gravação/Estúdio"],
    ["meeting", "Reunião"],
    ["interview", "Entrevista/Imprensa"],
    ["tour", "Turnê"],
  ])("persisted type %s renders %s", (type, label) => {
    view(type);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(type)).not.toBeInTheDocument();
  });

  it("negative: no type shows the generic label and an unknown value is shown as stored", () => {
    const first = view(null);
    expect(screen.getByText("Evento", { selector: "div,span" })).toBeInTheDocument();
    first.unmount();
    view("custom_kind");
    expect(screen.getByText("custom_kind")).toBeInTheDocument();
  });
});
