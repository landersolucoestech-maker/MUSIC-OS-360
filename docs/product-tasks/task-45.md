---
title: ServiceTypeFormModal — UX/Layout Refactor
---
# ServiceTypeFormModal — UX/Layout Refactor

## What & Why
The current `ServiceTypeFormModal` is visually flat: all fields render in a single vertical sequence with no grouping, hierarchy, or breathing room. The modal is also too narrow (`max-w-lg`) for the volume of content. This refactor reorganises the JSX into five labelled sections (Cards) and improves desktop layout without touching any business logic, validation, or submit payload.

## Done looks like
- Modal opens at `max-w-4xl` width — noticeably wider and more comfortable
- Five distinct visual sections, each with a Card header and clear title:
  1. **"Informações Básicas"** (Basic Information) — "Nome", "Descrição", "Tipos de Cliente" (Name, Description, Client Types)
  2. **"Configuração Financeira"** (Financial Configuration) — "Modelo Financeiro" (Financial Model), financial checkboxes in a 2-column grid, "Categoria Financeira Padrão" (Default Financial Category)
  3. **"Cláusulas do Contrato"** (Contract Clauses) — existing clause editor with internal scroll area, variable chips instead of inline text
  4. **"Personalização do Documento"** (Document Customization) — header ("Cabeçalho") + footer ("Rodapé") upload (unchanged)
  5. **"Configurações Avançadas"** (Advanced Settings) — "Slug", "Ordem de exibição" (Display order), "Status Ativo" (Active status), inside a Collapsible/Accordion section styled as secondary
- Financial checkboxes render in a 2-column responsive grid instead of a vertical list
- Available template variables are shown as inline badge chips instead of a long text paragraph
- All `data-testid` attributes preserved
- No changes to Zod schema, submit payload, upload logic, hooks, or useEffect

## Out of scope
- Business logic changes
- Zod schema changes
- Submit payload changes
- Adding or removing fields
- Changing upload behaviour for the header/footer ("cabeçalho"/"rodapé")
- Any changes outside `ServiceTypeFormModal.tsx`

## Steps
1. **Widen the modal** — Change `max-w-lg` to `max-w-4xl` on the `DialogContent`; adjust `ScrollArea` max-height to `max-h-[85vh]` accordingly.
2. **Section 1 — Basic Information** — Wrap the "Nome", "Descrição", "Tipos de Cliente" fields in a Card with CardHeader/CardTitle "Informações Básicas". Use a 2-column grid for Name + (empty or description row).
3. **Section 2 — Financial Configuration** — Wrap "Modelo Financeiro", the financial checkboxes, and "Categoria Financeira Padrão" in a Card with CardHeader/CardTitle "Configuração Financeira". Render checkboxes in a `grid grid-cols-2 gap-2` layout.
4. **Section 3 — Contract Clauses** — Keep existing clause logic; wrap in a Card with CardHeader/CardTitle "Cláusulas do Contrato". Replace the variables text paragraph with individual `<Badge variant="outline">` chips in a flex-wrap row.
5. **Section 4 — Document Customization** — Wrap the header/footer upload fields in a Card with CardHeader/CardTitle "Personalização do Documento". Grid layout 2 columns.
6. **Section 5 — Advanced Settings** — Place the "Slug", "Ordem de exibição", and "Status Ativo" fields inside a `Collapsible` (shadcn) with a muted/secondary trigger label "Configurações Avançadas". Collapsed by default when creating; expanded when editing.

## Relevant files
- `apps/web/src/modules/contracts/components/ServiceTypeFormModal.tsx`
- `apps/web/src/shared/ui/card.tsx`
- `apps/web/src/shared/ui/collapsible.tsx`
- `apps/web/src/shared/ui/badge.tsx`