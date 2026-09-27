---
title: Refactor the Contract Intelligence Engine — open semantic AI, 3-pane UI, no fixed schemas
---
---
title: Completely refactor the Contract Templates module — AI-Driven Semantic Engine
---

# Refactor the Contract Intelligence Engine

## Problem

The current implementation violates the system's architectural principles in three layers:

1. **Closed types** — `SemanticClauseType` is a fixed TypeScript union with 12 values; any clause outside those 12 is silently discarded
2. **Closed namespaces** — `ALLOWED_NAMESPACES` in `semantic-parser.service.ts` is a hardcoded `Set`; variables with namespaces such as `AUTOR`, `COMPOSITOR`, `EDITORA`, `CEDENTE` are rejected
3. **Rigid UI** — `ContractImportWorkspace.tsx` (898 lines) is a Dialog with a multi-step wizard, tabs, rigid forms and hardcoded color maps — everything the user has forbidden

## Mandatory principle

**The document is the source of truth.** The engine must not have:
- predefined schemas
- fixed namespaces
- fixed clause types
- rigid forms
- a multi-step wizard
- tabs

The engine **infers everything** from the semantic context of the document.

---

## Mandatory changes

### 1. `contracts.types.ts` — Open up the types

```typescript
// ANTES (fechado):
export type SemanticClauseType =
  | "financeira" | "autoral" | "royalties" | "exclusividade"
  | "confidencialidade" | "inadimplencia" | "distribuicao_digital"
  | "licenciamento" | "rescisao" | "assinatura" | "prazo" | "objeto";

// DEPOIS (aberto):
export type SemanticClauseType = string;
```

`SemanticParseResult` and `SemanticTemplateManifest` automatically inherit the open type.

Remove `BrandingSettings`, `SignatureSettings`, `Participant`, `ContractVariable`, `FinancialConfig`, `ContractTemplate` from the scope of the semantic engine (they may stay but isolated — they are not used in the new UI).

### 2. `semantic-parser.service.ts` — Rewrite the system prompt and remove the closed validation

**Remove completely:**
- `ALLOWED_NAMESPACES` (hardcoded Set)
- `validatePlaceholder()` (closed namespace check)

**New `validatePlaceholder()`** — structural validation only:
```typescript
function validatePlaceholder(p: string): boolean {
  return /^\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+\}\}$/.test(p);
}
```

**Rewrite SYSTEM_PROMPT** completely:
- Remove the closed list of allowed namespaces
- Remove the rule "omita se não souber o namespace" (omit if you do not know the namespace) → replace it with "use o namespace mais preciso semanticamente — PARTE_A / PARTE_B como último recurso" (use the semantically most precise namespace — PARTE_A / PARTE_B as a last resort)
- Expand the examples to cover: AUTOR, COMPOSITOR, EDITORA, CEDENTE, CESSIONARIO, INTERPRETE, GRAVADORA, AGENCIA, REPRESENTANTE, LICENCIANTE, LICENCIADO, EVENT, VIDEO, WORK, PHONOGRAM, BEAT, DISTRIBUTION, CONTRACT, FINANCIAL, PAYMENT
- Instruct the AI to infer the context (financial, legal, operational) BEFORE generating the placeholder
- Instruct the AI to include all parties detected in the document
- SemanticClauseType in the output: free-form field — the AI generates any string that describes the type of the detected clause
- Maximum number of variables: increase from 40 to 60 (complex contracts have more data)

**Detailed financial prompt** — add explicit examples to SYSTEM_PROMPT for:
- royalties, performance fee ("cachê"), penalty, interest, late-payment charges ("mora"), IPCA, IGPM, down payment, installments, PIX, TED, boleto
- technical rider, accommodation, schedule
- ISRC, ISWC, UPC, DSP, platforms

### 3. `ContractImportWorkspace.tsx` — Rewrite completely (it is not a Dialog)

**Current layout:** Dialog modal with a multi-step wizard (4 steps)

