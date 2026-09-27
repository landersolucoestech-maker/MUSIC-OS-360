# Centros de Custo e Contas Financeiras

## What & Why
Actualmente todas as transações existem "no ar" sem vinculação a uma conta bancária de origem/destino nem a um centro de custo que permita DRE por projecto, artista ou campanha. Sem estes dois pilares, não é possível gerar relatórios financeiros profissionais — apenas somas globais. Esta task introduz as duas entidades estruturais que tornam o sistema num ERP real.

## Done looks like
- **Centros de custo**: nova tabela `centros_custo` com CRUD no Settings ou numa sub-tab de `/accounting/rules`. Campos: nome, código, tipo (projecto/artista/campanha/geral), responsável, ativo. 5 registos seed incluídos.
- **Contas financeiras**: nova tabela `contas_financeiras`. Campos: nome, banco, agência, conta, tipo (corrente/poupança/caixa/virtual), moeda (BRL), saldo_inicial, ativo. 3 registos seed (Conta Principal, Caixa, Conta Poupança).
- **Formulário de transação** ganha dois campos novos opcionais: "Centro de Custo" e "Conta Financeira" — selects com autocomplete a partir das tabelas criadas.
- **Tabela `transacoes`** no mock data recebe `centro_custo_id` e `conta_financeira_id` como campos opcionais (nullable); dados históricos não quebram.
- **Página de Contabilidade** mostra novo filtro por Centro de Custo que filtra os KPIs e o gráfico de evolução.

## Out of scope
- Transferências entre contas (conciliação bancária — futura task)
- Saldo calculado automaticamente por conta (fase posterior)
- OFX import vinculado a conta específica (futura task)
- DRE completo por centro de custo (task separada de relatórios)

## Steps
1. **Mock data** — adicionar `centros_custo` e `contas_financeiras` a `buildSeedData()` + patch em `patchMockData()`; adicionar campos `centro_custo_id` e `conta_financeira_id` (nullable) às transações seed existentes
2. **Service methods** — adicionar CRUD de centros de custo e contas financeiras ao `accounting.service.ts`
3. **Hooks** — criar `useCentrosCusto.ts` e `useContasFinanceiras.ts` com React Query
4. **CRUD na página Rules** — adicionar tabs "Centros de Custo" e "Contas Financeiras" à página `/accounting/rules` com tabelas + modais de criar/editar
5. **Formulário de transação** — adicionar selects de Centro de Custo e Conta Financeira na secção de detalhes do form (após categoria, antes de observações); ambos opcionais
6. **Filtro na página Contabilidade** — adicionar filtro por Centro de Custo ao header de filtros da página de P&L; filtrar KPIs e gráfico pelo centro seleccionado

## Relevant files
- `apps/web/src/modules/accounting/pages/TransacaoRules.tsx`
- `apps/web/src/modules/accounting/pages/Contabilidade.tsx`
- `apps/web/src/modules/accounting/services/accounting.service.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/CategorySection.tsx`
- `apps/web/src/shared/data/mockData.ts`
