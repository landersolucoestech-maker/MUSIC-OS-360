import { EventStatus } from "@music-os-360/types";

/**
 * Statuses that remove an event from the dashboard's upcoming appointments
 * (closed/past). Canonical EventStatus values — events.status was migrated to
 * English in Z6-B; `postponed` is still upcoming.
 */
const CLOSED_APPOINTMENT_STATUSES: ReadonlySet<string> = new Set<string>([
  EventStatus.CANCELLED,
  EventStatus.COMPLETED,
  EventStatus.HELD,
]);

export function isUpcomingAppointmentStatus(status: unknown): boolean {
  return !(typeof status === "string" && CLOSED_APPOINTMENT_STATUSES.has(status.trim().toLowerCase()));
}
