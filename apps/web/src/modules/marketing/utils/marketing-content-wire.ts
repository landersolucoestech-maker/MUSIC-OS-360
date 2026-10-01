/**
 * Wire vocabulary of marketing contents.
 *
 * The web `MarketingTarget` is the same canonical English vocabulary as the API
 * and the database (`music_project` / `artist` / `company`,
 * chk_marketing_content_posts_target_type), so there is nothing left to translate;
 * this module only validates the value at the wire boundary (a row that does not
 * carry a known target is a contract violation, never guessed) and accepts the
 * deprecated Portuguese spelling on read (marketing-legacy-vocabulary.ts).
 */
import type { MarketingTarget } from "../types/marketing.types";
import { canonicalMarketingTarget } from "./marketing-legacy-vocabulary";

export function targetTypeToWire(target: MarketingTarget): string {
  const canonical = canonicalMarketingTarget(target);
  if (!canonical) throw new Error(`[marketing] unknown content target type: ${String(target)}`);
  return canonical;
}

export function targetTypeFromWire(value: unknown): MarketingTarget {
  const canonical = canonicalMarketingTarget(value);
  if (!canonical) throw new Error(`[marketing] unknown content target type received from the API: ${String(value)}`);
  return canonical;
}
