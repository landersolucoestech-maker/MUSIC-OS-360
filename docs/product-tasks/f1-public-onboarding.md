# Public Artist Onboarding

## What & Why
Turn the `ArtistaSignupPublic` page (currently a simple form) into a branded, functional landing page for capturing new artists. The artist fills in their data, sends documents (press kit, bio, photo), strategic links (streaming, social) and assets — everything is saved automatically in the record label's system as a new artist record with status "onboarding".

## Done looks like
- The public URL `/cadastro/:orgSlug` displays a branded landing page with logo, record label description and a multi-step form
- Step 1 — Basic data: stage name, legal name, type (solo/band/DJ), genre, email, phone, CPF/CNPJ
- Step 2 — Links and social media: Spotify, Instagram, TikTok, YouTube, SoundCloud + a free-form "press kit link" field
- Step 3 — Message and context: free-text field (bio/proposal/context), profile photo upload (URL or direct upload), press kit PDF upload (stored as a URL in the notes)
- On submit: the artist is created in the system with `status = "onboarding"`, all links saved, notes filled in
- Success page with a protocol number (truncated artist ID) and next-steps instructions
- If the orgSlug is invalid/missing: a clear error message instead of a blank form
- Responsive, dark/light mode, no login required

## Out of scope
- Real file upload to storage (use URL fields for now)
- Email integration (admin notification is left for a future phase)
- Multiple documents beyond the press kit
- In-app press kit preview

## Steps
1. **Redesign the landing page** — Replace the simple layout with a landing page with a hero section (record label name, tagline, CTA), a benefits section and a multi-step form in a centered card
2. **Implement the multi-step stepper** — 3 steps with a progress indicator, per-step validation, prev/next navigation, current step persisted in local state
3. **Links and social media step** — Fields for Spotify, Apple Music, YouTube, Instagram, TikTok, SoundCloud, plus a free-form field for the press kit URL
4. **Bio and assets step** — Free-text field for the proposal/context, photo URL field, press kit URL field (PDF), image preview
5. **Persistence and success page** — On submit, create the artist with all filled-in fields and status "onboarding"; display a confirmation screen with the protocol number

## Relevant files
- `client/src/modules/auth/pages/ArtistaSignupPublic.tsx`
- `client/src/modules/artist/components/ArtistaForm.tsx`
- `client/src/modules/artist/application/createArtist.usecase.ts`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/app/routes/`
