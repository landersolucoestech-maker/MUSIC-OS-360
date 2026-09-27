---
title: Relational artist form
---
# Relational Artist Form

## What & Why

Refactor `ArtistaFormModal.tsx` (currently: 942 lines, ~55 useState, a single entity per profile)
into a relational form with react-hook-form + useFieldArray that supports multiple
simultaneous commercial relationships per artist. The current model is rigid (a single
profile type per artist) and does not scale to the reality of labels and distributors that
manage artists with multiple managers, record labels, publishers and team members at the same time.

## Done looks like

- The "Novo Artista" (New Artist) and "Editar Artista" (Edit Artist) buttons open the refactored modal
- Section 1 ("Informações Básicas" / Basic Information): image upload, stage name, music genre,
  specialties, documents, press kit, biography, PLUS an automatic artist slug,
  music tags (chips), career stage ("iniciante" / "em ascensão" / "consolidado" / "mainstream" — beginner / rising / established / mainstream)
- Section 2 ("Dados Pessoais" / Personal Data): unchanged
- Section 3 ("Dados Bancários" / Bank Details): unchanged
- Section 4 ("Redes Sociais" / Social Media): unchanged + automatic per-platform URL validation
- Section 5 ("Relacionamentos Comerciais" / Commercial Relationships): replaced the fixed "Tipo de Perfil" (Profile Type)
  - Each subsection has an "Adicionar" (Add) button and individual removable cards
  - Managers: multiple (name, phone, email) + their own distributors
  - Record labels: multiple (name, phone, email) + contacts in charge + distributors
  - Publishers: multiple (name, phone, email) + distributors
  - Bookers: multiple (name, phone, email)
  - Legal: multiple (name, phone, email, law firm)
  - Finance: multiple (name, phone, email)
  - Accountant: multiple (name, phone, email, CRC — accountant registration number)
  - PR / press office: multiple (name, phone, email)
- Section 6 (global distributors): REMOVED — distributors belong to the entities
- The form loads existing data correctly in edit mode
- TypeScript with no errors, mock data persists in localStorage

## Out of scope

- Real backend (mock data + localStorage only)
- Excel import (the export mapper may be updated as a bonus, but it does not block)
- CRM module: no change to the CRM's client/record label hooks
- Visual redesign beyond what is necessary (keep the current shadcn/Radix)
- Public onboarding page (ArtistaSignupPublic.tsx — untouched)

## Steps

1. **Types and the `Artista` interface** — Add new fields to the `Artista` type in `useArtistas.ts`:
   `slug_artistico`, `tags_musicais` (string[] | null), `fase_carreira` (string | null),
   `relacionamentos` (typed array with an `ArtistaRelacionamento` subtype covering all
   entities: `empresario`, `gravadora`, `editora`, `booker`, `juridico`, `financeiro`, `contador`,
   `assessoria` — each with name/phone/email fields + optional fields law firm,
   CRC, contacts in charge[], distributors[]). Keep the legacy fields
   empresario_*, gravadora_* and distribuidoras_* as optional and deprecated so as not to
   break existing code.

2. **Form schema (react-hook-form)** — Create the TypeScript schema `ArtistaFormValues`
   compatible with the new relational structure, using `useFieldArray` for each entity
   type. This schema is internal to the form and independent of the DB `Artista` type —
   the mapper bridges the two.

3. **Refactor ArtistaFormModal.tsx** — Replace all ~55 `useState` calls with a single
   `useForm<ArtistaFormValues>`. Implement `useFieldArray` for each relational section
   (`empresarios`, `gravadoras`, `editoras`, `bookers`, `juridico`, `financeiro`, `contador`, `assessoria`).
   Each array uses a nested `useFieldArray` for the distributors inside each entity.
   Keep the Dialog, the numbered-section layout and the current visual structure.

4. **Commercial Relationships section** — Build the UI for the new section 5: cards per
   entity, an "Adicionar X" (Add X) button, a remove button per card, inline fields per item.
   Distributors live inside the manager/record label/publisher cards as a subsection.
   Available distributor lists: ONErpm, DistroKid, 30 Por 1, Symphonic, Somvibe,
   SoundOn, MusicPro, Outro (Other) (+ a free-text field for custom entries).

5. **New fields in Section 1** — Add the artist slug (generated automatically from the stage
   name, manually editable), music tags (chip input with Enter/comma), career stage
   (Select: "iniciante" / "em ascensão" / "consolidado" / "mainstream").

6. **Social media URL validation** — Add real-time inline validation for
   Spotify, Instagram, YouTube, TikTok, SoundCloud, Deezer, Apple Music. Show a
   check/error icon next to each field. Reuse the extractors that already exist in the mapper.

7. **Update artista.mapper.ts** — Update `artistaToFormFields` and `formToArtistaPayload`
   to serialize/deserialize the `relacionamentos` array to/from the `Artista` type.
   Keep backward compatibility on the legacy fields for artists already registered.

8. **TypeScript and tests** — Run `cd client && npx tsc --noEmit` and confirm zero errors.
   Verify that the form opens, fills in, saves and reloads an artist in edit mode.

## Relevant files

- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/modules/artist/mappers/artista.mapper.ts`
- `client/src/modules/artist/mappers/index.ts`
- `client/src/modules/artist/pages/Artistas.tsx`
- `client/src/shared/data/mockData.ts`