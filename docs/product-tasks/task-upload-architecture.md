# Upload Architecture — Signed URLs + Multipart + Progress + MIME Validation

## What & Why
All uploads in the frontend are mock: they only save the name/size in local state, without sending anything to the server. The backend has an `uploads` module but does not implement signed URLs for R2/S3, multipart upload for large files (WAV/FLAC can be 500MB+), upload progress, retry on network failure, or server-side MIME validation. In production, audio files, cover images and promotional assets need a robust, resilient pipeline.

## Done looks like
- `POST /uploads/signed-url` returns `{ uploadUrl, key, expiresAt }` — a presigned R2 URL with a 15min TTL
- Frontend: a `useUpload()` hook with `upload(file): Promise<{ key, url }>` — does a PUT directly to R2 via the signed URL, with an `onProgress(percent)` callback
- A real progress bar (`<UploadProgress />`) using `XMLHttpRequest.upload.onprogress`
- Multipart upload: files > 50MB use the R2 multipart API (initiate → upload parts → complete)
- MIME validation: the server validates the real content-type (magic bytes) before signing the URL; allowlist: `audio/wav`, `audio/flac`, `audio/mpeg`, `audio/ogg`, `image/jpeg`, `image/png`, `image/webp`, `video/mp4`
- Upload retry: 3 attempts with exponential backoff on network errors; cancellation via `AbortController`
- After a successful upload: the frontend calls `POST /uploads/confirm` with `{ key, entityType, entityId }` — the backend persists it in the `uploads` table and fires an `UPLOADS_PROCESS` job on the queue
- `UploadsProcessor` (queue) extracts metadata: audio duration, real MIME, size; generates thumbnails for images; updates the record with `status: 'processed'`
- FonogramaFormModal, ArtistaFormModal and ContratoFormModal: integrate `useUpload()`, replacing the mock handlers
- `tsc --noEmit` without errors

## Out of scope
- CDN in front of R2 (infrastructure configuration)
- Video transcoding
- Bulk upload (multiple simultaneous files)
- Integration with ECAD/ABRAMUS for audio delivery

## Steps
1. **Backend signed URL endpoint** — in `UploadsController`: `POST /uploads/signed-url` receives `{ filename, mimeType, entityType, fileSize }`; validates the MIME allowlist and the maximum size (500MB); generates the R2 key `{tenantId}/{entityType}/{uuid}/{filename}`; signs via the R2 SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`); returns `{ uploadUrl, key, expiresAt }`
2. **Multipart R2 upload** — for `fileSize > 50MB`: endpoint `POST /uploads/multipart/initiate` → `POST /uploads/multipart/part-url` → `POST /uploads/multipart/complete`; use `CreateMultipartUploadCommand`, `UploadPartCommand`, `CompleteMultipartUploadCommand`
3. **Backend confirm endpoint** — `POST /uploads/confirm` receives `{ key, entityType, entityId, mimeType }`; inserts into the `uploads` table with `status: 'uploaded'`; fires the `UPLOADS_PROCESS` job via BullMQ
4. **UploadsProcessor** — implement the processor from PHASE 3 #664: for audio, use the `music-metadata` npm package to extract duration, bitrate, format; for images, use `sharp` to generate a 300x300 thumbnail; update the upload record with `{ duration, bitrate, thumbnailKey, status: 'processed' }`
5. **useUpload() hook** — create `client/src/shared/hooks/useUpload.ts`; method `upload({ file, entityType, entityId, onProgress })`: 1) `POST /uploads/signed-url`; 2) XHR PUT to R2 with progress tracking; 3) `POST /uploads/confirm`; returns `{ key, url, isPending, progress, error }`; support for AbortController for cancellation
6. **UploadProgress component** — create `client/src/shared/components/UploadProgress.tsx`; props `progress: number (0-100)`, `status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'`; use shadcn Progress + animation
7. **Integrate into the forms** — update `FonogramaFormModal` (audio), `ArtistaFormModal` (photo), `ContratoFormModal` (PDF) to use `useUpload()`, replacing the mock handlers; preserve the existing UX (drag & drop, click to upload)

## Relevant files
- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/uploads/uploads.module.ts`
- `apps/api/src/queues/processors/` (UploadsProcessor to be created)
- `client/src/modules/catalog/components/FonogramaFormModal.tsx`
- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/shared/hooks/` (useUpload to be created)

## Depends on
- Task #661 (tenantId on the request — to generate the correct R2 path)
- Task #664 (queue processor UPLOADS_PROCESS)
