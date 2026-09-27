---
title: Semantic Contract Intelligence Engine
---
# Semantic Contract Intelligence Engine

## What & Why
Replace the entire current tab-based "Tipos de Contrato" CRUD system with a document-first contract template engine. Instead of filling rigid forms with fixed fields, the user uploads any contract document (PDF, DOCX, or plain text) and the system semantically parses it, detects every dynamic value in context, generates contextual placeholders (e.g. `{{FINANCIAL.LATE_INTEREST_RATE}}`), and saves the result as a reusable template. The document text is never altered — only raw data values are substituted by their placeholders.

OpenAI is already installed (javascript_openai_ai_integrations==2.0.0) and must be used for the semantic parsing step.

## Done looks like
- The `/contratos/templates` page shows a new "Novo Template" button that opens a full-screen document-import workspace (replaces the old ServiceTypeFormModal entirely)
- User can paste text or upload a file; the document text renders in a central editor
- On "Analisar Contrato", OpenAI parses the document and returns a list of detected variables, each with: `originalText`, `context`, `inferredEntity`, `placeholder` (e.g. `{{PAYMENT.AMOUNT}}`)
- A right-side panel lists every detected variable with original value / context / placeholder; user can accept, edit, or remove each one
- Clicking a variable in the panel highlights the corresponding span in the editor
- "Gerar Template" replaces accepted variables in the document text with their `{{PLACEHOLDER}}` and saves as a `TemplateContrato` record (reusing the existing `TemplateContrato` type and `useTemplatesContratos` hook)
- AI also shows clause-type badges on detected clauses (financial, copyright, exclusivity, confidentiality, default/non-payment, digital distribution, licensing, royalties)
- Existing contract list on `TemplatesContratos.tsx` keeps working — the new workspace is layered on top as a modal/page
- `ServiceTypeFormModal.tsx` is deleted; the old "Tipos de Contrato" table and its CRUD are removed from the page
- Zero TypeScript errors after the change

## Out of scope
- Backend API changes — stays in mock/localStorage mode
- PDF binary parsing library (user pastes extracted text or uploads a plain text / simple DOCX); no server-side file processing
- Actual digital signing flow (already handled in `ContratoFormModal`)
- The `Contratos` list page (`/contratos`) — untouched
- Royalties calculation, payout engine

## Steps
1. **New types** — Add `SemanticVariable` (originalText, context, inferredEntity, placeholder, accepted) and `SemanticParseResult` (variables, clauseTypes, rawText) to `contracts.types.ts`; add `ContractTemplate` shape that stores rawTemplate (with placeholders) + variable manifest
2. **Semantic parser service** — Create `modules/contracts/services/semantic-parser.service.ts`; it calls OpenAI (GPT-4o) with the contract text and a structured prompt that instructs the model to return a JSON array of `SemanticVariable` objects with contextual, namespaced placeholders — never generic ones; also returns detected clause type labels
3. **Document import workspace** — Create `modules/contracts/components/ContractImportWorkspace.tsx`: full-screen modal with three zones — (a) paste/upload area that accepts text or `.txt`/`.docx` file content, (b) central scrollable editor showing the document text with detected variable spans highlighted inline, (c) right panel listing detected variables; workspace has "Analisar Contrato" and "Gerar Template" action buttons
4. **Variable panel** — Right panel component `VariableDetectionPanel.tsx` inside the workspace: each card shows original text, semantic context, inferred entity, generated placeholder; user can edit the placeholder key or remove the variable from the substitution list
5. **Template generation** — On "Gerar Template", replace all accepted `originalText` occurrences with `{{PLACEHOLDER}}` in the raw document text, save via `useTemplatesContratos` hook as a new `TemplateContrato` with `conteudo` = generated template text and a JSON `variables_manifest` field, then close the workspace
6. **Refactor TemplatesContratos page** — Remove the "Tipos de Contrato" table and all references to `useContractServiceTypes` and `ServiceTypeFormModal`; replace with a clean template list (cards showing template name, detected variable count, clause badges, created date) plus a "Novo Template" button that opens `ContractImportWorkspace`; keep the existing `useTemplatesContratos` hook wiring
7. **Delete dead files** — Delete `ServiceTypeFormModal.tsx`, `useContractServiceTypes.ts`, and any imports that referenced them; ensure zero TypeScript errors

## Relevant files
- `apps/web/src/modules/contracts/pages/TemplatesContratos.tsx`
- `apps/web/src/modules/contracts/components/ServiceTypeFormModal.tsx`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/hooks/useTemplatesContratos.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/modules/contracts/utils/contract-variables.ts`
- `apps/web/src/modules/contracts/services/contracts.service.ts`
- `apps/web/src/shared/lib/storage.ts`