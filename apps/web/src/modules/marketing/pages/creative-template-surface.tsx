/**
 * The News template's shared creative renderer. Composited INSIDE a
 * platform's media region — Calendario.tsx's PreviewFrame wraps this with
 * the actual Instagram/TikTok/YouTube/etc. chrome, which stays completely
 * untouched (see PreviewFrame's `renderSurface` prop). One renderer serving
 * every platform: there is no InstagramTemplateSurface/TikTokTemplateSurface
 * variant -- responsiveness across aspect ratios (1:1, 4:5, 9:16, 16:9, all
 * driven by ASPECT_CLASS in ../config/social-formats.ts) comes from this
 * component's flex-based layout, not per-platform coordinates.
 *
 * Extracted from Calendario.tsx (a page component that pulls in
 * MainLayout/Supabase/auth-context at module scope, which real unit tests
 * can't satisfy) so the actual composition logic is testable in isolation.
 *
 * This renders an in-browser visual composite for editing feedback only,
 * not a rendered artifact -- there is no export/render pipeline yet (see the
 * `finalize()` guard in Calendario.tsx's ContentScheduleModal blocking
 * external publish for template-mode content until one exists).
 */
import { Upload } from "lucide-react";
import { displayUsername, type CreativeConfig, type CreativeSlot } from "../types/creative.types";

export function CreativeTemplateSurface({ creative }: { creative: CreativeConfig }) {
  const hasIdentity = !!(creative.profileAvatar || creative.profileName || creative.username);
  const isSplit = creative.layout === "split";

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-card">
      {(hasIdentity || creative.caption) && (
        <div className="z-10 shrink-0 space-y-1.5 bg-card px-3 pb-2 pt-2.5">
          {hasIdentity && (
            <div className="flex items-center gap-2">
              {creative.profileAvatar ? (
                <img src={creative.profileAvatar.assetUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-7 w-7 shrink-0 rounded-full bg-muted" />
              )}
              <div className="min-w-0 leading-tight">
                {creative.profileName && <p className="truncate text-xs font-semibold text-foreground">{creative.profileName}</p>}
                {creative.username && <p className="truncate text-[10px] text-muted-foreground">{displayUsername(creative.username)}</p>}
              </div>
            </div>
          )}
          {creative.caption && (
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-foreground">{creative.caption}</p>
          )}
        </div>
      )}

      {/* Media region -- the positioning context for the watermark below, which
          centers on THIS box's own midpoint (the split boundary when isSplit,
          the horizontal/vertical center otherwise) -- never the whole post
          including the header, and never a single panel's own center. */}
      <div data-testid="creative-media-region" className="relative min-h-0 flex-1">
        <div className="flex h-full w-full">
          <CreativeMediaPane slot={creative.primarySlot} testId="creative-media-primary" />
          {isSplit && <CreativeMediaPane slot={creative.secondarySlot} testId="creative-media-secondary" />}
        </div>

        {creative.watermark.enabled && (
          <div data-testid="creative-watermark" className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            {creative.watermark.assetUrl ? (
              <img
                src={creative.watermark.assetUrl}
                alt=""
                style={{ opacity: creative.watermark.opacity }}
                className="h-8 w-8 object-contain drop-shadow"
              />
            ) : (
              // Deliberately NOT derived from profileName -- avatar/identity
              // and watermark are independent concepts (never coupled), so
              // the placeholder shown before a watermark asset is uploaded is
              // always this generic label, never the profile's own name.
              <span
                style={{ opacity: creative.watermark.opacity }}
                className="whitespace-nowrap rounded bg-background/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-foreground/80"
              >
                Marca d'água
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One media pane -- FULL uses exactly one, SPLIT uses two side by side with
 * zero gap/border/padding between them (`flex` row, no `gap-*` class, no
 * divider element) so the two panes visually touch directly. */
function CreativeMediaPane({ slot, testId }: { slot: CreativeSlot | null; testId: string }) {
  return (
    <div data-testid={testId} className="relative h-full flex-1 overflow-hidden bg-muted/40">
      {slot ? (
        slot.kind === "image" ? (
          <img src={slot.assetUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={slot.assetUrl} className="h-full w-full object-cover" muted loop autoPlay />
        )
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span className="text-[10px]">Selecione a mídia</span>
        </div>
      )}
    </div>
  );
}
