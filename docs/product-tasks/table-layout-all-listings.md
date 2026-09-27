# Table with headers on all listings

## What & Why
The "Todas as Licenças" (All Licenses) card (Licenciamento.tsx) uses the shadcn `<Table>` component with `<TableHeader>` and a `<TableHead>` for each column, creating visible labels above the data. All the other listing pages in the project use custom layouts (card/row) without column labels. The goal is to standardize ALL listings on the same formal table model — visual consistency and clarity so the user knows what they are looking at in each column.

## Done looks like
- All the pages listed below show a header row with the name of each column, the same as the "Todas as Licenças" card
- The existing data stays the same — only the visual structure changes (custom rows → Table with TableHeader)
- The per-row actions (buttons, dropdowns) remain in the last column, "Ações" (Actions)
- EmptyState keeps working when there is no data
- The filters/search above the table remain intact
- Artistas.tsx stays UNCHANGED

## Out of scope
- Artistas.tsx — explicitly excluded by the user
- Pages that already use Table: Licenciamento.tsx (reference), Takedowns.tsx, GestaoShares.tsx, ExecucoesTable.tsx, NotaFiscal.tsx
- Changes to data, hooks, mappers or business logic
- Pagination or per-column sorting (sort) — not requested
- Internal modals (ViewModal, FormModal) — only the listing pages

## Steps
1. **Contracts + TemplatesContratos** — Convert `Contratos.tsx` and `TemplatesContratos.tsx` to Table with columns (e.g. Name, Artist, Type, Status, Validity, Actions); keep the status badges and the actions dropdown
2. **CRM** — Convert `CRM.tsx` to Table with columns suitable for leads/contacts (e.g. Name, Company, Type, Status, Last Contact, Actions)
3. **Marketing (Campaigns + Tasks + Briefing)** — Convert `Campanhas.tsx`, `Tarefas.tsx` and `Briefing.tsx` to Table with the relevant columns for each entity; keep the status/priority badges
4. **Monitoring** — Convert `Monitoramento.tsx` to Table with columns (e.g. Title, Platform, Detections, Status, Actions); Takedowns.tsx already uses Table, do not change it
5. **Projects** — Convert `Projetos.tsx` to Table with columns (e.g. Name, Artist, Status, Date, Actions); it currently uses a card grid
6. **Releases** — Convert `Lancamentos.tsx` to Table with columns (e.g. Title, Artist, Type, Status, Release Date, Actions); keep the grid/list toggle but make the list view use Table
7. **HR** — Convert `RH.tsx` to Table in the Employees, Payroll and Vacations/Leaves tabs
8. **Inventory** — Convert `Inventario.tsx` to Table with columns (e.g. Name, Category, Condition, Location, Value, Actions)
9. **Accounting (Finance + Accounting)** — Convert `Financeiro.tsx` (transactions) and `Contabilidade.tsx` to Table with the relevant columns; NotaFiscal.tsx already uses DataTable, do not change it
10. **Settings/Users + Support** — Convert `Usuarios.tsx` / `Configuracoes.tsx` and `SupportTickets.tsx` to Table with suitable columns

## Relevant files
- `client/src/modules/licensing/pages/Licenciamento.tsx` — reference for the Table pattern to follow
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/pages/TemplatesContratos.tsx`
- `client/src/modules/crm/pages/CRM.tsx`
- `client/src/modules/marketing/pages/Campanhas.tsx`
- `client/src/modules/marketing/pages/Tarefas.tsx`
- `client/src/modules/marketing/pages/Briefing.tsx`
- `client/src/modules/monitoring/pages/Monitoramento.tsx`
- `client/src/modules/projects/pages/Projetos.tsx`
- `client/src/modules/releases/pages/Lancamentos.tsx`
- `client/src/modules/rh/pages/RH.tsx`
- `client/src/modules/inventory/pages/Inventario.tsx`
- `client/src/modules/accounting/pages/Financeiro.tsx`
- `client/src/modules/accounting/pages/Contabilidade.tsx`
- `client/src/modules/settings/pages/Usuarios.tsx`
- `client/src/modules/support/pages/SupportTickets.tsx`
- `client/src/shared/ui/table.tsx`