**New layout:** Full-screen page (or full-height drawer) with 3 fixed zones:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [← Voltar]   Contract Intelligence Engine         [Salvar Template]  │
├────────────────────────────┬───────────────────────────────────────────┤
│                            │                                           │
│   ZONA CENTRAL             │   PAINEL LATERAL                          │
│   ─────────────            │   ─────────────                           │
│                            │                                           │
│   Estado 1: DROP ZONE      │   Estado 1: Aguardando análise            │
│   ─────────────────        │   (placeholder animado)                   │
│   [ícone upload]           │                                           │
│   "Arraste ou clique       │   Estado 2: Analisando...                 │
│    para importar"          │   Loader + "A IA está a analisar          │
│   .PDF .DOCX .TXT          │   o documento semanticamente"             │
│                            │                                           │
│   Estado 2: EDITOR         │   Estado 3: Variáveis detectadas          │
│   ────────────────         │   ─────────────────────────               │
│   Texto do contrato        │   [chip: "financeira"] [chip: "autoral"]  │
│   renderizado (read-only   │                                           │
│   mas com highlight dos    │   VariableCard × N                        │
│   valores substituídos     │   ┌──────────────────────────────┐        │
│   por {{placeholders}}     │   │ valor original               │        │
│   em destaque)             │   │ contexto detectado           │        │
│                            │   │ {{PLACEHOLDER.GERADO}}       │        │
│   [Reanalizar] [Limpar]    │   │ [✓ Aceitar] [✗ Rejeitar]    │        │
│                            │   │ [editar placeholder]         │        │
│                            │   └──────────────────────────────┘        │
│                            │   [+ Adicionar variável manual]           │
│                            │                                           │
└────────────────────────────┴───────────────────────────────────────────┘
```

**Remove completely:**
- The steps/wizard system (`step` state, `setStep`)
- The "Financeiro", "Obra Musical", "Assinaturas", "Branding" tabs
- The hardcoded `CLAUSE_TYPE_LABELS` / `CLAUSE_TYPE_COLORS` maps
- The name form at the end of the wizard
- Any `Select` with a fixed contract type

**Keep (rewrite):**
- PDF upload (via mammoth for DOCX, plain text for TXT, FileReader for PDF)
- Textarea for pasting text
- The call to `parseContractText()`
- `VariableCard` (simplified: original value + context + editable placeholder + accept/reject)
- `handleAddManualVariable`
- `applyVariablesToText()` for the preview
- Save via `onSave()`

**New template name field:** a simple Input in the header (not in a separate tab)

**Clause type chips:** Rendered dynamically as free-form strings — no fixed color map. Use a single neutral color (outline badge) for all of them.

### 4. `TemplatesContratos.tsx` — Remove the hardcoded maps

- Remove `CLAUSE_TYPE_LABELS` and `CLAUSE_TYPE_COLORS` (closed Record)
- Render clauseTypes as a generic `<Badge variant="outline">{ct}</Badge>`
- Keep the stats, the card grid, delete/view/edit

### 5. `TemplateContratoViewModal.tsx` and `TemplateContratoFormModal.tsx`

- `TemplateContratoFormModal.tsx` — remove (replaced by the new workspace)
- `TemplateContratoViewModal.tsx` — simplify: show the template text with highlighted placeholders + the list of variables from the manifest

---

## Files to modify

| File | Action |
|----------|-------|
| `contracts/types/contracts.types.ts` | `SemanticClauseType = string` |
| `contracts/services/semantic-parser.service.ts` | Rewrite SYSTEM_PROMPT + open up validatePlaceholder |
| `contracts/components/ContractImportWorkspace.tsx` | Rewrite completely (3-pane layout) |
| `contracts/components/TemplatesContratos.tsx` → page | Remove the CLAUSE_TYPE_LABELS/COLORS maps |
| `contracts/components/TemplateContratoViewModal.tsx` | Simplify |
| `contracts/components/TemplateContratoFormModal.tsx` | Remove or empty out |

---

## Done looks like

1. Open `/contratos/templates` → list of templates (no fixed maps)
2. Click "Novo Template" (New Template) → the full-screen workspace opens
3. Drag in any contract (DOCX, TXT) → text rendered in the center
4. Click "Analisar com IA" (Analyze with AI) → the side panel fills with detected variables
5. The variables include ALL parties (author, publisher, assignor, etc.)
6. Clause type chips are free-form strings (not a fixed enum)
7. The user can accept/reject/edit each variable
8. Click "Salvar Template" (Save Template) → returns to the list with the new template
9. TypeScript: `EXIT:0`

---

## Constraints

- Do not change `contracts.service.ts`, `useTemplatesContratos.ts` (the data layer does not change)
- Do not change the route or `MainLayout`
- Keep `source?: "ai" | "manual"` in `SemanticVariable`
- Toast: `import { toast } from "sonner"`
- No parallel tool calls (the user's absolute rule)