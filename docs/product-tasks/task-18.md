---
title: Editorial Calendar — Media Upload, Feed View & Platforms
---
# Editorial Calendar — Visual and Media Upgrade

## What & Why
Elevate the Content Calendar module from a functional CRUD to a modern social media editorial platform, with real media upload, advanced per-platform settings (Instagram/TikTok/YouTube), a grid Feed view, and stub services ready to be wired to the platforms' public APIs.

The module already has the base structure (WeeklyCalendar, CalendarCard, two-panel ContentModal, filters, navigation). This upgrade fills the visual and functional gaps described in the refactoring prompt.

## Done looks like
- A dedicated **MediaUploader** with visual drag-and-drop, a simulated progress bar, format validation (mp4/mov/jpg/png/gif/webp) and size validation (200MB), thumbnail generation for video via canvas, and an instant preview of the selected media — integrated into the left panel of ContentModal
- **Advanced per-platform settings** in ContentModal: when Instagram is selected, show fields for hashtags (editable chips), location, and a carousel toggle; when YouTube, show fields for tags, privacy status (public/unlisted/private) and a separate thumbnail field; when TikTok, show a duration field and a custom thumbnail
- A new **Feed view** in the view selector — responsive grid (3 columns) of CalendarCards in wide visual mode, with a dominant thumbnail and a visible publish action button
- **CalendarCard visual upgrade** — in the weekly view (compact mode) show a pill with the platform color + a status dot; in normal mode, a thumbnail in 4:5 aspect for Stories/Reels or 16:9 for video/post, a platform badge in the top right corner, time in a mono font, and a status indicator with a semantic color
- **Stub services** for `instagram.service.ts`, `tiktok.service.ts`, `youtube.service.ts` under `modules/marketing/services/` — each exports typed functions (`schedulePost`, `publishNow`, `getAnalytics`) that in mock mode return simulated data and in real mode will throw for the API — ready for future integration without changing the callers
- **`useMediaUpload` hook** in `modules/marketing/hooks/` — encapsulates the file state (file, preview URL, progress, error, isUploading), an `upload(file)` function with validation and progress, `reset()`, and `generateThumbnail(videoFile)` via canvas/URL.createObjectURL
- **`useContentScheduler` hook** — wrapper around `useConteudos` with scheduling logic: `scheduleContent(payload)`, `publishNow(id)`, `getScheduledForWeek(weekStart)`, `getByStatus(status)`
- No regressions: sidebar, global layout, routing, and all other modules remain intact

## Out of scope
- Real OAuth with Instagram/TikTok/YouTube (requires production credentials and a verified domain)
- Real publishing to the platforms (the stub functions simulate success in mock mode)
- BullMQ / Redis / FFmpeg workers (backend infra — separate task)
- Drag-and-drop of cards between calendar slots
- Kanban view
- Standalone Media Library (separate asset management panel)
- Real analytics (the data is mock data from the existing `monitoramentos` table)
- Implementation of YouTube monetization / TikTok music library / Instagram collab
- Changes to the sidebar or the global layout

## Steps
1. **`useMediaUpload` hook** — create the hook in `hooks/useMediaUpload.ts` with state (file, previewUrl, progress, error, isUploading), format and size validation, thumbnail generation via `URL.createObjectURL` + canvas for video, and reset. Use `setTimeout` to simulate progress in mock mode.

2. **`MediaUploader` component** — create `components/calendar/MediaUploader.tsx` with a visual drag-and-drop zone (animated dashed border on drag-over), a progress indicator (animated bar), an image/video preview with a remove button, and inline error messages. Consume the `useMediaUpload` hook. Replace the existing basic upload in the left panel of ContentModal with this component.

3. **Advanced per-platform settings in ContentModal** — expand the existing "Configurações avançadas" (Advanced settings) section with conditional per-platform fields:
   - Instagram: hashtags field (chip-style input parsed by space/comma and removal via ×), location field (free text), carousel toggle
   - YouTube: privacy status selector ("Público"/"Não-listado"/"Privado" — Public/Unlisted/Private), tags field (same chip style), a separate thumbnail field with its own mini MediaUploader
   - TikTok: privacy toggle ("Público"/"Amigos"/"Privado" — Public/Friends/Private), thumbnail field
   - Save these fields in the payload as JSON in the `descricao` field or extend the `ConteudoInsert` type with a `meta_plataforma` field (JSONB compatible with the `[key: string]: unknown` field of the `Conteudo` type)

4. **CalendarCard visual upgrade** — compact mode (week): pill with the solid platform color (using the PLAT_COLOR variables), colored status dot, and title truncation; normal mode: thumbnail in the correct aspect per type (9:16 for Reels/Stories, 16:9 for Post/Video, 1:1 for Carousel), platform badge in the top right corner over the thumbnail, time in `font-mono text-xs`, status label with a semantic color (blue=scheduled, green=published, amber=paused, gray=draft, red=failed).

5. **Feed view** — create `components/calendar/FeedView.tsx` with a 3-column grid of CalendarCards in expanded visual mode, sorted by `data_publicacao` DESC. Add `"feed"` to the `ViewMode` type in `Calendario.tsx`. Update `CalendarFilters.tsx` to include the "Feed" option in the view selector. Register the new view in `Calendario.tsx`, rendering `FeedView` when `viewMode === "feed"`.

6. **Platform stub services** — create `services/instagram.service.ts`, `services/tiktok.service.ts`, `services/youtube.service.ts`. Each one exports: `schedulePost(payload) → Promise<{ id: string; scheduledAt: string }>`, `publishNow(conteudoId) → Promise<{ url: string }>`, `getAnalytics(conteudoId) → Promise<Analytics>`. In mock mode (VITE_MOCK_MODE !== 'false') they return simulated data with a delay; in HTTP mode they throw `NotImplementedError` with a clear message. Create `services/publishing.service.ts` as a facade that dispatches to the correct service based on the platform.

7. **`useContentScheduler` hook** — create `hooks/useContentScheduler.ts` as a wrapper around `useConteudos`, adding: `scheduleContent(payload)` which calls `addConteudo` + the publishing service's `schedulePost`, `publishNow(conteudo)` which calls the service's `publishNow` and updates the status to "publicado" (published), `getScheduledForWeek(weekStart)` which filters by date, `getByStatus(status)` which filters by status. Export from the `hooks/index.ts` barrel.

## Relevant files
- `apps/web/src/modules/marketing/components/calendar/ContentModal.tsx`
- `apps/web/src/modules/marketing/components/calendar/CalendarCard.tsx`
- `apps/web/src/modules/marketing/components/calendar/WeeklyCalendar.tsx`
- `apps/web/src/modules/marketing/components/calendar/CalendarFilters.tsx`
- `apps/web/src/modules/marketing/components/calendar/platform-icons.tsx`
- `apps/web/src/modules/marketing/hooks/useConteudos.ts`
- `apps/web/src/modules/marketing/pages/Calendario.tsx`
- `apps/web/src/modules/marketing/types/marketing.types.ts`
- `apps/web/src/modules/marketing/services/index.ts`
- `apps/web/src/shared/lib/storage.ts`
- `apps/web/src/shared/data/mockData.ts`