# Template Tab Layout — Variables Panel + Form on the Left

## What & Why
In the "Template" tab of the `ContractImportWorkspace` modal, the "Informações Básicas" (Basic Information) and "Identidade Visual do Documento" (Document Visual Identity) sections are stacked on top of the editor, taking up height vertically and squeezing the "Variáveis do Registo" (Registry Variables) side panel. The user wants these sections to sit on the left side (together with the editor) so that the variables panel has more height available.

## Done looks like
- The "Template" tab uses a 2-column side-by-side layout:
  - **Left column** (`flex-1`): "Informações Básicas" section (name + category) → "Identidade Visual" section (header/footer image uploaders) → text editor (takes the remaining height)
  - **Right column** (fixed width, same as the current `w-72`): the "Variáveis do Registo" panel takes the full height of the modal, without being squeezed by the upper sections
- The variables panel (ScrollArea) has significantly more visible height than before
- The "Informações Básicas" and "Identidade Visual" sections get their own scroll or stay fixed at the top of the left column with controlled overflow
- The overall look of the modal keeps the same width, border-b and existing styles; only the layout axis changes from vertical (top→bottom) to horizontal (left | right)

## Out of scope
- Changes to the "Variáveis", "Categorias" or "Preview" tabs
- Changes to the fixed footer ("Cancelar" + "Salvar Template")
- Changes to `ImageUploadZone` itself

## Steps
1. **Restructure the "template" TabsContent** — swap the current layout (vertical stack of `shrink-0` sections + a `Editor | Vars` flex row) for a single 2-column flex row that takes all the available space: left column (`flex-1`, `flex flex-col`, `overflow-y-auto`) + right column (fixed width, `flex flex-col`, `border-l`, full height).
2. **Left column** — move into it, in order: "Informações Básicas" (without `border-b`, with an inner `border-b` between sections or the normal `px-6 py-4`), "Identidade Visual do Documento", and the text editor area with the "Analisar com IA" (Analyze with AI) button. The column must have `overflow-y-auto` to allow scrolling if the content grows.
3. **Right column** — the "Variáveis do Registo" panel sits in the right column and grows to take the full available height of the modal (without being limited by the form sections). Keep `ScrollArea flex-1` for the variable list and the "Variável Rápida" (Quick Variable) block fixed at the bottom.

## Relevant files
- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:707-886`
