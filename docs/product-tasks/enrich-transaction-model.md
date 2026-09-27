# Enrich the Transaction Model — Complete Financial Fields

## What & Why
The current `transacoes` table has only `valor` (a single number), with no distinction between gross amount, discounts, taxes and net amount. It also has no currency, no due date separate from the payment date, and no fields for recurrence. This prevents correct financial calculations such as gross-to-net, tax assessment per transaction, and control of contractual recurrences. This task enriches the model without breaking existing data (all new fields are nullable).

## Done looks like
- The `transacoes` mock data receives the new optional fields: `valor_bruto`, `desconto`, `impostos_valor`, `valor_liquido`, `moeda` (default `BRL`), `data_vencimento`, `data_pagamento`, `numero_documento`, `recorrente` (boolean), `recorrencia_tipo` (`mensal`/`trimestral`/`anual`), `recorrencia_fim`
- The transaction form displays new fields in the "Pagamento" (Payment) section: Gross Amount, Discount (%), Taxes (amount), and automatically computes Net Amount = Gross – Discount – Taxes
- A "Data de Vencimento" (Due Date) field appears in the form (previously there was only the Transaction Date)
- A "Transação Recorrente" (Recurring Transaction) toggle opens frequency and end date fields
- The transactions table on the `/accounting` page shows a "Valor Líquido" (Net Amount) column instead of "Valor" (Amount) when there is a distinction; visual indicator for recurring transactions
- All historical data in localStorage keeps working (the new fields fall back to `valor` if `valor_liquido` does not exist)
- Backend entity `TransactionEntity` updated with the new typed fields

## Out of scope
- Automatic generation of recurring transactions (cron job — future task)
- Foreign currencies with automatic exchange (BRL only in the current phase)
- OFX bank integration with reconciliation of `data_pagamento` (future task)

## Steps
1. **Mock data** — add the new fields to all seed transactions in `buildSeedData()`; patch in `patchMockData()` that fills in `valor_liquido = valor` for transactions without the field
2. **TypeScript types** — update `Transacao` in `accounting.types.ts` with the new optional fields
3. **Form — amounts section** — create a "Decomposição do Valor" (Amount Breakdown) sub-section in `PaymentSection` with Gross Amount, Discount %, Taxes, and a reactively computed Net Amount; the existing `valor` field becomes an alias of `valor_liquido` for compatibility
4. **Form — recurrence** — add a "Recorrente" (Recurring) toggle that opens frequency and end date selects; this data is saved but does not generate transactions automatically yet
5. **Transactions table** — show `valor_liquido` (or fall back to `valor`) in the amount column; add a recurrence icon; add an optionally visible "Vencimento" (Due) column
6. **Backend entity** — update `TransactionEntity` with all the new `@Column({ nullable: true })` fields; update `transacao.validator.ts` to accept the new optional fields

## Relevant files
- `apps/web/src/modules/accounting/types/accounting.types.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/PaymentSection.tsx`
- `apps/web/src/modules/accounting/pages/Financeiro.tsx`
- `apps/web/src/shared/data/mockData.ts`
- `apps/api/src/modules/transactions/entities/transaction.entity.ts`
- `apps/api/src/modules/transactions/validators/transacao.validator.ts`
