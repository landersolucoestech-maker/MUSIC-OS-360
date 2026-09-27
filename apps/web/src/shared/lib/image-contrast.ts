/**
 * image-contrast — central utility for contrast over images (release covers etc.).
 *
 * Analyzes an image's average luminance to decide whether the overlaid content
 * should use dark text (light cover) or light text (dark cover), ensuring
 * legibility/contrast over any artwork. No external dependencies.
 */

export type ContrastMode = "lightBackground" | "darkBackground";

const cache = new Map<string, ContrastMode>();
const inflight = new Map<string, Promise<ContrastMode>>();

/** Relative luminance (WCAG) of a normalized 0-255 channel. */
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Decides the contrast mode for an image.
 * Downscales to a small canvas and computes the average relative luminance.
 * On error/CORS ("tainted" canvas) or a missing cover it returns `lightBackground`
 * (safe default: the app has a light background, so dark text stays legible).
 */
export function getImageContrastMode(src: string | null | undefined): Promise<ContrastMode> {
  if (!src) return Promise.resolve("lightBackground");
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(src);
  if (pending) return pending;

  const task = new Promise<ContrastMode>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    const settle = (mode: ContrastMode) => {
      cache.set(src, mode);
      inflight.delete(src);
      resolve(mode);
    };

    img.onload = () => {
      try {
        const w = 16;
        const h = 16;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return settle("darkBackground");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha === 0) continue;
          const lum =
            0.2126 * channelLuminance(data[i]) +
            0.7152 * channelLuminance(data[i + 1]) +
            0.0722 * channelLuminance(data[i + 2]);
          sum += lum;
          count++;
        }
        const avg = count > 0 ? sum / count : 1;
        // Only uses light text when the cover is positively dark (low avg).
        settle(avg < 0.45 ? "darkBackground" : "lightBackground");
      } catch {
        settle("lightBackground"); // tainted canvas (CORS) or unavailable
      }
    };
    img.onerror = () => settle("lightBackground");
    img.src = src;
  });

  inflight.set(src, task);
  return task;
}

// ── Utility classes (design system) per contrast mode ───────────────────────────

/** Main text over a cover. */
export const contrastText = (mode: ContrastMode): string =>
  mode === "lightBackground" ? "text-slate-900" : "text-slate-50";

/** Secondary text/subtitle over the cover. */
export const contrastSubtext = (mode: ContrastMode): string =>
  mode === "lightBackground" ? "text-slate-700" : "text-slate-200";

/** Overlaid "chrome" (icons, borders, buttons, translucent blocks) over the cover. */
export const contrastChrome = (mode: ContrastMode): string =>
  mode === "lightBackground"
    ? "text-slate-900 border-slate-900/20 bg-white/30"
    : "text-slate-50 border-white/20 bg-black/30";

/** Scrim (gradient) that reinforces the legibility of the content at the bottom of the card. */
export const contrastScrim = (mode: ContrastMode): string =>
  mode === "lightBackground"
    ? "bg-gradient-to-t from-white/85 via-white/35 to-transparent"
    : "bg-gradient-to-t from-black/85 via-black/35 to-transparent";
