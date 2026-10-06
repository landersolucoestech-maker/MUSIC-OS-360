/**
 * Project status in the product: Planning, In progress, Completed, Cancelled.
 *
 * The API also stores an internal `review` state between in-progress and completed (it drives the workflow).
 * It is not a fifth product status: it is shown as In progress and is kept untouched when a project in that
 * state is edited, so saving the form never moves a project out of it.
 */
export const INTERNAL_REVIEW_STATUS = "review";

export type ProjectProductStatus = "planning" | "in_progress" | "completed" | "cancelled";

/** Status value the form holds for a stored status: the internal review state is preserved, unknown means planning. */
export function normalizeFormStatus(stored: string | null | undefined): string {
  const s = (stored || "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s === "in_progress" || s === "completed" || s === "cancelled" || s === INTERNAL_REVIEW_STATUS) return s;
  return "planning";
}

/** The product status a stored status is presented as (review is shown as in progress). */
export function toProductStatus(stored: string | null | undefined): ProjectProductStatus {
  const s = normalizeFormStatus(stored);
  return s === INTERNAL_REVIEW_STATUS ? "in_progress" : (s as ProjectProductStatus);
}

/** Dashboard buckets from the per-status counts of GET /projects/stats: every project falls in exactly one product bucket. */
export function tallyProjectStatuses(byGroup: Readonly<Record<string, number>>): { active: number; completed: number; drafts: number } {
  const tally = { active: 0, completed: 0, drafts: 0 };
  for (const [status, count] of Object.entries(byGroup)) {
    const product = toProductStatus(status);
    if (product === "in_progress") tally.active += count;
    else if (product === "completed") tally.completed += count;
    else if (product === "planning" && status === "planning") tally.drafts += count;
  }
  return tally;
}
