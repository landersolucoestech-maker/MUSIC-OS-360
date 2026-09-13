/**
 * Creative editor — types for the "Template" creative mode layered onto the
 * existing Content Schedule modal (see Calendario.tsx). Persisted under
 * MarketingContent.metadata.creative (jsonb, see marketing-contents.service.ts's
 * merge-on-update). Not a new ContentType/format — see social-formats.ts,
 * which remains the single source of truth for platform/aspect/media rules.
 */

export type CreativeMode = "simple" | "template";

export type CreativeLayout = "full" | "split";

export interface CreativeSlot {
  assetUrl: string;
  kind: "image" | "video";
}

export type CreativeTextRole = "headline" | "subtitle";

export interface CreativeTextLayer {
  role: CreativeTextRole;
  text: string;
}

export interface CreativeLogoConfig {
  enabled: boolean;
  assetUrl: string | null;
}

export interface CreativeWatermarkConfig {
  enabled: boolean;
  assetUrl: string | null;
  opacity: number;
}

/**
 * Whether the current output (if any) still matches the current
 * configuration. "dirty" after any edit to slots/text/logo/watermark/layout;
 * export/render (not implemented yet — see PreviewFrame's template surface
 * and the "Renderização ainda não disponível" guard in Calendario.tsx) would
 * clear it back to "clean" once it exists.
 */
export type CreativeRenderState = "clean" | "dirty";

export interface CreativeConfig {
  version: 1;
  mode: CreativeMode;
  templateKey: string;
  category: string;
  layout: CreativeLayout;
  primarySlot: CreativeSlot | null;
  secondarySlot: CreativeSlot | null;
  textLayers: CreativeTextLayer[];
  logo: CreativeLogoConfig;
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
    textLayers: [
      { role: "headline", text: "" },
      { role: "subtitle", text: "" },
    ],
    logo: { enabled: true, assetUrl: null },
    watermark: { enabled: true, assetUrl: null, opacity: 0.85 },
    renderState: "dirty",
  };
}

export function textLayer(config: CreativeConfig, role: CreativeTextRole): string {
  return config.textLayers.find((layer) => layer.role === role)?.text ?? "";
}

export function withTextLayer(config: CreativeConfig, role: CreativeTextRole, text: string): CreativeConfig {
  const exists = config.textLayers.some((layer) => layer.role === role);
  const textLayers = exists
    ? config.textLayers.map((layer) => (layer.role === role ? { ...layer, text } : layer))
    : [...config.textLayers, { role, text }];
  return { ...config, textLayers, renderState: "dirty" };
}
