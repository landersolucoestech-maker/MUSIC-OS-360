# DRE e Fluxo de Caixa — Relatórios Financeiros Profissionais

## What & Why
A página de Contabilidade actual mostra apenas KPIs globais (total receitas, despesas, saldo) e um gráfico de evolução mensal. Não há DRE estruturado por categoria, nem fluxo de caixa com projecção. Para uma gravadora/produtora, o DRE por projecto/artista e o fluxo de caixa com vencimentos futuros são os dois relatórios operacionais mais críticos. Esta task substitui a visualização simples por relatórios financeiros de nível ERP.

## Done looks like
- **DRE tab** na página Contabilidade: tabela hierárquica agrupada por tipo → categoria → subcategoria com subtotais e totais. Filtrável por período (mês/trimestre/ano), centro de custo e artista. Exportável como XLSX (este repositório é XLSX-only — `scripts/verify-xlsx-only.mjs`).
- **Fluxo de Caixa tab**: lista cronológica de transações por data de vencimento (futuros) e data de pagamento (passados), com saldo acumulado calculado linha a linha. Distingue visualmente "pago", "a vencer", "atrasado".
- **P&L por Projecto**: tabela que lista projectos como linhas, com receitas, despesas e resultado líquido por projecto — usando o campo `projeto_id` das transações.
- **P&L por Artista**: mesma lógica mas agrupado por artista.
- A página Contabilidade ganha tabs: "Visão Geral" (actual), "DRE", "Fluxo de Caixa", "Por Projecto", "Por Artista".
- Cada tab tem selector de período e botão de exportar XLSX.

## Out of scope
- Integração com sistema contábil externo (SPED, ECD — futura integração)
- Gráficos de projecção com IA
- Consolidação multi-empresa/multi-tenant
- PDF de relatório com layout formatado (apenas XLSX por agora)

## Steps
1. **Utilitários de agregação** — criar `apps/web/src/modules/accounting/utils/financial-reports.ts` com funções puras: `groupByCategory()`, `buildDRE()`, `buildCashFlow()`, `groupByProject()`, `groupByArtist()` — recebem array de transações e retornam estruturas tipadas para as tabelas
2. **DRE tab** — componente `DREReport.tsx` com tabela hierárquica colapsável: linha de tipo (Receita/Despesa/Investimento/Imposto), sub-linhas de categoria, sub-sub-linhas de subcategoria, valores e percentagens; filtros por período e centro de custo
3. **Fluxo de Caixa tab** — componente `CashFlowReport.tsx`: lista cronológica usando `data_vencimento` (para futuros) e `data` (para passados), saldo acumulado, código de cor por status; filtro por conta financeira
4. **P&L por Projecto e por Artista** — componentes `PLByProject.tsx` e `PLByArtist.tsx`: tabelas simples com linhas por entidade e colunas Receitas / Despesas / Resultado / Margem %
5. **Tabs na página Contabilidade** — substituir layout actual por TabsList com 5 tabs; mover conteúdo actual para "Visão Geral"; montar os 4 novos tabs com os componentes criados
6. **Export XLSX** — reutilizar `exportToXlsx()` já existente em `shared/lib/xlsx.ts` (repositório é XLSX-only) para converter array de objectos para download; botão em cada tab de relatório

## Relevant files
- `apps/web/src/modules/accounting/pages/Contabilidade.tsx`
- `apps/web/src/modules/accounting/utils/`
- `apps/web/src/modules/accounting/hooks/useTransacoes.ts`
- `apps/web/src/shared/lib/storage.ts`
