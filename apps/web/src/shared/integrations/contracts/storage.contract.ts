/**
 * shared/integrations/contracts/storage.contract.ts
 *
 * File storage contract — target implementation: Cloudflare R2.
 *
 * CURRENT STATE: standalone — files are referenced by a local/mock URL.
 * FUTURE MIGRATION: StorageService will implement IStorageProvider using the R2 SDK.
 *
 * Domains that use storage:
 *   - Catalog (phonogram audio)
 *   - Releases (covers, release assets)
 *   - Contracts (contract PDFs)
 *   - Artist (press kit, photos)
 *   - Marketing (campaign assets)
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Bucket categories that organize the files */
export type StorageBucket =
  | "audio"       // audio files (phonograms, tracks)
  | "images"      // covers, artist photos, marketing
  | "documents"   // PDF contracts, legal documents
  | "exports"     // generated reports, XLSX/PDF exports
  | "temp";       // temporary uploads before processing

export interface StorageObject {
  key: string;
  bucket: StorageBucket;
  url: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
  metadata?: Record<string, string>;
}

export interface StorageUploadParams {
  bucket: StorageBucket;
  /** Path inside the bucket: `tenant-id/artist-id/audio/track.mp3` */
  key: string;
  file: File | Blob | ArrayBuffer;
  content_type: string;
  metadata?: Record<string, string>;
}

export interface StorageUploadResult {
  key: string;
  url: string;
  etag: string;
}

export interface StoragePresignedUrlParams {
  bucket: StorageBucket;
  key: string;
  /** URL lifetime in seconds. Default: 3600 (1 hour) */
  expires_in?: number;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * IStorageProvider — object storage contract.
 *
 * Planned implementations:
 *   - MockStorageProvider  (standalone — uses local blob URLs)
 *   - R2StorageProvider    (production — Cloudflare R2 via the Workers API)
 */
export interface IStorageProvider {
  /** Uploads a file and returns its public URL */
  upload(params: StorageUploadParams): Promise<StorageUploadResult>;

  /** Generates a signed URL for a temporary download */
  presignedUrl(params: StoragePresignedUrlParams): Promise<string>;

  /** Remove um objecto do storage */
  delete(bucket: StorageBucket, key: string): Promise<void>;

  /** Lists objects under a prefix */
  list(bucket: StorageBucket, prefix: string): Promise<StorageObject[]>;

  /** Checks whether an object exists */
  exists(bucket: StorageBucket, key: string): Promise<boolean>;

  /** Copies an object within the same bucket */
  copy(bucket: StorageBucket, sourceKey: string, destKey: string): Promise<StorageUploadResult>;
}

// ─── Helpers de chave ─────────────────────────────────────────────────────────

/** Builds the storage key with per-tenant isolation */
export function buildStorageKey(
  tenantId: string,
  bucket: StorageBucket,
  ...segments: string[]
): string {
  return [tenantId, bucket, ...segments].join("/");
}

