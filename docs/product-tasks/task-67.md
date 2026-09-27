---
title: Free contract template editor — write, paste, insert variables, optional AI
---
---
title: Replace the Contract Intelligence Engine with a free contract template editor
---

# Free Contract Template Editor

## Change of direction

The previous system was AI-centric: the user imported a contract → the AI analyzed it → it detected variables. That is wrong.

The new system is centered on the **user as author**:
- The user freely writes or pastes any contract
- The user inserts placeholders by clicking in a side library
- The user creates custom variables without restrictions
- The AI is only an optional suggestion — it does not control anything

## Mandatory architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [← Voltar]  Nome do template: [______________]        [Pré-visualizar] [Guardar] │
├──────────────────────────────────────┬───────────────────────────────────┤
│                                      │                                   │
│  EDITOR LIVRE                        │  BIBLIOTECA DE VARIÁVEIS          │
│  ─────────────                       │  ─────────────────────────        │
│                                      │                                   │
│  Textarea de texto livre             │  [🔍 Pesquisar variável...]       │
│  (como Notion/Docs)                  │                                   │
│                                      │  ▾ Envolvidos                     │
│  O utilizador escreve ou cola        │    {{PARTY_1.NAME}}  [+]          │
│  qualquer contrato.                  │    {{PARTY_1.CPF}}   [+]          │
│                                      │    {{PARTY_1.CNPJ}}  [+]         │
│  Os {{placeholders}} são             │    {{PARTY_1.RG}}    [+]          │
│  destacados a azul.                  │    {{PARTY_1.ADDRESS}} [+]        │
│                                      │    {{PARTY_1.EMAIL}} [+]          │
│  [Sugestões IA ▾]                    │    {{PARTY_1.PHONE}} [+]          │
│                                      │                                   │
│                                      │  ▾ Financeiro                     │
│                                      │    {{PAYMENT.AMOUNT}}  [+]        │
│                                      │    {{PAYMENT.CURRENCY}} [+]       │
│                                      │    {{PAYMENT.METHOD}} [+]         │
│                                      │    {{PAYMENT.DUE_DATE}} [+]       │
│                                      │    {{PAYMENT.INSTALLMENTS}} [+]   │
│                                      │    {{PAYMENT.LATE_INTEREST}} [+]  │
│                                      │    {{PAYMENT.FINE}} [+]           │
│                                      │                                   │
│                                      │  ▾ Contrato                       │
│                                      │    {{CONTRACT.START_DATE}} [+]    │
│                                      │    {{CONTRACT.END_DATE}} [+]      │
│                                      │    {{CONTRACT.DURATION}} [+]      │
│                                      │    {{CONTRACT.CITY}} [+]          │
│                                      │                                   │
│                                      │  ▾ Obra                           │
│                                      │    {{WORK.TITLE}} [+]             │
│                                      │    {{WORK.ISRC}} [+]              │
│                                      │    {{WORK.ISWC}} [+]              │
│                                      │    {{WORK.UPC}} [+]               │
│                                      │                                   │
│                                      │  ▾ Evento                         │
│                                      │    {{EVENT.NAME}} [+]             │
│                                      │    {{EVENT.DATE}} [+]             │
│                                      │    {{EVENT.LOCATION}} [+]         │
│                                      │    {{EVENT.CACHE}} [+]            │
│                                      │                                   │
│                                      │  ─────────────────────────        │
│                                      │  + Criar variável customizada      │
│                                      │  [GRUPO.CAMPO]  →  {{GRUPO.CAMPO}} │
└──────────────────────────────────────┴───────────────────────────────────┘
```

## What to REMOVE

- The whole import wizard flow ("upload" → "analyzing" → "review" phases)
- All file processing (FileReader, mammoth, PDF handling)
- The `parseContractText()` call as the main flow
- The complex `VariableCard` with accept/reject
- The phase state (WorkspacePhase)
- The variables as a separate editable list

## What to KEEP / REUSE

- `applyVariablesToText()` for the preview
- `parseContractText()` as an OPTIONAL feature ("Sugestões IA" — AI Suggestions)
- `semantic-parser.service.ts` (already rewritten with open namespaces)
- Full-screen Dialog layout (`w-screen h-screen`)
- Header with a name field + save button
- Toast `import { toast } from "sonner"`

## Detailed implementation

### Central editor

- Resizable `<textarea>` with scrolling, mono font, free text
- Visually highlights {{placeholders}}: does not modify the base text — uses an overlay or applies the highlight function in the separate preview
- "Sugestões IA" button (discreet, collapsible): on click, calls `parseContractText()` and shows a popover with the suggestions — the user approves each one individually
- The text edited by the user is the source of truth — it is never changed automatically

### Variable library (right panel)

Predefined groups (expandable/collapsible):

| Group | Base variables |
|-------|---------------|
| "Envolvidos" (Parties) | PARTY_1.NAME, PARTY_1.CPF, PARTY_1.CNPJ, PARTY_1.RG, PARTY_1.ADDRESS, PARTY_1.EMAIL, PARTY_1.PHONE |
| "Financeiro" (Financial) | PAYMENT.AMOUNT, PAYMENT.CURRENCY, PAYMENT.METHOD, PAYMENT.DUE_DATE, PAYMENT.INSTALLMENTS, PAYMENT.FREQUENCY, PAYMENT.LATE_INTEREST, PAYMENT.FINE |
| "Contrato" (Contract) | CONTRACT.START_DATE, CONTRACT.END_DATE, CONTRACT.DURATION, CONTRACT.CITY, CONTRACT.STATE |
| "Obra" (Work) | WORK.TITLE, WORK.ISRC, WORK.ISWC, WORK.UPC |
| "Evento" (Event) | EVENT.NAME, EVENT.DATE, EVENT.LOCATION, EVENT.CACHE |

`[+]` button next to each variable → inserts `{{GRUPO.CAMPO}}` at the cursor position in the editor.

The search field filters variables from all groups.

"Customizadas" (Custom) section at the bottom: shows the variables created by the user.

### Custom variable creation

1. Input field: the user types `VIDEO.RESOLUTION`
2. The system validates that it has the `GRUPO.CAMPO` format (regex `^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+$`)
3. The system creates `{{VIDEO.RESOLUTION}}` and adds it to the "Customizadas" section
4. The variable becomes available for insertion like any other

### AI Suggestions (optional)

"✨ Sugestões IA" button in the header or in the editor:
1. Calls `parseContractText(currentText)` 
2. Shows a dropdown panel with the variables suggested by the AI
3. Each suggestion shows: original value + suggested placeholder + an "Aceitar" (Accept) button (which inserts the placeholder, replacing the text in the editor)
4. The user can ignore everything or accept selectively

### Save

- Filters the placeholders present in the final text: `text.match(/\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+\}\}/g)`
- Creates a manifest with the variables detected in the text
- Saves via `onSave(data: TemplateContratoInsert)`

## Files to modify

| File | Action |
|----------|-------|
| `contracts/components/ContractImportWorkspace.tsx` | Rewrite completely — free editor + variable library |
| `contracts/pages/TemplatesContratos.tsx` | No changes needed |
| `contracts/services/semantic-parser.service.ts` | No changes (already fixed in #64) |
| `contracts/types/contracts.types.ts` | No changes (already fixed in #64) |

## Done looks like

1. Open `/contratos/templates` → click "Novo Template" (New Template)
2. The full-screen workspace opens with an empty textarea and the side library
3. The user pastes a contract → the text appears in the editor
4. The user clicks `[+]` next to `{{PARTY_1.NAME}}` → placeholder inserted at the cursor
5. The user types `VIDEO.RESOLUTION` → clicks "Criar" (Create) → `{{VIDEO.RESOLUTION}}` available for insertion
6. Click "Guardar Template" (Save Template) → template saved, returns to the list
7. TypeScript: EXIT:0

## Constraints

- Toast: `import { toast } from "sonner"` (never shadcn useToast)
- No parallel tool calls (absolute rule)
- Keep compatibility with the `useTemplatesContratos` hook (data layer intact)