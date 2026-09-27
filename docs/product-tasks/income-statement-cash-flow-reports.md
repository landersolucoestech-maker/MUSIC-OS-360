# Income Statement (DRE) and Cash Flow — Professional Financial Reports

## What & Why
The current Accounting page shows only global KPIs (total revenue, expenses, balance) and a monthly evolution chart. There is no income statement (DRE) structured by category, nor a cash flow with projection. For a record label/production company, the income statement per project/artist and the cash flow with future due dates are the two most critical operational reports. This task replaces the simple view with ERP-level financial reports.

## Done looks like
- **DRE tab** on the Accounting page: hierarchical table grouped by type → category → subcategory with subtotals and totals. Filterable by period (month/quarter/year), cost center and artist. Exportable as XLSX (this repository is XLSX-only — `scripts/verify-xlsx-only.mjs`).
- **"Fluxo de Caixa" (Cash Flow) tab**: chronological list of transactions by due date (future ones) and payment date (past ones), with a running balance computed row by row. Visually distinguishes "pago", "a vencer", "atrasado" (paid, upcoming, overdue).
- **P&L per Project**: a table that lists projects as rows, with revenue, expenses and net result per project — using the transactions' `projeto_id` field.
- **P&L per Artist**: the same logic but grouped by artist.
- The Accounting page gains tabs: "Visão Geral" (Overview — current), "DRE", "Fluxo de Caixa", "Por Projecto" (By Project), "Por Artista" (By Artist).
- Each tab has a period selector and an XLSX export button.

## Out of scope
- Integration with an external accounting system (SPED, ECD — future integration)
- AI projection charts
- Multi-company/multi-tenant consolidation
- Report PDF with a formatted layout (XLSX only for now)

## Steps
1. **Aggregation utilities** — create `apps/web/src/modules/accounting/utils/financial-reports.ts` with pure functions: `groupByCategory()`, `buildDRE()`, `buildCashFlow()`, `groupByProject()`, `groupByArtist()` — they receive an array of transactions and return typed structures for the tables
2. **DRE tab** — `DREReport.tsx` component with a collapsible hierarchical table: type row (Revenue/Expense/Investment/Tax), category sub-rows, subcategory sub-sub-rows, amounts and percentages; filters by period and cost center
3. **Cash Flow tab** — `CashFlowReport.tsx` component: chronological list using `data_vencimento` (for future ones) and `data` (for past ones), running balance, color coding by status; filter by financial account
4. **P&L per Project and per Artist** — `PLByProject.tsx` and `PLByArtist.tsx` components: simple tables with rows per entity and columns Revenue / Expenses / Result / Margin %
5. **Tabs on the Accounting page** — replace the current layout with a TabsList with 5 tabs; move the current content to "Visão Geral"; mount the 4 new tabs with the created components
6. **XLSX export** — reuse the existing `exportToXlsx()` in `shared/lib/xlsx.ts` (the repository is XLSX-only) to convert an array of objects into a download; a button on each report tab

## Relevant files
- `apps/web/src/modules/accounting/pages/Contabilidade.tsx`
- `apps/web/src/modules/accounting/utils/`
- `apps/web/src/modules/accounting/hooks/useTransacoes.ts`
- `apps/web/src/shared/lib/storage.ts`
