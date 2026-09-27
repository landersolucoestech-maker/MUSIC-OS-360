---
title: F1 — Releases: Pipeline and Assets
---
# Releases — Operational Pipeline and Assets

## What & Why
Turn the Releases module into a real operational tool: a visual status pipeline, a checklist of mandatory assets per release type (single/EP/album), a schedule with material delivery dates, and a complete view of each release. The team needs to know what is missing to publish each release.

## Done looks like
- The Releases page gains a **view toggle** between list (current) and **Kanban** (columns: "Planejado" → "Em Produção" → "Aguardando Distribuição" → "Publicado" → "Cancelado" — Planned → In Production → Awaiting Distribution → Published → Cancelled)
- In the Kanban, each release card displays: name, artist, type, target date and the % completion of the asset checklist
- **Asset checklist** per release: master audio (WAV/FLAC URL), album cover (3000×3000 URL), music video (YouTube URL), lyrics (text or URL), credits sheet (text), press release (text/URL), EPK (URL) — the mandatory ones vary by type
- The **Release View** modal gains an "Assets" tab with a visual checklist (✓/✗ per item) and a "Cronograma" (Schedule) tab with key dates (recording, mix/master, delivery to the distributor, publication)
- **Release form** expanded with: asset fields (URLs), schedule dates, a global ISRC field (for singles), a UPC field, internal notes
- KPIs on the page: total releases, how many have incomplete assets (checklist < 100%), next 30 days, published this month
- "Assets incompletos" (Incomplete assets) filter in the listing

## Out of scope
- Real upload of audio/video files (use URLs for now)
- Integration with distributors (automatic delivery)
- Digital approval/workflow with signatures

## Steps
1. **Expand the data model** — Add fields to the mockData and types: `assets` (object with URL fields per type), `cronograma` (dates: `gravacao`, `mix_master`, `entrega_distribuidora`), `isrc_global`, `upc`, `notas_internas`
2. **Update the Release form** — Add "Assets" sections (URLs for each type of material) and "Cronograma" (date pickers for each stage), ISRC/UPC
3. **Assets tab in the view modal** — Visual checklist of the assets with ✓/✗ status, links to open each material, % completeness computed dynamically
4. **Schedule tab in the modal** — Vertical timeline with the key dates and an indication of delays (past date without completion)
5. **Kanban view** — Implement the list/kanban toggle on the page; columns mapped by status; cards with asset %; dragging between columns updates the status in localStorage
6. **KPIs and filters** — Add MetricCards for incomplete assets and upcoming releases; an "incompleto" (incomplete) filter in the filter bar

## Relevant files
- `client/src/modules/releases/pages/Lancamentos.tsx`
- `client/src/modules/releases/components/LancamentoFormModal.tsx`
- `client/src/modules/releases/components/LancamentoViewModal.tsx`
- `client/src/modules/releases/hooks/useLancamentos.ts`
- `client/src/shared/data/mockData.ts`