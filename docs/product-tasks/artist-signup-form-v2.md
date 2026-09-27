# Redesign the Public Artist Signup Form

## What & Why
Reorganize and expand the `/signup/artista/:orgSlug` form according to the specification:
new fields, a multi-select for Profile Type, a Gender (sex) field, Date of Birth,
a complete alphabetically sorted list of music genres, a Deezer field, a distributors
section in Tab 2, and a Summary section with the artist's data in Tab 3.
Keeps the visual identity, responsiveness and 3-tab structure.

## Done looks like

**Tab 1 — "Dados Básicos" (Basic Data)** (in order):
- "Nome Artístico" (Stage Name)
- "Nome Civil" (Legal Name)
- "Tipo de Perfil" (Profile Type) — multi-select checkbox group: "DJ" · "DJ/Produtor" · "Compositor/Autor" · "Intérprete" · "Produtor" (at least 1 required to proceed)
- "Gênero" (Gender) — select or radio with: "Masculino" / "Feminino"
- "Gênero Musical" (Music Genre) — complete alphabetically sorted list
- "E-mail" (required)
- "Telefone / WhatsApp" (Phone / WhatsApp) (required)
- CPF (Brazilian individual taxpayer ID)
- "Data de Nascimento" (Date of Birth) (date picker or date-type input)

**Tab 2 — "Links e Redes" (Links and Social Media)**:
- Instagram, TikTok, YouTube, Spotify, Apple Music, Deezer (new), SoundCloud
- "Link do Presskit" (Press Kit Link)
- "Distribuidoras" (Distributors) section: distributor Select (list of the main players in the BR market + "Outro" (Other)) + share/access e-mail Input

**Tab 3 — "Bio e Contexto" (Bio and Context)**:
- "Resumo" (Summary) section displaying the filled-in values as cards or rows: Artist Name, Profile Type, Phone/WhatsApp, E-mail
- Existing fields kept: Biography, Profile Photo (URL), Message to the record label

Validation and submit: all new fields included in the payload for `createArtistUseCase`;
fields with no dedicated field in the use case (`deezer`, `distribuidora`, `distribuidora_email`, `data_nascimento`)
go into `notas_internas`.

## Out of scope
- Changes in modules other than `ArtistaSignupPublic.tsx`
- Summary generation via AI/OpenAI — the Summary section is a read-only display of data already filled in
- Real integration with distributors (captures text into `notas_internas`)

## Steps

1. **Types and constants** — Add to `FormData`: `tipo_perfil: string[]`, `genero: string`, `data_nascimento: string`, `deezer: string`, `distribuidora: string`, `distribuidora_email: string`. Replace `TIPOS` with `TIPO_PERFIL_OPTIONS` with the 5 options. Expand `GENEROS` into a complete, alphabetically sorted list of BR music genres (at least 30 genres). Add `DISTRIBUIDORAS` (Believe, CD Baby, DistroKid, Ingrooves, Kontor, ONErpm, Orchard, Sony Music, Stem, Symphonic, TuneCore, Warner Music, Outro). Update `EMPTY`.

2. **Tab 1 — Profile Type, Gender, Date of Birth** — Remove the "Tipo" Select and replace it with a visual "Tipo de Perfil" checkbox group (multi-select, badge/toggle style). Add a "Gênero" Select ("Masculino"/"Feminino"). Add an Input type="date" or DatePicker "Data de Nascimento". Update `validateStep1` to require at least 1 profile type.

3. **Tab 2 — Deezer and Distributors** — Insert a Deezer field with the `SiDeezer` icon from `react-icons/si`. Add a "Distribuidoras" section with a Select + e-mail Input.

4. **Tab 3 — Summary section** — Display a Summary card at the top of Step 3 showing: Artist Name, Profile Type (join of the selected ones), Phone/WhatsApp, E-mail — using the form data filled in on the previous tabs.

5. **handleSubmit — map new fields** — Include the new fields in the payload. `tipo` in the use case receives `tipo_perfil.join(", ")`. Extra fields go into `notas_internas` along with the already existing fields.

## Relevant files
- `client/src/modules/auth/pages/ArtistaSignupPublic.tsx`
- `client/src/modules/artist/application/createArtist.usecase.ts`
