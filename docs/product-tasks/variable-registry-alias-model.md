# Variable Registry — Alias + Internal Naming + Pre-seeds

## What & Why
The specification defines that a template variable has two axes:

1. **Visual/Legal Alias** (left field) — the name that appears in the contract and in the placeholder: `ARTISTA`, `GRAVADORA`, `LICENCIANTE`. It is the placeholder prefix: `{{ARTISTA.CPF}}`.
2. **Internal/Technical Naming** (right field) — internal logical organization: `artist`, `label`, `licensor`. It does not appear in the placeholder; it is used for search, grouping and internal documentation.

The current registry uses "Grupo / Contexto" (Group / Context) for what is conceptually the Alias, and it does not have the internal naming field. In addition, the user needs to see already-created examples to understand the pattern before creating their own variables.

## Done looks like
- "Nova Variável" (New Variable) form with two renamed fields:
  - Left field: **"Alias Visual / Jurídico"** (Visual / Legal Alias) (placeholder: "ARTISTA") — normalized to UPPERCASE
  - Right field (new): **"Nomenclatura Interna"** (Internal Naming) (placeholder: "artist") — saved but it does not appear in the generated placeholder
  - Existing field: **"Campo"** (Field) (placeholder: "NAME") — kept the same
- The automatic preview shows `{{ALIAS.CAMPO}}` (as before, but conceptually correct)
- The table shows an extra "Nomenclatura Interna" column (if filled in)
- When `/contratos/variaveis` is opened for the first time (empty localStorage), ~10 example variables are loaded automatically:
  - ARTISTA.NAME, ARTISTA.CPF, ARTISTA.EMAIL, ARTISTA.CNPJ (internalGroup: artist)
  - GRAVADORA.NAME, GRAVADORA.CNPJ (internalGroup: label)
  - LICENCIANTE.NAME, LICENCIANTE.CPF (internalGroup: licensor)
  - CONTRATANTE.NAME, CONTRATANTE.CPF (internalGroup: contractor)
- Creating, editing and deleting variables works just as before
- TypeScript: EXIT:0

## Out of scope
- Using `internalGroup` for automatic filtering in the template editor (future)
- Migrating the editor's DEFAULT_VARIABLE_GROUPS variables to use this model
- Backend persistence (localStorage only, by design)

## Steps
1. **Update the `RegistryVariable` interface** — add an optional `internalGroup?: string` field to the type in `useVariableRegistry.ts`
2. **Add pre-seeds** — when the hook loads and localStorage is empty, populate it with the ~10 examples above (ARTISTA, GRAVADORA, LICENCIANTE, CONTRATANTE with the NAME, CPF, EMAIL, CNPJ fields as applicable)
3. **Update the modal form** — rename "Grupo / Contexto" → "Alias Visual / Jurídico", add a "Nomenclatura Interna" field (optional, does not affect the placeholder), update the `addVariable`/`updateVariable` logic to persist `internalGroup`
4. **Update the table** — add a "Nomenclatura Interna" column between "Grupo/Alias" and "Campo"; show the value or a dash if empty

## Relevant files
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/contracts/pages/VariableRegistry.tsx`
