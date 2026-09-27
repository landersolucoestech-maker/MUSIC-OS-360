# Unify the Contracts Module (v1 + v2)

## What & Why

There are two contracts modules visible in the sidebar ("Contratos" and "Contratos v2"), which confuses users and duplicates functionality. v1 has the complete operational flow (CRUD, KPIs, filters, bulk, artist/client/release link). v2 adds the electronic signature integration (7-step wizard, templates with typed variables, per-signer tracking, audit timeline).

The unification is a **continuous linear flow**, not two parallel tabs: create contract → review → send for signature → track signatures. Everything inside a single module, a single sidebar entry.

## Done looks like

- The sidebar shows **only** "Contratos" (one entry, no "Contratos v2")
- The `/contratos` page is **identical** to the current v1 version (list, KPIs, filters, bulk) — no new tabs on the main page
- `ContratoViewModal` (a contract's detail modal) gains an **"Assinatura Digital"** (Digital Signature) tab with two states:
  - **No linked document**: an "Iniciar Processo de Assinatura" (Start Signature Process) button that opens the v2 wizard prefilled with the contract's `contract_id`, title and artist
  - **With a linked document**: shows the document status (badge), the list of signers with their individual state (signed / pending / signature date), and the complete audit timeline (v2's DocumentTimeline)
- v2's 7-step wizard works as a full-screen page at `/contratos/assinatura/novo` (reachable via the button in the modal, not directly from the sidebar)
- The `/contratos/templates` route absorbs the v2 templates: the existing TemplatesContratos page gains a second sub-tab "Templates com Variáveis" (Templates with Variables) with v2's TemplateBuilder
- The `/contratos-v2/*` routes are removed from App.tsx (redirect to `/contratos` so as not to break old bookmarks)
- tsc --noEmit → 0 errors after the unification

## Out of scope

- Changing the layout of the main `/contratos` page (v1 list preserved intact)
- Real Autentique backend (remains a stub in MOCK_MODE — it already was)
- Migration of localStorage data between v1 and v2 (the separate keys stay)
- Visual redesign of any existing component
- Changes to the `releases/` module (PROTECTED)
- Removal of the `contracts-v2/` folder (the code stays, only the direct routes are removed)

## Steps

1. **Remove "Contratos v2" from the sidebar** — Remove the `{ title: "Contratos v2", href: "/contratos-v2", ... }` entry from `AppSidebar.tsx`. A single "Contratos" entry remains.

2. **Add the "Assinatura Digital" tab to ContratoViewModal** — In the detail modal's tab list ("Informações", "Signatários", "Histórico", "Versões" — Information, Signers, History, Versions), add the "Assinatura Digital" tab. When no document is linked to the `contract_id`, show an "Iniciar Processo de Assinatura" button that navigates to `/contratos/assinatura/novo?contract_id=<id>&titulo=<titulo>&artista_id=<artista_id>`. When a document exists (lookup via `useDocuments()` filtering by `contract_id`), show DocumentStatusBadge, the list of signers with their individual state, and DocumentTimeline.

3. **Create the `/contratos/assinatura/novo` route** — Add this route to `contracts.routes.tsx`. v2's `NewDocument.tsx` page must read the `contract_id`, `titulo` and `artista_id` query params to prefill the wizard. After the wizard is completed, redirect back to `/contratos`.

4. **Unify the Templates page** — At `/contratos/templates`, the existing `TemplatesContratos.tsx` page gains two internal sub-tabs: "Templates Simples" (Simple Templates — current content) and "Templates com Variáveis" (v2's TemplateBuilder). Navigation to templates does not change.

5. **Disable the v2 routes in App.tsx** — Remove the `contractsV2Routes` import and its inclusion in the routes. Add a `<Route path="/contratos-v2/*" element={<Navigate to="/contratos" replace />} />` to redirect old bookmarks.

6. **TypeScript validation** — Run `tsc --noEmit` and fix any type error introduced by the integration (especially cross imports between `contracts/` and `contracts-v2/`).

## Relevant files

- `client/src/shared/components/layout/AppSidebar.tsx:113-114`
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts/pages/TemplatesContratos.tsx`
- `client/src/modules/contracts-v2/pages/DocumentEngine.tsx`
- `client/src/modules/contracts-v2/pages/NewDocument.tsx`
- `client/src/modules/contracts-v2/pages/TemplateBuilder.tsx`
- `client/src/modules/contracts-v2/hooks/useDocumentEngine.ts`
- `client/src/modules/contracts-v2/types/index.ts`
- `client/src/modules/contracts-v2/components/wizard/DocumentWizard.tsx`
- `client/src/modules/contracts-v2/components/timeline/DocumentTimeline.tsx`
- `client/src/modules/contracts-v2/components/shared/DocumentStatusBadge.tsx`
- `client/src/app/routes/contracts.routes.tsx`
- `client/src/app/routes/contracts-v2.routes.tsx`
- `client/src/app/App.tsx`
