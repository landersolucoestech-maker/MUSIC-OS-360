---
title: Variable Registry — Import / Export
---
# Variable Registry — Import / Export

## What & Why
The Variable Registry (`/contratos/variaveis`) lets users manage template placeholders.
Adding import/export lets users back up their variable library, share it across accounts/tenants,
and seed a fresh environment without recreating every variable by hand.

## Done looks like
- **Export** button in the PageHeader actions area (download icon):
  - Downloads a JSON file named `variaveis-template-YYYY-MM-DD.json`
  - File contains the full array of RegistryVariable objects (same shape as localStorage)
  - Toast: "X variáveis exportadas"
- **Import** button in the PageHeader actions area (upload icon):
  - Opens a hidden `<input type="file" accept=".json">` via click
  - Reads the file, validates it is a JSON array of objects with at least `group`, `field`, `placeholder` fields
  - On valid file: shows a confirmation dialog listing how many variables will be added (merges, no duplicates by placeholder)
  - On invalid file: toast error "Ficheiro inválido — verifique o formato"
  - After confirm: merges imported variables into localStorage (existing variables kept, duplicate placeholders skipped)
  - Toast: "X variáveis importadas (Y já existiam)"
- Both buttons visible even when list is empty (so user can import into a fresh registry)
- TypeScript: EXIT:0

## Out of scope
- Delimited spreadsheet import/export format (JSON only — this repository is XLSX-only for actual spreadsheets, scripts/verify-xlsx-only.mjs)
- Server-side backup or sync
- Conflict resolution beyond "skip duplicates by placeholder"

## Steps
1. **Export function** — in `VariableRegistry.tsx`, add `handleExport` that serializes the variables array to JSON and triggers a browser download via `URL.createObjectURL` + anchor click
2. **Import UI** — add hidden file input ref, `handleImport` that reads the file with `FileReader`, validates structure, shows a confirmation Dialog with summary counts, and on confirm calls `importVariables` on the hook
3. **Hook: importVariables** — add `importVariables(incoming: RegistryVariable[])` to `useVariableRegistry.ts` that merges: keeps existing, adds incoming where `placeholder` not already present, regenerates `id` and `createdAt` for imported items
4. **PageHeader wiring** — use the existing `actions.import` / `actions.export` / `actions.onImport` / `actions.onExport` props already available on PageHeader; both buttons always shown

## Relevant files
- `apps/web/src/modules/contracts/pages/VariableRegistry.tsx`
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/shared/components/PageHeader.tsx`