---
title: Template preview toggle in the Contract Import Workspace
---
# Template Preview Toggle in the Import Workspace

## What & Why

During the review stage ("review" step) of `ContractImportWorkspace`, the left panel shows the **original contract text** with the real values highlighted in blue (e.g. `João da Silva`, `R$ 5.000,00`). The user cannot see what the final template will look like with the placeholders placed in the right spots (e.g. `{{CONTRATADO.NOME}}`, `{{PAYMENT.AMOUNT}}`). The substitution only happens internally at save time.

The goal is to show the user **in real time** what the template will look like after substitution, so they can validate that each placeholder was placed in the correct spot before confirming.

## Done looks like

- In the "review" stage of ContractImportWorkspace, the left panel has two toggle buttons in its header: **"Original"** and **"Template"**
- **Original** mode (current behavior): contract text with the real values highlighted in blue, with scrolling to the active element
- **Template** mode (new): text with all accepted `{{NAMESPACE.CAMPO}}` placeholders already substituted in the correct spots, highlighted in yellow. Reactive — updates automatically when the user accepts/rejects variables or edits placeholders
- The toggle keeps its state throughout the whole review stage
- "Template" mode uses the existing `applyVariablesToText` function to compute the transformed text
- Zero TypeScript errors (`EXIT:0`)

## Out of scope

- Editing the transformed text directly in the preview panel
- Persisting the selected mode across sessions
- Changes to the "naming" stage or to the save flow (`handleSave` already calls `applyVariablesToText` correctly)

## Steps

1. **Toggle state** — Add a `previewMode: "original" | "template"` state to the `ContractImportWorkspace` component, with initial value `"original"`
2. **Left panel header** — Add two toggle buttons (segmented-control style) to the header of the left column of the "review" stage, next to the title "Documento com variáveis destacadas" (Document with highlighted variables)
3. **Conditional rendering** — In the body of the left panel, render `highlightVariablesInText(rawText, variables, activeVariableId)` when `previewMode === "original"`, and the transformed text with yellow placeholders (using `applyVariablesToText` + a highlight helper similar to the `renderPreviewWithPlaceholders` that already exists in `TemplateEditModal`) when `previewMode === "template"`
4. **Reactive** — Ensure that "Template" mode recomputes whenever `variables` changes (the `useState` hooks already propagate; no additional `useMemo` needed)
5. **TypeScript check** — Confirm `EXIT:0` after the changes

## Relevant files

- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:63-105`
- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:590-640`
- `apps/web/src/modules/contracts/services/semantic-parser.service.ts:182-196`
- `apps/web/src/modules/contracts/components/TemplateEditModal.tsx:93-109`