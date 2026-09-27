---
title: Refactor the 'Novo Template' modal — 3 tabs (Template · Variables · Preview)
---
# Refactor the "Novo Template" (New Template) Modal — 3 Tabs

## What & Why

The `ContractImportWorkspace` modal (opened by "+ Novo Template" at `/contratos/templates`) has a long, disorganized vertical layout. The refactor turns it into a professional editor with 3 horizontal tabs at the top: **"Template · Variáveis · Preview"** (Template · Variables · Preview).

## Done looks like

### Modal
- Width ~980–1100 px, max height 85 vh, no outer scroll
- Fixed header: title "Novo Template de Contrato" (New Contract Template) + X button
- Horizontal pill tabs at the top: **"Template · Variáveis · Preview"**
- Fixed footer: the text "Alterações salvas automaticamente" (Changes saved automatically) on the left + "Cancelar" (Cancel) + "Salvar Template" (Save Template) buttons (with loading state) on the right

### Tab — Template
- **Basic Information section**: 2-column grid — "Nome do Template" (Template Name) Input + "Categoria" (Category) Select
- **Header and Footer section**: two `ImageUploadZone`s side by side for `header_image` / `footer_image`. Each one has: an elegant empty state (icon + text), a hover state, an `object-contain` preview, and an overlay with a "Substituir" (Replace) button and a "Remover" (Remove) button
- **Clause Editor** (below the uploads): a continuous full-height document-style `<textarea>` (generous padding, slightly lighter background, elegant typography), placeholder "Escreva o conteúdo do contrato…" (Write the contract content…), without the old system of multiple cards per clause. `{{VARIAVEL}}` highlighting kept
- **Fixed side panel** on the right (width ~272 px): list of variables grouped by category (AGÊNCIA, ARTISTA, FINANCEIRO…); clicking a variable inserts it into the editor with a confirmation toast. The panel is always visible within this tab

### Tab — Variables
- Renders the full content of the existing `VariableRegistry` (search, listing, create, edit, delete, import XLSX, export XLSX) — **without** the PageHeader of the standalone page
- Use the existing logic via `useVariableRegistry`

### Tab — Preview
- Simulates an A4 sheet (max-w, shadow, wide inner padding) with:
  - Header: the `header_image` image (or an elegant empty area)
  - Body: contract text with the `{{X.Y}}` variables highlighted
  - Footer: the `footer_image` image (or an elegant empty area)
- Visual style inspired by a Word/PDF document

### Cleanup
- Remove the separate `VariableRegistry` Dialog and the `varRegistryOpen` state added in the previous task — the functionality now lives in the Variables tab
- Remove the "Variáveis" (Variables) button that opened that Dialog from the modal header
- Remove unused imports; confirm `tsc --noEmit --skipLibCheck` with no errors

## Out of scope
- Changes to the standalone page `/contratos/variaveis`
- Backend / real persistence
- WYSIWYG rich-text editor
- Editing existing templates (another time)

## Steps

1. **Restructure the modal** — Replace the vertical layout with: fixed header → `<Tabs>` (shadcn) with 3 triggers → scrollable content area → fixed footer. Delete the old blocks (clause cards, scattered fields).

2. **Template tab — Basic Information** — 2-column grid with the Name Input and Category Select using the existing controlled state.

3. **Template tab — Uploaders** — Internal `ImageUploadZone` component (not exported) with both states (empty / with image + overlay), using the `FileReader` already present in the original code.

4. **Template tab — Editor + side panel** — Flex row: full-height `<textarea>` editor on the left; fixed `RegistryVarGroup` panel (w-72) on the right with clickable variables that insert into the editor. Preserve the semantic detection logic and the AI button.

5. **Variables tab** — Mount the `VariableRegistry` content with `asModal={true}` (no PageHeader) inside the corresponding `TabsContent`, passing `onClose` as a no-op since there is no Dialog wrapper.

6. **Preview tab** — Internal `A4Preview` component: A4 sheet container with shadow; renders header_image, the content with variable highlighting, and footer_image.

7. **Fixed footer + cleanup** — Sticky footer, remove the `varRegistryOpen` Dialog, the obsolete state and button, confirm clean TypeScript.

## Relevant files

- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx`
- `apps/web/src/modules/contracts/pages/VariableRegistry.tsx`
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/shared/ui/tabs.tsx`
- `apps/web/src/shared/ui/dialog.tsx`
- `apps/web/src/shared/ui/scroll-area.tsx`