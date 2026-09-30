import type { ContentDisplayStatus, MarketingContent } from "../types/marketing.types";

/**
 * `overdue` is a DERIVED display state, never persisted: a `scheduled`
 * content whose publish date/time is already in the past (the publishing job
 * has not published it, and has not failed it either). Everything else shows
 * its persisted status unchanged.
 *
 * The schedule is read exactly like the API reads it
 * (`new Date(`${publishDate}T${publishTime}:00`)`, marketing-contents.service.ts).
 */
export function deriveContentDisplayStatus(
  content: Pick<MarketingContent, "status" | "publishDate" | "publishTime">,
  now: Date = new Date(),
): ContentDisplayStatus {
  if (content.status !== "scheduled") return content.status;
  const date = content.publishDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(content.publishTime)) return content.status;
  const scheduledFor = new Date(`${date}T${content.publishTime}:00`);
  if (Number.isNaN(scheduledFor.getTime())) return content.status;
  return scheduledFor.getTime() < now.getTime() ? "overdue" : content.status;
}
