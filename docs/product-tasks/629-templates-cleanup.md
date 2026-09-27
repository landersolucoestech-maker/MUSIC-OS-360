# Task #629 — Clean up the Templates page: remove the second tab + signer roles

## Context
The `/contratos/templates` page has two tabs ("Templates Simples" and "Templates com Variáveis")
because the two systems coexisted during task #624. Since task #627 the digital signature
wizard has been eliminated — the "Templates com Variáveis" tab (contracts-v2) no longer serves any purpose.

The "papel" (role) field on signers (contract form + templates) has roles that the user wants removed.

## Changes

### 1. TemplatesContratos.tsx — eliminate tabs
- Remove `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` from the page root
- Remove the `TabTemplatesVariaveis` function and all of its logic (useDocumentTemplates, NewTemplateFormV2, TemplateCardV2)
- The page now renders the content of `TabTemplatesSimples` directly (without a tab wrapper)
- Remove imports that end up unused: `useDocumentTemplates`, `useCreateTemplate`, `TEMPLATE_CATEGORY_LABEL`,
  `SIGNER_ROLE_LABEL` (contracts-v2), `TemplateCategory`, `SignerRole`, `createTemplateSchema`,
  `CreateTemplateInput`, `Tabs/*`, `Layers`, `Save`, `Trash2`, `Form/*`, `Textarea`, `toast`
- Remove the local `SIGNER_ROLE_OPTIONS` and `CATEGORY_OPTIONS` (only used in the removed tab)

### 2. contrato-schema.ts — remove roles
Remove from `SIGNER_ROLES`, `SIGNER_ROLE_LABEL` and the derived type:
- `testemunha`
- `procurador`
- `advogado`

Result: only `["artista", "label", "produtor"]`

### 3. contracts-v2/types/index.ts — synchronize SignerRole
Remove `"testemunha"`, `"procurador"`, `"advogado"` from the `SignerRole` union type
(keeps: `"artista" | "label" | "produtor"`)

### 4. contracts-v2/types/index.ts — SIGNER_ROLE_LABEL
Check whether a `SIGNER_ROLE_LABEL` is exported from this file and, if so,
remove the entries for the removed roles.

### 5. Validation
- `cd client && npx tsc --noEmit` → 0 errors

## Affected files
- `client/src/modules/contracts/pages/TemplatesContratos.tsx`
- `client/src/modules/contracts/lib/contrato-schema.ts`
- `client/src/modules/contracts-v2/types/index.ts`

## Done when
- `/contratos/templates` shows only a single list of templates, without tabs
- The "papel" (role) field on the contract form only offers: "Artista", "Gravadora / Label", "Produtor"
- tsc → 0 errors
