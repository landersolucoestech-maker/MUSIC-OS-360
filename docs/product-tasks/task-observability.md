# Observabilidade Enterprise — Correlation ID + Structured Logs + Tracing

## What & Why
O interceptor de logging atual apenas registra `METHOD URL → STATUS [Xms]` em texto plano. Não há correlation ID, tenant ID nos logs, structured JSON, tracing distribuído nem métricas de fila. Em produção multi-tenant, isso torna impossível correlacionar requests com tenants, rastrear falhas em filas e diagnosticar problemas de performance por rota. O AuditService existe mas não é chamado sistematicamente.

## Done looks like
- Cada request tem `x-request-id` (UUID gerado ou propagado do header)
- `LoggingInterceptor` reformulado: emite JSON estruturado com `requestId`, `tenantId`, `userId`, `method`, `path`, `statusCode`, `durationMs`
- Middleware `CorrelationIdMiddleware` injeta `x-request-id` no request e response antes de qualquer handler
- `AsyncLocalStorage` propaga `requestId` e `tenantId` para qualquer `this.logger.log()` feito dentro de services (via `RequestContextService`)
- Queue processors: log estruturado de início (`job.id`, `queue`, `tenantId`), conclusão e falha
- Health check endpoint `GET /health` retorna `{ status: "ok", uptime, version, db: "connected" }`
- Endpoint `GET /health/queues` retorna contagem de jobs waiting/active/failed por fila
- `GlobalExceptionFilter` reformulado: inclui `requestId`, `tenantId`, stack trace em dev, mensagem sanitizada em prod
- `tsc --noEmit` sem erros

## Out of scope
- OpenTelemetry full distributed tracing (instrumentação de spans end-to-end)
- PostHog / Sentry integration (já existe, apenas melhorar integração)
- Frontend observabilidade

## Steps
1. **CorrelationIdMiddleware** — criar `core/middleware/correlation-id.middleware.ts`: gerar UUID v4 se `x-request-id` não vier no header; setar em `req.requestId` e no response header `x-request-id`; registrar no `AppModule` como middleware global
2. **RequestContextService** — criar `core/context/request-context.service.ts` usando `AsyncLocalStorage<{ requestId: string; tenantId: string | null; userId: string | null }>`; exportar `getContext()` e `run(ctx, fn)`; registrar no `CoreModule`
3. **LoggingInterceptor refactor** — reescrever para emitir JSON estruturado: `{ level, timestamp, requestId, tenantId, userId, method, path, statusCode, durationMs }`; usar `RequestContextService.getContext()`
4. **Queue logs** — atualizar todos os 4 processors existentes (email, notifications, ai-jobs, clerk-sync) para logar `{ jobId, queue, tenantId, attempt }` no início e fim de cada job via `this.logger.log(JSON.stringify(...))`
5. **Health endpoints** — criar `core/health/health.controller.ts` com `GET /health` (db ping via Drizzle `SELECT 1`) e `GET /health/queues` (BullMQ queue counts para EMAILS, NOTIFICATIONS, AI_JOBS, CLERK_SYNC); registrar no `CoreModule`
6. **GlobalExceptionFilter update** — adicionar `requestId` e `tenantId` ao corpo de erro; sanitizar stack trace (`NODE_ENV !== production`); logar como JSON estruturado

## Relevant files
- `apps/api/src/core/interceptors/logging.interceptor.ts`
- `apps/api/src/core/filters/global-exception.filter.ts`
- `apps/api/src/core/audit/audit.service.ts`
- `apps/api/src/queues/processors/email.processor.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/core/core.module.ts`
