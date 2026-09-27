---
title: Remove the Reconciliation, Cash Flow and Reports pages
---
# Remove Finance pages

## What & Why
Remove the "Conciliação" (Reconciliation), "Fluxo de Caixa" (Cash Flow) and "Relatórios" (Reports) pages from the Finance module (accounting), eliminating the corresponding routes, navigation links and page files.

## Done looks like
- The routes `/accounting/conciliacao`, `/accounting/fluxo` and `/accounting/relatorios` no longer exist
- The links to those pages have been removed from the sidebar
- The page files have been deleted
- The rest of the module (Transactions, Accounting, Invoice — "Nota Fiscal") works normally

## Out of scope
- Changes to any other section of the Finance module
- Removal of related mock data

## Steps
1. **Remove routes** — Delete the 3 `<Route>`s from `accounting.routes.tsx` and the 3 corresponding lazy imports
2. **Remove nav links** — Remove the "Conciliação", "Fluxo de Caixa" and "Relatórios" items from `AppSidebar.tsx`
3. **Delete page files** — Remove `FluxoCaixa.tsx`, `Conciliacao.tsx` and `RelatoriosFinanceiros.tsx`

## Relevant files
- `client/src/app/routes/accounting.routes.tsx`
- `client/src/shared/components/layout/AppSidebar.tsx`
- `client/src/modules/accounting/pages/FluxoCaixa.tsx`
- `client/src/modules/accounting/pages/Conciliacao.tsx`
- `client/src/modules/accounting/pages/RelatoriosFinanceiros.tsx`