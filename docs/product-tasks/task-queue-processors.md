# Queue Processors — 7 Filas Sem Worker

## What & Why
O sistema define 11 filas BullMQ em `queue.constants.ts`, mas apenas 4 têm processors ativos (emails, notifications, ai-jobs, clerk-sync). As 7 restantes — WEBHOOKS, EXPORTS, IMPORTS, BILLING, UPLOADS_PROCESS, INTEGRATIONS_SYNC, STREAMING_SYNC — nunca processam jobs: qualquer job adicionado fica preso indefinidamente na fila, cresce sem limite, consome memória Redis e nunca produz resultado. Isso afeta: callbacks OAuth (integrations-sync), exportações XLSX/PDF, importações OFX, pagamentos Stripe (billing) e processamento de uploads S3.

## Done looks like
- Todos os 7 processors implementados e registrados no `QueueModule`
- Jobs processados com retry, dead-letter e log de erros estruturado
- `WEBHOOKS`: processa callbacks OAuth (Spotify, Instagram, TikTok, Google Ads), valida HMAC, persiste token
- `EXPORTS`: gera XLSX/PDF de relatórios financeiros e catálogo; salva no R2 e notifica usuário
- `IMPORTS`: processa OFX de conciliação bancária e importações de catálogo XLSX (repositório é XLSX-only)
- `BILLING`: processa webhooks Stripe (checkout.session.completed, invoice.paid, subscription.updated)
- `UPLOADS_PROCESS`: processa arquivos após upload S3/R2 (thumbnail, metadados, validação MIME)
- `INTEGRATIONS_SYNC`: dispara sync periódico de plataformas configuradas por tenant
- `STREAMING_SYNC`: sync de métricas Spotify/YouTube/SoundCloud por artista

## Out of scope
- UI de monitoramento de filas (Bull Board)
- Implementar as integrações reais de streaming (apenas o processor skeleton com log)
- Alterar schema de banco de dados

## Steps
1. **WebhooksProcessor** — criar `webhooks.processor.ts` que roteia jobs por tipo (oauth-callback, stripe-webhook); validar assinatura HMAC ou Stripe signature; delegar para service correspondente; retry 3x com backoff exponencial
2. **ExportsProcessor** — criar `exports.processor.ts` com handlers para XLSX (via `exportToXlsx()`, `shared/lib/xlsx.ts`) e PDF; usar dados do Drizzle filtrados por tenantId; upload para R2 via `UploadsService`; emitir notificação WebSocket ao concluir
3. **ImportsProcessor** — criar `imports.processor.ts` para OFX (parse com biblioteca ofx-js ou similar) e XLSX genérico (repositório é XLSX-only); inserir registros no banco via service correto; reportar linhas processadas/erro via notificação
4. **BillingProcessor** — criar `billing.processor.ts` que processa eventos Stripe: `checkout.session.completed` (ativa plano), `invoice.paid` (renova), `customer.subscription.deleted` (cancela); atualizar tenant billing_plan no banco
5. **UploadsProcessor** — criar `uploads-process.processor.ts` que valida MIME type, extrai metadados de áudio (duração, bitrate), gera thumbnail para imagens, atualiza registro de upload com status
6. **IntegrationsSyncProcessor + StreamingSyncProcessor** — criar skeletons com log estruturado de início/fim, delegar para `IntegrationsService.syncAll(tenantId)` e `StreamingService.syncMetrics(tenantId, artistId)`
7. **Registrar no QueueModule** — adicionar todos os 7 processors ao `providers` e `exports` do `queue.module.ts`; garantir `@Processor(QUEUE_NAMES.X)` correto em cada um

## Relevant files
- `apps/api/src/queues/queue.module.ts`
- `apps/api/src/queues/queue.constants.ts`
- `apps/api/src/queues/processors/email.processor.ts`
- `apps/api/src/queues/processors/ai-jobs.processor.ts`
- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
