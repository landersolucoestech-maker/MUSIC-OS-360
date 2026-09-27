# Cost Centers and Financial Accounts

## What & Why
Currently all transactions exist "in the air", with no link to a source/destination bank account nor to a cost center that would allow an income statement (DRE) per project, artist or campaign. Without these two pillars, it is not possible to generate professional financial reports — only global sums. This task introduces the two structural entities that turn the system into a real ERP.

## Done looks like
- **Cost centers**: new `centros_custo` table with CRUD in Settings or in a sub-tab of `/accounting/rules`. Fields: name, code, type (project/artist/campaign/general), person in charge, active. 5 seed records included.
- **Financial accounts**: new `contas_financeiras` table. Fields: name, bank, branch, account, type (checking/savings/cash/virtual), currency (BRL), saldo_inicial (opening balance), active. 3 seed records ("Conta Principal", "Caixa", "Conta Poupança" — Main Account, Cash, Savings Account).
- **Transaction form** gains two new optional fields: "Centro de Custo" (Cost Center) and "Conta Financeira" (Financial Account) — selects with autocomplete from the created tables.
- **`transacoes` table** in the mock data receives `centro_custo_id` and `conta_financeira_id` as optional (nullable) fields; historical data does not break.
- **Accounting page** shows a new Cost Center filter that filters the KPIs and the evolution chart.

## Out of scope
- Transfers between accounts (bank reconciliation — future task)
- Balance calculated automatically per account (later phase)
- OFX import linked to a specific account (future task)
- Full income statement per cost center (separate reports task)

## Steps
1. **Mock data** — add `centros_custo` and `contas_financeiras` to `buildSeedData()` + patch in `patchMockData()`; add the `centro_custo_id` and `conta_financeira_id` fields (nullable) to the existing seed transactions
2. **Service methods** — add CRUD for cost centers and financial accounts to `accounting.service.ts`
3. **Hooks** — create `useCentrosCusto.ts` and `useContasFinanceiras.ts` with React Query
4. **CRUD on the Rules page** — add "Centros de Custo" and "Contas Financeiras" tabs to the `/accounting/rules` page with tables + create/edit modals
5. **Transaction form** — add Cost Center and Financial Account selects in the details section of the form (after category, before notes); both optional
6. **Filter on the Accounting page** — add a Cost Center filter to the filter header of the P&L page; filter KPIs and the chart by the selected center

## Relevant files
- `apps/web/src/modules/accounting/pages/TransacaoRules.tsx`
- `apps/web/src/modules/accounting/pages/Contabilidade.tsx`
- `apps/web/src/modules/accounting/services/accounting.service.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/CategorySection.tsx`
- `apps/web/src/shared/data/mockData.ts`
