/**
 * Automations triggered by upload events.
 * Validates MIME and size in the tenant context before marking the file as ready.
 */
import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { UploadEntity } from '../../../database/entities';
import { UploadStatus } from '@music-os-360/types';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { AssetUploadedPayload } from '../../../core/events/domain-events.types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg',
  'audio/x-m4a', 'audio/mp4',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf',
  'text/plain',
  XLSX_MIME,
]);

const MAX_SIZE_BYTES: Record<string, number> = {
  'audio/': 500 * 1024 * 1024,
  'video/': 2 * 1024 * 1024 * 1024,
  'image/': 50 * 1024 * 1024,
  'application/': 100 * 1024 * 1024,
  'text/': 10 * 1024 * 1024,
};

function getMaxSize(mimeType: string): number {
  for (const [prefix, limit] of Object.entries(MAX_SIZE_BYTES)) {
    if (mimeType.startsWith(prefix)) return limit;
  }
  throw new Error(`Categoria MIME sem limite explícito: ${mimeType}`);
}

@Injectable()
export class UploadEventsHandler {
  private readonly logger = new Logger(UploadEventsHandler.name);
  private readonly uploadRepo: Repository<UploadEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() dataSource: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (dataSource) this.uploadRepo = dataSource.getRepository(UploadEntity);
  }

  private async markRejected(
    repository: Repository<UploadEntity>,
    uploadId: string,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    const result = await repository.update(
      { id: uploadId, tenant_id: tenantId },
      { status: UploadStatus.ERROR, metadata: { rejectionReason: reason } },
    );
    if (result.affected !== 1) {
      throw new Error(
        `Upload rejeitado não pôde ser atualizado: upload=${uploadId} tenant=${tenantId} affected=${result.affected ?? 0}`,
      );
    }
  }

  @OnEvent(DOMAIN_EVENTS.ASSET_UPLOADED)
  async onAssetUploaded(event: DomainEvent<AssetUploadedPayload>): Promise<void> {
    const { uploadId, tenantId, fileName, mimeType } = event.payload;
    if (!tenantId) {
      throw new Error(`UploadEventsHandler recebeu evento sem tenant: upload=${uploadId}`);
    }

    const runInContext = <T>(work: (manager: EntityManager | undefined) => Promise<T>): Promise<T> =>
      this.dbContext
        ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
        : work(undefined);

    await runInContext(async (manager) => {
      const repository = manager ? manager.getRepository(UploadEntity) : this.uploadRepo;
      if (!repository) {
        throw new Error(
          `UploadEventsHandler sem repositório disponível: upload=${uploadId} tenant=${tenantId}`,
        );
      }

      const record = await repository.findOne({
        where: { id: uploadId, tenant_id: tenantId },
        select: ['size_bytes', 'mime_type'],
      });
      if (!record) {
        throw new Error(`Upload não encontrado no tenant: upload=${uploadId} tenant=${tenantId}`);
      }
      if (record.mime_type && record.mime_type !== mimeType) {
        const reason = `MIME do evento diverge do registro persistido`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        this.logger.warn(
          `${reason}: upload=${uploadId} tenant=${tenantId} event=${mimeType} stored=${record.mime_type}`,
        );
        return;
      }

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        const reason = `MIME não permitido: ${mimeType}`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return;
      }

      const maxBytes = getMaxSize(mimeType);
      const sizeBytes = record.size_bytes ?? 0;
      if (sizeBytes <= 0) {
        const reason = 'Tamanho de arquivo ausente ou inválido';
        await this.markRejected(repository, uploadId, tenantId, reason);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return;
      }
      if (sizeBytes > maxBytes) {
        const reason = `Tamanho ${sizeBytes} excede o limite ${maxBytes} para ${mimeType}`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return;
      }

      const result = await repository.update(
        { id: uploadId, tenant_id: tenantId },
        { status: UploadStatus.READY },
      );
      if (result.affected !== 1) {
        throw new Error(
          `Falha ao confirmar upload: upload=${uploadId} tenant=${tenantId} affected=${result.affected ?? 0}`,
        );
      }
      this.logger.log(
        `Upload validado: upload=${uploadId} tenant=${tenantId} file=${fileName} status=${UploadStatus.READY}`,
      );
    });
  }
}
