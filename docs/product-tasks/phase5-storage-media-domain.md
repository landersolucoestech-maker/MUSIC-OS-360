# FASE 5 — Storage + Media Domain

## What & Why
O sistema tem uma `UploadEntity` e um `StorageService` básicos, mas sem ownership declarado por entidade, sem signed URLs, sem processamento assíncrono real, sem versionamento de assets e sem pipeline de mídia. Capas de álbum, áudios, documentos de contrato, PDFs, assets de campanha e fotos de artistas são todos tratados da mesma forma genérica. Esta fase consolida o domínio de mídia com tipagem forte, isolamento por tenant e pipeline de processamento preparado para escala.

## Done looks like
- `MediaAssetEntity` (nova entidade) com campos: `id`, `tenant_id`, `entity_type` (artist/release/contract/campaign), `entity_id`, `category` (cover/audio/document/photo/banner/asset), `file_id` (único), `original_name`, `mime_type`, `size_bytes`, `storage_key`, `cdn_url`, `status` (pending/processing/ready/error/deleted), `version`, `metadata JSONB` (width, height, duration, waveform_url, thumbnail_url), `created_by`, `created_at`, `deleted_at`
- `StorageService` refatorado com métodos: `generateUploadUrl(category, entity)`, `confirmUpload(file_id)`, `getSignedUrl(file_id, ttl)`, `deleteAsset(file_id)` — nunca expõe chaves de storage diretamente
- Isolamento por tenant: `storage_key` inclui `tenant_id` no path (`{tenant_id}/{category}/{year}/{file_id}`)
- `UploadConfirmation` endpoint: após upload direto para R2/S3, frontend chama `POST /uploads/confirm` com `file_id` → backend valida, move de `pending` para `ready`, emite `AssetUploaded` event
- Pipeline de processamento assíncrono (BullMQ já existente): fila `media-processing` com jobs: `generate-thumbnail` (imagens), `extract-waveform-placeholder` (áudio), `validate-document` (PDF/DOC)
- Versionamento: uploads de nova capa/áudio para mesma entidade criam nova versão (`version++`) em vez de substituir — versão anterior marcada como `superseded`
- `GET /uploads` endpoint com filtros por entity_type, entity_id, category — retorna URLs assinadas com TTL
- Frontend: componente `MediaUploader` unificado em `apps/web/src/shared/components/MediaUploader.tsx` usado em todos os formulários (artista, release, contrato, campanha)
- Tenant isolation garantida: queries sempre filtradas por `tenant_id`; chaves de storage com prefixo do tenant

## Out of scope
- Transcoding de áudio real (infra externa)
- OCR de documentos
- Análise de IA em assets
- CDN configuração (variável de ambiente)

## Steps
1. **Criar MediaAssetEntity + migration** — Nova entidade com todos os campos descritos. Remover/deprecar `UploadEntity` legada ou fazê-la conviver com foreign key para `media_assets`. Criar índices em `(tenant_id, entity_type, entity_id)` e `(file_id)`.
2. **Refatorar StorageService** — Implementar `generateUploadUrl()` que retorna presigned PUT URL para R2/S3 com TTL de 15min. `confirmUpload()` valida MIME type, tamanho, tenant, muda status para `ready`. `getSignedUrl()` retorna GET URL assinada com TTL configurável.
3. **Implementar pipeline BullMQ de processamento** — Adicionar fila `media-processing` ao QueueService existente. Processor que recebe `AssetUploaded` event e executa jobs de validação: MIME check, size check, thumbnail generation placeholder, waveform placeholder para áudio.
4. **Versionamento de assets** — Lógica em `MediaAssetsService.create()`: ao fazer upload de novo asset para mesma `(entity_type, entity_id, category)`, buscar versão anterior, marcar como `version_superseded=true`, incrementar `version` no novo.
5. **Criar MediaUploader component** — Componente React unificado com: área de drag-and-drop, preview, progress bar, validação client-side de tipo/tamanho, chamada ao endpoint de presigned URL, upload direto, chamada de confirmação. Substituir implementações ad-hoc nos formulários de artista, release, contrato, campanha.
6. **Expor endpoints de media** — `GET /media-assets?entity_type=&entity_id=` (retorna lista com signed URLs), `POST /media-assets/upload-url`, `POST /media-assets/confirm`, `DELETE /media-assets/:id` (soft delete + marca `status=deleted`).

## Relevant files
- `apps/api/src/core/storage/storage.service.ts`
- `apps/api/src/core/queue/queue.service.ts`
- `apps/api/src/database/entities.ts`
- `apps/web/src/modules/artist/components/ArtistFormModal.tsx`
- `apps/web/src/modules/releases/components/LancamentoFormModal.tsx`
- `apps/web/src/modules/contracts/components/ContratoFormModal.tsx`
- `apps/web/src/shared/components/`
