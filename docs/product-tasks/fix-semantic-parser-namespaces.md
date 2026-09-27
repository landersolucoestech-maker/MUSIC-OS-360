---
title: Improve variable detection in the Contract Intelligence Engine — namespaces and validation
---
# Improve variable detection in the Contract Intelligence Engine

## What & Why

The AI is missing variables for parties involved in the contract (e.g. `AUTOR`, `COMPOSITOR`,
`EDITORA`, `CEDENTE`, `CESSIONÁRIO` — author, composer, publisher, assignor, assignee) because:

1. **Insufficient namespaces in the system prompt** — only CONTRATANTE/CONTRATADO exist,
   but music contracts have AUTOR, COMPOSITOR, EDITORA, CEDENTE, CESSIONARIO, etc.
2. **Destructive rule in the system prompt** — "se não conseguir determinar o namespace correto, omita a variável"
   (if you cannot determine the correct namespace, omit the variable) → the AI discards instead of approximating
3. **Rigid validation in the frontend** — `validatePlaceholder()` in
   `semantic-parser.service.ts:87-91` silently rejects any namespace
   outside the hardcoded list — variables that the AI detects correctly are filtered out

## Done looks like

- The AI detects the data of ALL parties involved in a contract (publisher, author,
  composer, assignor, assignee, etc.)
- No valid variable is discarded because of an unknown namespace
- The frontend accepts any namespace in the `{{NAMESPACE.CAMPO}}` format
  (structural regex) without a closed list
- TypeScript EXIT:0

## Steps

1. **Expand the namespaces in the system prompt** — add to SYSTEM_PROMPT:
   `AUTOR, COMPOSITOR, EDITORA, CEDENTE, CESSIONARIO, INTERPRETE, GRAVADORA,
   MUSICO, AGENCIA, REPRESENTANTE, LICENCIANTE, LICENCIADO, PARTE_A, PARTE_B`
   and update the placeholder examples to cover assignment ("cessão") contracts

2. **Remove the "omit" rule** — replace the last line of the system prompt:
   - BEFORE: "se não conseguir determinar o namespace correto, omita a variável"
   - AFTER: "se não conseguir determinar o namespace correto, use PARTE_A ou PARTE_B" (if you cannot determine the correct namespace, use PARTE_A or PARTE_B)

3. **Relax the namespace validation in the frontend** — in `validatePlaceholder()`:
   - BEFORE: check `ALLOWED_NAMESPACES.has(namespace)`
   - AFTER: only check the structural format `{{NAMESPACE.CAMPO}}` with the regex
     `/^\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\}\}$/`
   - Remove the `ALLOWED_NAMESPACES` constant (no longer needed)

4. **Update `ALLOWED_NAMESPACES` in `semantic-parser.service.ts`** — if the
   constant is still used for UI/labels, expand it with the new namespaces;
   otherwise, remove it

5. **TypeCheck**: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`

## Relevant files

- `apps/web/src/modules/contracts/services/semantic-parser.service.ts`
  - lines 7-61: SYSTEM_PROMPT
  - lines 81-91: ALLOWED_NAMESPACES + validatePlaceholder
  - lines 93-108: tryNormalizeVariable (uses validatePlaceholder)
