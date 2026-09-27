---
title: Free Contract Template Editor + Variable Registry System
---
---
title: Free Contract Template Editor + Variable Registry System
---

# Free Contract Template Editor + Variable Registry

## What this is

Complete refactor of the contract template module in 3 parts:

1. **Free editor** — professional textarea where the user writes/pastes contracts and inserts placeholders
2. **Variable Registry** — dedicated page for managing global variables with free-form aliases
3. **Optional AI** — discreet suggestions button; it does not control anything

---

## Part 1 — Rewrite `ContractImportWorkspace.tsx` as a free editor

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [←]  [Nome do template: ________________]   [✨ IA]   [Guardar]    │
├────────────────────────────────────────┬────────────────────────────┤
│                                        │  [🔍 Pesquisar...]         │
│  EDITOR LIVRE                          │                            │
│  ─────────────────────                 │  ▾ Envolvidos              │
│                                        │  {{PARTY.NAME}}      [+]   │
│  <textarea> de texto puro              │  {{PARTY.CPF}}       [+]   │
│  (write or paste any contract)         │  {{PARTY.EMAIL}}     [+]   │
│                                        │  ...                        │
│  {{placeholders}} são destacados       │  ▾ Financeiro              │
│  a azul no preview abaixo             │  {{PAYMENT.AMOUNT}}  [+]   │
│                                        │  {{PAYMENT.METHOD}}  [+]   │
│  ─────────────                         │  ...                        │
│  PREVIEW (só leitura)                  │  ▾ Contrato / Obra / Evento│
│  Texto com placeholders                │  ...                        │
│  coloridos/destacados                  │                            │
│                                        │  ── Minhas Variáveis ──    │
│                                        │  (do registry pessoal)     │
│                                        │  {{ARTISTA.NAME}}    [+]   │
│                                        │                            │
│                                        │  ──────────────────────    │
│                                        │  + Nova variável custom    │
│                                        │  [GRUPO.CAMPO]  [Criar]    │
└────────────────────────────────────────┴────────────────────────────┘
```

### Editor behavior

- Full-height `<textarea>`, font-mono, no mandatory structure
- The user edits the text directly — **never changed automatically**
- The `[+]` button next to each variable inserts `{{GRUPO.CAMPO}}` at the cursor position (via `selectionStart`/`selectionEnd`)
- Preview below the editor: uses `renderHighlighted(text)` — split by the regex `(\{\{[^}]+\}\})` and highlighted in blue (read-only)

### Default variables (right panel, always present)

```ts
const DEFAULT_VARIABLE_GROUPS = [
  {
    label: "Envolvidos",
    vars: [
      "PARTY.NAME", "PARTY.CPF", "PARTY.CNPJ", "PARTY.RG",
      "PARTY.EMAIL", "PARTY.PHONE", "PARTY.ADDRESS",
      "PARTY.NATIONALITY", "PARTY.MARITAL_STATUS",
      "PARTY.PROFESSION", "PARTY.ARTISTIC_NAME",
    ],
  },
  {
    label: "Financeiro",
    vars: [
      "PAYMENT.AMOUNT", "PAYMENT.CURRENCY", "PAYMENT.METHOD",
      "PAYMENT.DUE_DATE", "PAYMENT.DUE_DAY", "PAYMENT.INSTALLMENTS",
      "PAYMENT.DOWN_PAYMENT", "PAYMENT.FINAL_PAYMENT",
      "PAYMENT.RECURRENCE", "PAYMENT.LATE_INTEREST", "PAYMENT.FINE",
      "PAYMENT.ROYALTIES_PERCENTAGE", "PAYMENT.COMMISSION_PERCENTAGE",
    ],
  },
  {
    label: "Contrato",
    vars: [
      "CONTRACT.START_DATE", "CONTRACT.END_DATE", "CONTRACT.DURATION",
      "CONTRACT.RENEWAL", "CONTRACT.TERRITORY", "CONTRACT.JURISDICTION",
      "CONTRACT.CONFIDENTIALITY_PERIOD",
    ],
  },
  {
    label: "Obra",
    vars: ["WORK.TITLE", "WORK.ISRC", "WORK.ISWC", "WORK.UPC", "WORK.RELEASE_DATE"],
  },
  {
    label: "Evento",
    vars: ["EVENT.DATE", "EVENT.LOCATION", "EVENT.CACHE", "EVENT.HOSPITALITY", "EVENT.RIDER"],
  },
  {
    label: "Audiovisual",
    vars: ["VIDEO.RESOLUTION", "VIDEO.SCRIPT", "VIDEO.DELIVERY_DATE", "VIDEO.FORMAT"],
  },
];
```

### Variable search

- Search input at the top of the right panel
- Filters in real time: shows only variables that contain the searched text (case-insensitive)
- Searches the default groups + the variables in the personal registry

### Inline custom variable creation

- Input field: the user types `VIDEO.RESOLUTION`
- Validation regex: `/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+$/i` (accepts lowercase, normalizes to uppercase)
- "Criar" (Create) button → adds it to the registry (saved via the hook) + optionally inserts it at the cursor
- It appears in the "Minhas Variáveis" (My Variables) section in the panel

### "✨ IA" (AI) button (optional)

- In the header, a discreet button (variant="outline", size="sm")
- On click: calls `parseContractText(text)` with a loading spinner
- Result: shows a sheet/popover with a list of suggestions
- Each suggestion: `valor original` → `{{PLACEHOLDER.SUGERIDO}}` + an "Aceitar" (Accept) button + an "Ignorar" (Ignore) button
- "Aceitar" replaces **only that occurrence** in the textarea via string replace
- The user can close without accepting anything — it does not change the text automatically

### Save

```ts
const placeholders = [...new Set(text.match(/\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+\}\}/gi) ?? [])];
const manifest = { variables: placeholders, generatedAt: new Date().toISOString() };
onSave({ nome, tipo_servico: "semantico", conteudo: text, ativo: true,
         descricao: `${placeholders.length} variáveis`, variables_manifest: JSON.stringify(manifest) });
