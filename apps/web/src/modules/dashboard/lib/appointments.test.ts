import { describe, expect, it } from "vitest";
import { isUpcomingAppointmentStatus } from "./appointments";

describe("isUpcomingAppointmentStatus (canonical EventStatus)", () => {
  it("hides cancelled, completed and held events", () => {
    for (const status of ["cancelled", "completed", "held", " Cancelled "]) {
      expect(isUpcomingAppointmentStatus(status)).toBe(false);
    }
  });

  it("keeps planned, scheduled, confirmed and postponed events (and a missing status)", () => {
    for (const status of ["planned", "scheduled", "confirmed", "postponed", undefined, null, ""]) {
      expect(isUpcomingAppointmentStatus(status)).toBe(true);
    }
  });
});
