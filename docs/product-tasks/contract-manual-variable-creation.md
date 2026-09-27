---
title: Add manual variable creation to the Contract Intelligence Engine
---
# Manual variable creation in the contract analyzer

## What & Why

After the AI semantic analysis, the user can only edit the automatically detected
variables. There is no way to add new variables that the AI did not identify —
for example, a specific clause that only the user recognizes as a variable.

The request is: have an "Adicionar Variável" (Add Variable) button that allows creating empty
variables manually and filling them in by hand.

## Done looks like

- "+ Adicionar" (+ Add) button in the variables panel header (next to "Aceitar todas" (Accept all))
- Clicking it opens an inline mini-form (or directly adds a new `VariableCard`
  with empty fields in edit mode)
- New variable created with:
  - `id`: `crypto.randomUUID()` or `nanoid`
  - `originalText`: empty (the user fills it in)
  - `placeholder`: empty (the user fills it in — automatic suggestion while typing the original text)
  - `inferredEntity`: empty
  - `context`: empty
  - `accepted: true` (created manually → active by default)
- The new card is visually distinguishable from AI variables ("manual" badge or a different icon)
- When typing into `originalText`, the `placeholder` field auto-suggests
  `{{CONTRATO.NOME_EM_CAPS_UNDERSCORED}}` (same pattern as the AI variables)
- TypeScript EXIT:0

## Out of scope

- Selecting text in the editor to create a variable from the selection (separate feature)
- Persistence/editing of manual variables in TemplateEditModal (outside the import workspace)

## Steps

1. **Add a `handleAddManualVariable` handler in `ContractImportWorkspace`** —
   creates a `SemanticVariable` with empty fields and `accepted: true`, adds it to the
   `variables` state, activates it (`setActiveVariableId`).

2. **"+ Adicionar" button in the panel header** — next to "Aceitar todas",
   always visible (regardless of whether there are variables or not).

3. **"manual" badge on `VariableCard`** — detect whether `originalText` starts empty or
   use a `source?: "ai" | "manual"` field on the interface. Add a `source` field to
   `SemanticVariable` in `contracts.types.ts` as optional (`source?: "ai" | "manual"`).
   Manual cards show a small "Manual" badge in the `outline` color.

4. **Placeholder auto-suggestion** — in `VariableCard`, when `originalText` changes and
   `placeholder` is empty, derive the placeholder automatically:
   `{{CONTRATO.` + text in uppercase, without spaces (underscored) + `}}`.

5. **TypeCheck** — `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`

## Relevant files

- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx`
  - line 195: `VariableCard` component
  - line 305: `variables` state
  - line 695: variables panel (header + list)
- `apps/web/src/modules/contracts/types/contracts.types.ts:191`
  - `SemanticVariable` interface — add `source?: "ai" | "manual"`
