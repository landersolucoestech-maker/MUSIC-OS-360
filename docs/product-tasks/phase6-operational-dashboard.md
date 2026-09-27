# FASE 6 — Operational Dashboard Real

## What & Why
O dashboard atual exibe métricas estáticas de mock data sem valor operacional real. Para um ERP multi-tenant enterprise, o dashboard é o painel de controle crítico — precisa expor gargalos operacionais, alertas reais com SLA, e indicadores de saúde do negócio musical em tempo real. Esta fase transforma o dashboard em centro nervoso operacional.

## Done looks like
- Dashboard reorganizado em seções: **Alertas Críticos** (vermelho, ação urgente), **Pendências** (amarelo, ação necessária), **Saúde Operacional** (verde, monitoramento), **Tendências** (azul, contexto)
- Indicadores operacionais reais calculados no backend via `GET /dashboard/operational-summary`:
  - Releases: atrasados (data_lancamento < hoje e status != released), sem capa, sem ISRC, sem distribuidora
  - Contratos: vencendo em 30 dias, em assinatura há mais de 7 dias, sem arquivo_url
  - Campanhas: sem budget definido, ativas com gasto > 90% do orçamento
  - Catálogo: obras sem ISRC, fonogramas sem isrc, shares que não somam 100%
  - Tickets: críticos abertos há mais de SLA, sem assignee
  - Integrações: com status `error` ou `disconnected` com last_sync > 24h
  - Onboarding: artistas em status `onboarding` há mais de 14 dias
  - RH: funcionários com folha pendente no mês corrente
- Cada alerta inclui: título, descrição, count, severity (critical/warning/info), link direto para o módulo e filtro pré-aplicado
- Widget de **Timeline Operacional**: últimas 20 ações críticas de domínio (transições de workflow, contratos assinados, releases publicados) em ordem cronológica — alimentado pelo `domain_event_log` da FASE 3
- Widget de **Saúde das Integrações**: status em tempo real das integrações ativas (ABRAMUS, Spotify, YouTube, etc.) com última sincronização
- **KPIs de Negócio** atualizados (real, não mock): receita do mês, despesas do mês, margem, número de artistas ativos, releases este mês, leads em pipeline
- Backend calcula todos os indicadores em queries SQL eficientes com índices existentes; response em < 500ms
- Dashboard suporta auto-refresh a cada 5 minutos via TanStack Query `refetchInterval`

## Out of scope
- Configuração de alertas pelo usuário
- Dashboard customizável (drag-and-drop widgets)
- Histórico de KPIs com série temporal (gráficos de tendência são simplificados)

## Steps
1. **Criar endpoint GET /dashboard/operational-summary** — Service que executa queries paralelas (Promise.all) para cada categoria de alerta. Response tipado com `OperationalAlert[]`, `KpiSummary`, `RecentActivity[]`, `IntegrationHealth[]`. Cache de 60s no `CacheService` existente.
2. **Criar queries de alertas** — Para cada categoria (releases, contratos, catálogo, campanhas, tickets, integrações, RH), implementar query TypeORM eficiente com os filtros corretos filtrados por tenant_id. Retornar count + top 5 itens com link de navegação.
3. **Refatorar componente Dashboard no frontend** — Substituir mock data por chamada real ao endpoint. Criar componentes: `OperationalAlerts.tsx` (lista com cores por severity), `KpiGrid.tsx` (6 KPIs principais), `OperationalTimeline.tsx` (últimas ações), `IntegrationHealthBar.tsx`.
4. **Implementar deep-links nos alertas** — Cada alerta tem `link` e `filter` — ao clicar, navega para o módulo correto com filtro pré-aplicado (ex: Contratos com filtro `vencendo_em_30_dias=true`). Usar `useSearchParams` ou store Zustand para receber o filtro ao montar o módulo.
5. **Auto-refresh e loading states** — TanStack Query com `refetchInterval: 5 * 60 * 1000` (5min). Skeleton loading por seção independente. Indicador visual de "última atualização" no header do dashboard.
6. **Métricas de saúde das integrações** — Widget separado que consulta `IntegrationEntity` + `webhook_events` (falhas recentes) e exibe status visual de cada integração ativa do tenant.

## Relevant files
- `apps/web/src/modules/dashboard/pages/`
- `apps/web/src/modules/dashboard/hooks/`
- `apps/api/src/database/entities.ts`
- `apps/api/src/core/cache/cache.service.ts`
- `apps/web/src/shared/components/`
- `apps/web/src/shared/data/mockData.ts`
