---
title: F1 — Artists: Complete 360 Profile
---
# Artists — Complete 360 Profile

## What & Why
Expand artist management to cover the whole operational lifecycle: interaction history, media gallery, linked documents, relationships (manager, producer, partner label), and a complete view of contracts + releases + finance per artist — all inside the "Visão 360" (360 View) modal. The goal is for the team to be able to operate the artist entirely from one place.

## Done looks like
- The artist's 360 View modal gains a **"Histórico"** (History) tab with an event timeline (creation, status changes, signed contracts, published releases) — fed by existing system data
- **"Mídia"** (Media) tab in the 360: photo gallery (URLs, multiple), banner/cover field, introduction video field (YouTube embed)
- **"Documentos"** (Documents) tab: list of linked documents (press kit URL, bio PDF URL, technical rider URL), with an "Abrir" (Open) button for each one
- **"Relacionamentos"** (Relationships) tab: fields for manager (name + contact), executive producer, partner label, booking agency
- The artist list gains a filter by the `onboarding` status in addition to the existing ones
- The `onboarding` status badge appears in StatusBadge with a warning/yellow color
- The artist edit form (`ArtistaFormModal`) includes new fields: photo gallery (JSON array of URLs), YouTube video, manager, producer, agency, documents

## Out of scope
- Real file upload (use URLs for now)
- Real-time history automation (feed it from the existing mock data)
- Integration with streaming platforms to pull data automatically

## Steps
1. **Expand the artist data model** — Add fields to the mockData and the TypeScript types: `galeria_urls`, `video_apresentacao_url`, `manager_nome`, `manager_contato`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `documentos` (array of `{nome, url}`)
2. **Update `ArtistaFormModal`** — Add a "Mídia" section (URL gallery with dynamic add/remove, YouTube video), a "Relacionamentos" section (manager, producer, agency, label), a "Documentos" section (list of name+URL)
3. **Media tab in the 360** — Photo gallery in a grid, YouTube video embed (iframe), banner field displayed at the top of the modal
4. **Documents tab in the 360** — List of documents with icon, name and an "Abrir" button (opens the URL in a new tab)
5. **Relationships tab in the 360** — Compact cards for manager, producer, agency, label with name and contact
6. **History tab in the 360** — Vertical timeline with events derived from existing data (creation date, contracts, releases linked to the artist)
7. **`onboarding` filter in the listing** — Add the option to the artist listing + the correct badge in StatusBadge

## Relevant files
- `client/src/modules/artist/pages/Artistas.tsx`
- `client/src/modules/artist/components/ArtistaVisao360Modal.tsx`
- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/shared/components/StatusBadge.tsx`
- `client/src/shared/data/mockData.ts`