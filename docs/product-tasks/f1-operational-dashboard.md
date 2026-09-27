# Dashboard Operacional da Gravadora

## What & Why
Criar uma visão operacional que substitua (ou coexista com) o dashboard atual, focada no que a equipe da gravadora precisa ver todos os dias: pipeline de lançamentos, contratos prestes a vencer, artistas em onboarding aguardando revisão, e tarefas operacionais pendentes. É a "homepage operacional" do sistema.

## Done looks like
- Nova rota `/operacional` (ou o Dashboard atual é expandido com aba "Operacional") com layout de painel
- **Seção Pipeline de Lançamentos**: próximos 5 lançamentos ordenados por data, com status, artista, checklist de assets incompletos — cada item é clicável (abre modal do lançamento)
- **Seção Contratos Críticos**: contratos expirando em 30 dias ou aguardando assinatura, com link para abrir o contrato
- **Seção Onboarding Pendente**: artistas com status `onboarding`, com data de entrada, nome artístico e botão "Revisar" (abre modal de edição do artista)
- **Seção Catálogo — Obras Pendentes**: obras com status `pendente` ou `analise` no catálogo, com artista e data
- **KPIs globais no topo**: total de artistas ativos, lançamentos este mês, contratos ativos, receita do mês (do Financeiro)
- **Notificações inline**: se houver contratos vencidos, onboarding há mais de 7 dias sem ação, ou releases com assets incompletos faltando menos de 14 dias — aparece alerta vermelho/amarelo no card correspondente
- Cada seção tem botão "Ver todos" que navega para o módulo respectivo

## Out of scope
- Tarefas atribuídas a usuários específicos (sistema de tasks individuais é futuro)
- Métricas de streaming em tempo real
- Relatórios exportáveis nesta fase
- Notificações push/email

## Steps
1. **Rota e layout** — Criar página `/operacional` com MainLayout, grid responsivo de 2 colunas em desktop, 1 em mobile; registrar rota no app
2. **KPIs globais** — 4 MetricCards no topo consumindo dados dos hooks existentes (useArtistas, useLancamentos, useContratos, useMetrics)
3. **Pipeline de Lançamentos** — Widget com próximos 5 lançamentos por `data_lancamento` ASC, card com nome, artista, status badge, barra de progresso de assets e dias restantes
4. **Contratos Críticos** — Widget filtrando contratos com `data_fim` nos próximos 30 dias ou `status === "aguardando_assinatura"`; card com nome, artista, data e badge de urgência
5. **Onboarding Pendente** — Widget filtrando artistas com `status === "onboarding"`, exibindo nome artístico, gênero, data de cadastro e botão "Revisar"
6. **Catálogo Pendente** — Widget filtrando obras com `status === "pendente" || "analise"`, mostrando título, artista, tipo
7. **Alertas contextuais** — Lógica de notificação inline nos widgets (borda vermelha/amarela quando urgente, ícone de alerta) para contratos vencidos e lançamentos com assets incompletos

## Relevant files
- `client/src/app/routes/`
- `client/src/shared/hooks/useMetrics.ts`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/modules/releases/hooks/useLancamentos.ts`
- `client/src/modules/contracts/hooks/useContratos.ts`
- `client/src/modules/catalog/hooks/useObras.ts`
- `client/src/shared/components/MetricCard.tsx`
- `client/src/shared/components/MainLayout.tsx`
