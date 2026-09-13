/**
 * shared/integrations/contracts/storage.contract.ts
 *
 * Contrato de armazenamento de ficheiros — implementação alvo: Cloudflare R2.
 *
 * ESTADO ACTUAL: standalone — ficheiros são referenciados por URL local/mock.
 * MIGRAÇÃO FUTURA: StorageService implementará IStorageProvider usando R2 SDK.
 *
 * Domínios que utilizam storage:
 *   - Catalog (áudio de fonogramas)
 *   - Releases (capas, assets de lançamento)
 *   - Contracts (PDFs de contratos)
 *   - Artist (presskit, fotos)
 *   - Marketing (assets de campanhas)
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Categorias de bucket para organização dos ficheiros */
export type StorageBucket =
  | "audio"       // ficheiros de áudio (fonogramas, faixas)
  | "images"      // capas, fotos de artistas, marketing
  | "documents"   // contratos PDF, documents legais
  | "exports"     // relatórios gerados, exports XLSX/PDF
  | "temp";       // uploads temporários antes de processamento

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
  /** Caminho dentro do bucket: `tenant-id/artista-id/audio/faixa.mp3` */
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
  /** Duração da URL em segundos. Default: 3600 (1 hora) */
  expires_in?: number;
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

/**
 * IStorageProvider — contrato de armazenamento de objectos.
 *
 * Implementações previstas:
 *   - MockStorageProvider  (standalone — usa blob URLs locais)
 *   - R2StorageProvider    (produção — Cloudflare R2 via Workers API)
 */
export interface IStorageProvider {
  /** Faz upload de um ficheiro e devolve a URL pública */
  upload(params: StorageUploadParams): Promise<StorageUploadResult>;

  /** Gera uma URL assinada para download temporário */
  presignedUrl(params: StoragePresignedUrlParams): Promise<string>;

  /** Remove um objecto do storage */
  delete(bucket: StorageBucket, key: string): Promise<void>;

  /** Lista objectos num prefixo */
  list(bucket: StorageBucket, prefix: string): Promise<StorageObject[]>;

  /** Verifica se um objecto existe */
  exists(bucket: StorageBucket, key: string): Promise<boolean>;

  /** Copia um objecto dentro do mesmo bucket */
  copy(bucket: StorageBucket, sourceKey: string, destKey: string): Promise<StorageUploadResult>;
}

// ─── Helpers de chave ─────────────────────────────────────────────────────────

/** Constrói a chave de storage com isolamento por tenant */
export function buildStorageKey(
  tenantId: string,
  bucket: StorageBucket,
  ...segments: string[]
): string {
  return [tenantId, bucket, ...segments].join("/");
}

