# Queue Processors — 7 Queues Without a Worker

## What & Why
The system defines 11 BullMQ queues in `queue.constants.ts`, but only 4 have active processors (emails, notifications, ai-jobs, clerk-sync). The remaining 7 — WEBHOOKS, EXPORTS, IMPORTS, BILLING, UPLOADS_PROCESS, INTEGRATIONS_SYNC, STREAMING_SYNC — never process jobs: any job added stays stuck in the queue indefinitely, grows without limit, consumes Redis memory and never produces a result. This affects: OAuth callbacks (integrations-sync), XLSX/PDF exports, OFX imports, Stripe payments (billing) and S3 upload processing.

## Done looks like
- All 7 processors implemented and registered in `QueueModule`
- Jobs processed with retry, dead-letter and structured error logging
- `WEBHOOKS`: processes OAuth callbacks (Spotify, Instagram, TikTok, Google Ads), validates HMAC, persists the token
- `EXPORTS`: generates XLSX/PDF for financial and catalog reports; saves to R2 and notifies the user
- `IMPORTS`: processes OFX for bank reconciliation and XLSX catalog imports (the repository is XLSX-only)
- `BILLING`: processes Stripe webhooks (checkout.session.completed, invoice.paid, subscription.updated)
- `UPLOADS_PROCESS`: processes files after an S3/R2 upload (thumbnail, metadata, MIME validation)
- `INTEGRATIONS_SYNC`: triggers a periodic sync of the platforms configured per tenant
- `STREAMING_SYNC`: sync of Spotify/YouTube/SoundCloud metrics per artist

## Out of scope
- Queue monitoring UI (Bull Board)
- Implementing the real streaming integrations (only the processor skeleton with logging)
- Changing the database schema

## Steps
1. **WebhooksProcessor** — create `webhooks.processor.ts`, which routes jobs by type (oauth-callback, stripe-webhook); validate the HMAC signature or the Stripe signature; delegate to the corresponding service; retry 3x with exponential backoff
2. **ExportsProcessor** — create `exports.processor.ts` with handlers for XLSX (via `exportToXlsx()`, `shared/lib/xlsx.ts`) and PDF; use Drizzle data filtered by tenantId; upload to R2 via `UploadsService`; emit a WebSocket notification on completion
3. **ImportsProcessor** — create `imports.processor.ts` for OFX (parse with the ofx-js library or similar) and generic XLSX (the repository is XLSX-only); insert records into the database via the correct service; report processed/failed rows via a notification
4. **BillingProcessor** — create `billing.processor.ts`, which processes Stripe events: `checkout.session.completed` (activates the plan), `invoice.paid` (renews), `customer.subscription.deleted` (cancels); update the tenant's billing_plan in the database
5. **UploadsProcessor** — create `uploads-process.processor.ts`, which validates the MIME type, extracts audio metadata (duration, bitrate), generates thumbnails for images, and updates the upload record with the status
6. **IntegrationsSyncProcessor + StreamingSyncProcessor** — create skeletons with structured start/end logging, delegating to `IntegrationsService.syncAll(tenantId)` and `StreamingService.syncMetrics(tenantId, artistId)`
7. **Register in QueueModule** — add all 7 processors to the `providers` and `exports` of `queue.module.ts`; ensure the correct `@Processor(QUEUE_NAMES.X)` on each one

## Relevant files
- `apps/api/src/queues/queue.module.ts`
- `apps/api/src/queues/queue.constants.ts`
- `apps/api/src/queues/processors/email.processor.ts`
- `apps/api/src/queues/processors/ai-jobs.processor.ts`
- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
