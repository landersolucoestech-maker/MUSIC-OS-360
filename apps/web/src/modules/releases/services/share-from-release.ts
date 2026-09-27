import type { Release } from "@/modules/releases/types";

/**
 * Decoupled seam between Releases and Shares Management.
 *
 * Releases does NOT import the Shares module directly: it offers to start the
 * shares flow via query-param navigation (same pattern as `?edit`/`?view`), which the
 * Shares page interprets. So there is no direct coupling between the modules.
 */

/** Query param read by Shares Management to open the form already linked to a release. */
export const SHARE_FOR_RELEASE_PARAM = "shareForRelease";

/** Shares Management route with the release preselected. */
export function shareFlowFromReleaseUrl(releaseId: string): string {
  return `/shares?${SHARE_FOR_RELEASE_PARAM}=${encodeURIComponent(releaseId)}`;
}

/**
 * Are there enough participants/credits to suggest the shares flow?
 * Conservative: requires a defined main artist. Avoids opening the flow without data.
 */
export function hasEnoughParticipantsForShares(release: Pick<Release, "artist_id"> | null | undefined): boolean {
  return Boolean(release?.artist_id);
}