```

---

## Part 2 — Variable Registry (new page)

### New route: `/contratos/variaveis`

Add to `contracts.routes.tsx`:
```tsx
const VariableRegistry = lazy(() => import("@/modules/contracts/pages/VariableRegistry"));
<Route path="/contratos/variaveis" element={<P><VariableRegistry /></P>} />
```

### New file: `apps/web/src/modules/contracts/pages/VariableRegistry.tsx`

Simple page with:
- Header: "Variáveis de Template" / "Crie, organize e reutilize placeholders em qualquer contrato" (Template Variables / Create, organize and reuse placeholders in any contract)
- "Nova Variável" (New Variable) button → opens the creation modal
- Table with columns: **"Nome"** | **"Grupo"** | **"Campo"** | **"Placeholder"** | **"Acções"** (Name | Group | Field | Placeholder | Actions: copy, edit, delete)
- Empty state: "Nenhuma variável criada. Clique em 'Nova Variável' para começar." (No variables created. Click 'Nova Variável' to get started.)

### "Nova Variável" modal

3 fields:
1. **Friendly name** — e.g. "Nome do Artista" (free-form label)
2. **Group / Context** — e.g. "ARTISTA" (normalized to uppercase)
3. **Field** — e.g. "NAME" (normalized to uppercase)

Automatic preview: `{{ARTISTA.NAME}}`

Validation:
- Group: `/^[A-Z][A-Z0-9_]+$/` minimum 2 chars
- Field: `/^[A-Z][A-Z0-9_]+$/` minimum 2 chars

### Registry storage

New localStorage key: `musicos360_variable_registry`

Hook: `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`

```ts
interface RegistryVariable {
  id: string;
  name: string;       // "Nome do Artista"
  group: string;      // "ARTISTA"
  field: string;      // "NAME"
  placeholder: string; // "{{ARTISTA.NAME}}"
  createdAt: string;
}
```

The hook uses `useState` + `useEffect` with `localStorage` directly (it does not need `storage.ts` — these are user preferences, not business data).

### Navigation sidebar

Add "Variáveis" (Variables) as a link in the sidebar, under "Contratos" (Contracts), between Templates and whatever comes next.

File: `apps/web/src/shared/components/MainLayout.tsx` or wherever the sidebar links are.

---

## Files to create / modify

| File | Action |
|----------|-------|
| `contracts/components/ContractImportWorkspace.tsx` | Rewrite completely (free editor) |
| `contracts/pages/VariableRegistry.tsx` | Create (new page) |
| `contracts/hooks/useVariableRegistry.ts` | Create (localStorage hook) |
| `contracts/routes/contracts.routes.tsx` | Add the `/contratos/variaveis` route |
| Sidebar/MainLayout | Add the "Variáveis" link |

Do not modify: `semantic-parser.service.ts`, `contracts.types.ts`, `useTemplatesContratos.ts`, `TemplatesContratos.tsx`

---

## Done looks like

1. `/contratos/templates` → list of templates + "Novo Template" (New Template) button
2. Click "Novo Template" → full-screen editor with a textarea + variables panel
3. Paste text → it appears in the editor; placeholders already in the text are highlighted in the preview
4. Click `[+]` on `{{PAYMENT.AMOUNT}}` → inserted at the textarea cursor
5. Search "ARTISTA" → filters the variables in the personal registry
6. Create the custom variable `SHOW.RIDER` → it appears in "Minhas Variáveis"
7. "✨ IA" button → shows suggestions, the user decides on each one individually
8. Save → template in the list
9. `/contratos/variaveis` → variables table with create/edit/delete
10. TypeScript: EXIT:0

---

## Constraints

- Toast: `import { toast } from "sonner"` — NEVER shadcn useToast
- No parallel tool calls (the user's absolute rule)
- Groups are NOT limited — any valid string is accepted
- The AI NEVER changes the text automatically — it only suggests
- The editor text is always the source of truth