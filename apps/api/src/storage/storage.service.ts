/**
 * storage/storage.service.ts
 *
 * Serviço de abstração sobre Cloudflare R2.
 * Operações: upload, presigned URL, delete, exists, list.
 */

import { Injectable, Inject, Optional, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { R2_CLIENT, R2_BUCKET, R2_PUBLIC_URL } from './storage.tokens';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ALLOWED_MIMES = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4'],
  spreadsheets: [XLSX_MIME],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
} as const;

const MAX_SIZES_MB: Record<UploadCategory, number> = {
  documents: 50,
  images: 10,
  audio: 500,
  spreadsheets: 20,
  videos: 500,
};

const MIME_TO_EXTENSIONS: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
  'audio/flac': ['flac'],
  'audio/mp4': ['m4a', 'mp4'],
  [XLSX_MIME]: ['xlsx'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
};

function extractExtension(fileName: string): string | null {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0 || idx === fileName.length - 1) return null;
  return fileName.slice(idx + 1).toLowerCase();
}

export type UploadCategory = keyof typeof ALLOWED_MIMES;

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  key: string;
  expiresIn?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Optional() @Inject(R2_CLIENT) private readonly r2Client: S3Client | null,
    @Optional() @Inject(R2_BUCKET) private readonly r2Bucket: string,
    @Optional() @Inject(R2_PUBLIC_URL) private readonly r2PublicUrl: string | null,
  ) {}

  isConfigured(): boolean {
    return this.r2Client !== null;
  }

  private getClient(): S3Client {
    if (!this.r2Client) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'R2_NOT_CONFIGURED',
        message:
          'Upload indisponível — armazenamento R2 não configurado no servidor. ' +
          'Contate o administrador para configurar R2_ACCOUNT_ID, R2_ACCESS_KEY e R2_SECRET_KEY.',
      });
    }
    return this.r2Client;
  }

  async upload(options: UploadOptions): Promise<string> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.r2Bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType ?? 'application/octet-stream',
        Metadata: options.metadata,
      }),
    );
    const url = this.r2PublicUrl
      ? `${this.r2PublicUrl}/${options.key}`
      : `r2://${this.r2Bucket}/${options.key}`;
    this.logger.log(`Upload concluído: ${options.key}`);
    return url;
  }

  async createPresignedUpload(params: {
    tenantId: string;
    userId: string;
    category: UploadCategory;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    entity?: string;
    entityId?: string;
  }): Promise<{ presignedUrl: string; key: string; fileId: string; publicUrl: string }> {
    const client = this.getClient();

    const allowedList = ALLOWED_MIMES[params.category] as readonly string[];
    if (!allowedList.includes(params.mimeType)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${params.mimeType}`);
    }

    const ext = extractExtension(params.fileName);
    if (!ext) {
      throw new BadRequestException(`Arquivo sem extensão: ${params.fileName}`);
    }
    const expectedExts = MIME_TO_EXTENSIONS[params.mimeType];
    if (!expectedExts || !expectedExts.includes(ext)) {
      throw new BadRequestException(
        `Extensão "${ext}" incompatível com mimeType "${params.mimeType}". Esperado: ${(expectedExts ?? []).join(', ') || 'n/a'}`,
      );
    }

    const maxBytes = MAX_SIZES_MB[params.category] * 1024 * 1024;
    if (params.sizeBytes <= 0) {
      throw new BadRequestException('O tamanho do arquivo deve ser maior que zero.');
    }
    if (params.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `Arquivo muito grande. Máximo: ${MAX_SIZES_MB[params.category]}MB`,
      );
    }

    const fileId = randomUUID();
    const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `tenants/${params.tenantId}/${params.category}/${fileId}/${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.r2Bucket,
      Key: key,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
      Metadata: {
        tenant_id: params.tenantId,
        user_id: params.userId,
        original_name: params.fileName,
        entity: params.entity ?? '',
        entity_id: params.entityId ?? '',
      },
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const publicUrl = this.r2PublicUrl
      ? `${this.r2PublicUrl}/${key}`
      : `r2://${this.r2Bucket}/${key}`;
    this.logger.log(`Presigned upload gerado: ${key}`);
    return { presignedUrl, key, fileId, publicUrl };
  }

  async createDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.getPresignedUrl({ key, expiresIn: expiresInSeconds });
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const client = this.getClient();
    const cmd = new GetObjectCommand({
      Bucket: this.r2Bucket,
      Key: options.key,
    });
    return getSignedUrl(client, cmd, {
      expiresIn: options.expiresIn ?? 3600,
    });
  }

  /**
   * Stream do objeto directamente do R2, através do backend.
   *
   * R2 é uma origem separada (pub-xxx.r2.dev / domínio custom) sem CORS
   * garantido para leitura em <canvas> (crossOrigin="anonymous"). Este
   * método permite servir o mesmo byte-stream a partir da própria API --
   * que já tem uma política CORS explícita e controlada (create-app.ts) --
   * para que o frontend possa compor imagens num canvas sem "tainting" e
   * exportar um PNG real (composição estática do template criativo).
   */
  async getObject(key: string): Promise<{
    body: NodeJS.ReadableStream;
    contentType: string | undefined;
    contentLength: number | undefined;
  }> {
    const client = this.getClient();
    const res = await client.send(new GetObjectCommand({ Bucket: this.r2Bucket, Key: key }));
    return {
      body: res.Body as NodeJS.ReadableStream,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  }

  async delete(key: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.r2Bucket, Key: key }),
    );
    this.logger.log(`Ficheiro eliminado: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.r2Bucket, Key: key }),
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return false;
      this.logger.error(`Falha ao verificar objeto R2: ${key}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const client = this.getClient();
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: this.r2Bucket, Prefix: prefix }),
    );
    return (res.Contents ?? [])
      .map((o: { Key?: string }) => o.Key ?? '')
      .filter(Boolean);
  }
}
