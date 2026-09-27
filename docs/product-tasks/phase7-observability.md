# FASE 7 — Observability Operacional

## What & Why
O sistema tem `packages/observability` com Sentry e Pino logger declarados, mas a cobertura de tracing é superficial, não há workflow monitoring, não há rastreamento de filas e não há logs estruturados de RBAC/tenant nas decisões críticas. Para operar em escala SaaS, é preciso visibilidade completa de cada requisição, cada transição de workflow e cada decisão de permissão.

## Done looks like
- `X-Request-ID` e `X-Correlation-ID` propagados em 100% das requisições — gerados no middleware de entrada, retornados nos headers de response, logados em cada linha de log da requisição
- Structured logging com Pino: cada log inclui campos: `request_id`, `correlation_id`, `tenant_id`, `user_id`, `module`, `action`, `duration_ms`, `status_code`
- Logs de RBAC: cada decisão `assertCan()` loga `{role, resource, action, allowed, tenant_id, user_id}` em nível DEBUG em desenvolvimento, WARN quando negado
- Logs de tenant propagation: resolução de tenant no guard loga `{tenant_id, org_id, clerk_org_id, resolved_in_ms}` em DEBUG
- Workflow transition logs: cada chamada a `WorkflowService.transition()` loga `{entity_type, entity_id, from, to, actor_id, tenant_id, guards_evaluated, duration_ms}` em INFO
- Queue monitoring: `QueueService` loga métricas de fila a cada ciclo: `{queue_name, waiting, active, completed, failed, delayed}` em INFO
- Integration monitoring: `IntegrationService` loga cada sync: `{provider, tenant_id, status, items_synced, errors, duration_ms}`
- Failure tracking: `WebhookEventEntity` já tem `retry_count` e `error` — adicionar alertas quando `retry_count > 3` e `failure_count > 5` em `IntegrationEntity`
- Health endpoint `GET /health` expandido com: DB status, Queue status, Integration status resumido, uptime, versão
- Em desenvolvimento (NODE_ENV=development): log level DEBUG ativo, duração de cada query SQL logada, decisões RBAC logadas
- Em produção: log level INFO, outputs JSON para stdout (Pino production config)
- Sentry: error capturing com `tenant_id` e `user_id` no contexto de cada erro capturado

## Out of scope
- APM externo (Datadog, NewRelic)
- Distributed tracing com OpenTelemetry exporters externos
- Log aggregation externa (CloudWatch, etc.)
- Dashboard de métricas de infraestrutura

## Steps
1. **Implementar RequestContextMiddleware** — Middleware NestJS que gera `X-Request-ID` (UUID v4) e lê/gera `X-Correlation-ID` do header. Armazena ambos em AsyncLocalStorage. Adiciona os headers no response. Aplicar globalmente no `main.ts`.
2. **Configurar Pino com campos automáticos** — Refatorar o logger de `packages/observability` para incluir automaticamente `request_id` e `correlation_id` do AsyncLocalStorage em cada log. Configurar serializers para `tenant_id` e `user_id`. Formato JSON em produção, pretty em dev.
3. **Adicionar logs estruturados ao RBAC** — Em `RbacService.can()` e `assertCan()`, logar cada decisão com campos completos. Level DEBUG quando permitido, WARN quando negado. Incluir `tenant_id` e `user_id` do contexto.
4. **Adicionar logs ao WorkflowService** — Instrumentar `WorkflowService.transition()` com log de entrada (guards a avaliar), cada guard avaliado, resultado final e duração total. Logar `workflow_transition` como evento estruturado.
5. **Queue e Integration monitoring** — Em `QueueService`, adicionar método `getMetrics()` chamado em schedule (a cada 30s) que loga estado das filas. Em `IntegrationService`, logar cada sync com resultado e duração. Alertar (WARN) quando `failure_count` ultrapassa threshold.
6. **Expandir health endpoint** — `GET /health` retorna: `{status, version, uptime, db: {status, latency_ms}, queues: [{name, waiting, failed}], integrations: {connected_count, error_count}}`. Protegido por API key interna para scraping.

## Relevant files
- `packages/observability/src/`
- `apps/api/src/core/logger/`
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/core/queue/queue.service.ts`
- `apps/api/src/core/interceptors/`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
