/**
 * Creative editor — types for the "Template" creative mode layered onto the
 * existing Content Schedule modal (see Calendario.tsx). Persisted under
 * MarketingContent.metadata.creative (jsonb, see marketing-contents.service.ts's
 * merge-on-update). Not a new ContentType/format — see social-formats.ts,
 * which remains the single source of truth for platform/aspect/media rules.
 *
 * Currently backs one preset (News / Lander Records — NEWS_LANDER_RECORDS_TEMPLATE),
 * so its identity/caption fields live flat on CreativeConfig rather than
 * behind a per-template union; if a second, structurally different preset is
 * added later, split this into a discriminated union keyed on `templateKey`
 * instead of growing unrelated optional fields here.
 */

export type CreativeMode = "simple" | "template";

/** The News template's media composition mode -- one full-width slot, or two independent slots side by side (zero gap). */
export type CreativeLayout = "full" | "split";

export interface CreativeSlot {
  assetUrl: string;
  kind: "image" | "video";
}

export interface CreativeWatermarkConfig {
  enabled: boolean;
  assetUrl: string | null;
  opacity: number;
}

/**
 * Whether the current output (if any) still matches the current
 * configuration. "dirty" after any edit to slots/identity/caption/watermark/
 * layout; export/render (not implemented yet — see PreviewFrame's template
 * surface and the "Renderização ainda não disponível" guard in
 * Calendario.tsx) would clear it back to "clean" once it exists.
 */
export type CreativeRenderState = "clean" | "dirty";

export interface CreativeConfig {
  version: 1;
  mode: CreativeMode;
  templateKey: string;
  category: string;
  layout: CreativeLayout;
  /** FULL: the only media slot. SPLIT: the LEFT slot. Never rendered when layout is "split" and this is meant as a de-facto right-only config (impossible -- primarySlot is always left-or-full). */
  primarySlot: CreativeSlot | null;
  /** Only meaningful (and only rendered) when layout is "split" -- the RIGHT slot. Kept in state across a switch back to "full" so the user doesn't lose it (section 9), just not rendered/persisted-as-visible while layout is "full". */
  secondarySlot: CreativeSlot | null;
  /** Independent from `watermark` -- the identity avatar shown in the header row, never reused as the watermark automatically. */
  profileAvatar: CreativeSlot | null;
  profileName: string;
  /** Stored without a leading "@" -- the "@" is a display convention applied where rendered. */
  username: string;
  caption: string;
  watermark: CreativeWatermarkConfig;
  renderState: CreativeRenderState;
}

export const NEWS_LANDER_RECORDS_TEMPLATE = {
  key: "news-lander-records",
  category: "news",
  label: "Notícias / Lander Records",
} as const;

export function defaultCreativeConfig(): CreativeConfig {
  return {
    version: 1,
    mode: "simple",
    templateKey: NEWS_LANDER_RECORDS_TEMPLATE.key,
    category: NEWS_LANDER_RECORDS_TEMPLATE.category,
    layout: "full",
    primarySlot: null,
    secondarySlot: null,
    profileAvatar: null,
    profileName: "",
    username: "",
    caption: "",
    watermark: { enabled: true, assetUrl: null, opacity: 0.85 },
    renderState: "dirty",
  };
}

/** "@" is a display convention, never persisted as part of the stored value. */
export function displayUsername(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
