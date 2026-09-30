/**
 * Wire vocabulary of marketing contents.
 *
 * The API and the database speak the canonical English vocabulary for a
 * content's target (`music_project` / `artist` / `company`,
 * chk_marketing_content_posts_target_type). The web's `MarketingTarget` is
 * still the Portuguese one because it is shared with campaigns, tasks, the AI
 * workspace, analytics, the Artist 360 view and the operational-settings slugs
 * (blocker BLK-MARKETING-TARGET-WEB-VOCABULARY: renaming it is a cross-module
 * change with a jsonb backfill, tracked separately). This is the ONLY place
 * that translates between the two; remove it together with that rename.
 */
import type { MarketingTarget } from "../types/marketing.types";

const TARGET_TO_WIRE: Readonly<Record<MarketingTarget, string>> = {
  projeto_musical: "music_project",
  artista: "artist",
  empresa: "company",
};

const TARGET_FROM_WIRE: Readonly<Record<string, MarketingTarget>> = {
  music_project: "projeto_musical",
  artist: "artista",
  company: "empresa",
};

export function targetTypeToWire(target: MarketingTarget): string {
  if (!Object.prototype.hasOwnProperty.call(TARGET_TO_WIRE, target)) {
    throw new Error(`[marketing] unknown content target type: ${String(target)}`);
  }
  return TARGET_TO_WIRE[target];
}

export function targetTypeFromWire(value: unknown): MarketingTarget {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(TARGET_FROM_WIRE, value)) {
    return TARGET_FROM_WIRE[value];
  }
  throw new Error(`[marketing] unknown content target type received from the API: ${String(value)}`);
}
