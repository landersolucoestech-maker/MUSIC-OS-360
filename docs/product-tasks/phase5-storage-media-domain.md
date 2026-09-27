# PHASE 5 — Storage + Media Domain

## What & Why
The system has a basic `UploadEntity` and `StorageService`, but with no ownership declared per entity, no signed URLs, no real asynchronous processing, no asset versioning and no media pipeline. Album covers, audio, contract documents, PDFs, campaign assets and artist photos are all handled in the same generic way. This phase consolidates the media domain with strong typing, per-tenant isolation and a processing pipeline prepared for scale.

## Done looks like
- `MediaAssetEntity` (new entity) with the fields: `id`, `tenant_id`, `entity_type` (artist/release/contract/campaign), `entity_id`, `category` (cover/audio/document/photo/banner/asset), `file_id` (unique), `original_name`, `mime_type`, `size_bytes`, `storage_key`, `cdn_url`, `status` (pending/processing/ready/error/deleted), `version`, `metadata JSONB` (width, height, duration, waveform_url, thumbnail_url), `created_by`, `created_at`, `deleted_at`
- `StorageService` refactored with the methods: `generateUploadUrl(category, entity)`, `confirmUpload(file_id)`, `getSignedUrl(file_id, ttl)`, `deleteAsset(file_id)` — never exposes storage keys directly
- Per-tenant isolation: `storage_key` includes `tenant_id` in the path (`{tenant_id}/{category}/{year}/{file_id}`)
- `UploadConfirmation` endpoint: after a direct upload to R2/S3, the frontend calls `POST /uploads/confirm` with `file_id` → the backend validates, moves it from `pending` to `ready`, emits the `AssetUploaded` event
- Asynchronous processing pipeline (BullMQ already exists): a `media-processing` queue with the jobs: `generate-thumbnail` (images), `extract-waveform-placeholder` (audio), `validate-document` (PDF/DOC)
- Versioning: uploads of a new cover/audio for the same entity create a new version (`version++`) instead of replacing it — the previous version is marked as `superseded`
- `GET /uploads` endpoint with filters by entity_type, entity_id, category — returns signed URLs with a TTL
- Frontend: a unified `MediaUploader` component in `apps/web/src/shared/components/MediaUploader.tsx` used in all forms (artist, release, contract, campaign)
- Tenant isolation guaranteed: queries always filtered by `tenant_id`; storage keys prefixed with the tenant

## Out of scope
- Real audio transcoding (external infra)
- Document OCR
- AI analysis of assets
- CDN configuration (environment variable)

## Steps
1. **Create MediaAssetEntity + migration** — New entity with all the fields described. Remove/deprecate the legacy `UploadEntity` or let it coexist with a foreign key to `media_assets`. Create indexes on `(tenant_id, entity_type, entity_id)` and `(file_id)`.
2. **Refactor StorageService** — Implement `generateUploadUrl()`, which returns a presigned PUT URL for R2/S3 with a 15min TTL. `confirmUpload()` validates the MIME type, size, tenant, and changes the status to `ready`. `getSignedUrl()` returns a signed GET URL with a configurable TTL.
3. **Implement the BullMQ processing pipeline** — Add a `media-processing` queue to the existing QueueService. A processor that receives the `AssetUploaded` event and runs validation jobs: MIME check, size check, thumbnail generation placeholder, waveform placeholder for audio.
4. **Asset versioning** — Logic in `MediaAssetsService.create()`: when uploading a new asset for the same `(entity_type, entity_id, category)`, look up the previous version, mark it as `version_superseded=true`, increment `version` on the new one.
5. **Create the MediaUploader component** — A unified React component with: a drag-and-drop area, preview, progress bar, client-side type/size validation, a call to the presigned URL endpoint, direct upload, and a confirmation call. Replace the ad-hoc implementations in the artist, release, contract and campaign forms.
6. **Expose media endpoints** — `GET /media-assets?entity_type=&entity_id=` (returns a list with signed URLs), `POST /media-assets/upload-url`, `POST /media-assets/confirm`, `DELETE /media-assets/:id` (soft delete + marks `status=deleted`).

## Relevant files
- `apps/api/src/core/storage/storage.service.ts`
- `apps/api/src/core/queue/queue.service.ts`
- `apps/api/src/database/entities.ts`
- `apps/web/src/modules/artist/components/ArtistFormModal.tsx`
- `apps/web/src/modules/releases/components/LancamentoFormModal.tsx`
- `apps/web/src/modules/contracts/components/ContratoFormModal.tsx`
- `apps/web/src/shared/components/`
