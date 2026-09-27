# Side-by-side layout — Basic Information + Visual Identity

## What & Why
In the contract template workspace (`ContractImportWorkspace`), the "Informações Básicas" (Basic Information) and "Identidade Visual do Documento" (Document Visual Identity) sections are stacked vertically, consuming height that could be used by the contract content editor. The goal is to place them side by side in a single row, freeing up maximum vertical space for the "Conteúdo do Contrato" (Contract Content) textarea.

## Done looks like
- "Informações Básicas" and "Identidade Visual do Documento" appear in two columns in the same row (side by side), separated by a vertical divider.
- The "Conteúdo do Contrato" block (textarea) takes up all the remaining height of the left column, visibly larger than before.
- The separation between the top block and the editor keeps the horizontal border that already exists.
- The layout does not break at any resolution the modal already supported.

## Out of scope
- Changes to the variables panel (right column).
- Changes to the fields themselves (inputs, selects, image upload zones).
- Other workspace tabs ("Variáveis", "Categorias", "Preview").

## Steps
1. **Merge the two sections into a single row** — Replace the two independent `<div>`s with `border-b` with a single two-column container using `display: grid` (or `flex`), where the first column contains "Informações Básicas" and the second "Identidade Visual do Documento". Keep only one `border-b` at the bottom of that container. Add a vertical divider (`border-l`) between the two columns.

2. **Adjust heights and padding** — Ensure that the top container is `shrink-0` and that the editor block (`flex-1 flex flex-col overflow-hidden`) keeps growing to fill the remaining space with no change to its own internal structure.

## Relevant files
- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:710-814`
