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
import { DOMAIN_EVENTS, EventsService } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { AssetUploadedPayload } from '../../../core/events/domain-events.types';
import { StorageService, ALLOWED_UPLOAD_MIME_TYPES } from '../../../storage/storage.service';
import { contentMatchesDeclaredType } from '../content-signature';

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
  throw new Error(`MIME category without an explicit limit: ${mimeType}`);
}

@Injectable()
export class UploadEventsHandler {
  private readonly logger = new Logger(UploadEventsHandler.name);
  private readonly uploadRepo: Repository<UploadEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() dataSource: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly events?: EventsService,
  ) {
    if (dataSource) this.uploadRepo = dataSource.getRepository(UploadEntity);
  }

  /** Removes the stored object of a rejected upload so no orphan stays in the bucket. A failure is logged, never thrown. */
  private async discardObject(r2Key: string | null | undefined, uploadId: string, tenantId: string): Promise<void> {
    if (!r2Key || !this.storage) return;
    try {
      await this.storage.delete(r2Key);
    } catch (error) {
      this.logger.warn(`Rejected upload object could not be deleted: upload=${uploadId} tenant=${tenantId} - ${String(error)}`);
    }
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
        `Rejected upload could not be updated: upload=${uploadId} tenant=${tenantId} affected=${result.affected ?? 0}`,
      );
    }
  }

  @OnEvent(DOMAIN_EVENTS.ASSET_UPLOADED)
  async onAssetUploaded(event: DomainEvent<AssetUploadedPayload>): Promise<void> {
    const { uploadId, tenantId, fileName, mimeType } = event.payload;
    if (!tenantId) {
      throw new Error(`UploadEventsHandler received an event without tenant: upload=${uploadId}`);
    }

    const runInContext = <T>(work: (manager: EntityManager | undefined) => Promise<T>): Promise<T> =>
      this.dbContext
        ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
        : work(undefined);

    const verified = await runInContext(async (manager): Promise<boolean> => {
      const repository = manager ? manager.getRepository(UploadEntity) : this.uploadRepo;
      if (!repository) {
        throw new Error(
          `UploadEventsHandler without an available repository: upload=${uploadId} tenant=${tenantId}`,
        );
      }

      const record = await repository.findOne({
        where: { id: uploadId, tenant_id: tenantId },
        select: ['size_bytes', 'mime_type', 'r2_key'],
      });
      if (!record) {
        throw new Error(`Upload not found in tenant: upload=${uploadId} tenant=${tenantId}`);
      }
      if (record.mime_type && record.mime_type !== mimeType) {
        const reason = `MIME do evento diverge do registro persistido`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(
          `${reason}: upload=${uploadId} tenant=${tenantId} event=${mimeType} stored=${record.mime_type}`,
        );
        return false;
      }

      if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
        const reason = `MIME não permitido: ${mimeType}`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }

      const maxBytes = getMaxSize(mimeType);
      const sizeBytes = record.size_bytes ?? 0;
      if (sizeBytes <= 0) {
        const reason = 'Tamanho de arquivo ausente ou inválido';
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }
      if (sizeBytes > maxBytes) {
        const reason = `Tamanho ${sizeBytes} excede o limite ${maxBytes} para ${mimeType}`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }

      // The declared type and size come from the client. What is really stored decides.
      if (!this.storage || !record.r2_key) {
        throw new Error(`UploadEventsHandler cannot verify the stored object: upload=${uploadId} tenant=${tenantId}`);
      }
      let inspected: { size: number; head: Buffer };
      try {
        inspected = await this.storage.inspectObject(record.r2_key);
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        const name = (error as { name?: string }).name;
        if (status !== 404 && name !== 'NotFound' && name !== 'NoSuchKey') throw error;
        const reason = 'Arquivo não encontrado no armazenamento';
        await this.markRejected(repository, uploadId, tenantId, reason);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }
      if (inspected.size !== sizeBytes) {
        const reason = `Tamanho real ${inspected.size} diverge do declarado ${sizeBytes}`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }
      if (!contentMatchesDeclaredType(mimeType, inspected.head)) {
        const reason = `Conteúdo do arquivo não corresponde ao tipo declarado (${mimeType})`;
        await this.markRejected(repository, uploadId, tenantId, reason);
        await this.discardObject(record.r2_key, uploadId, tenantId);
        this.logger.warn(`${reason}: upload=${uploadId} tenant=${tenantId}`);
        return false;
      }

      const result = await repository.update(
        { id: uploadId, tenant_id: tenantId },
        { status: UploadStatus.READY },
      );
      if (result.affected !== 1) {
        throw new Error(
          `Failed to confirm upload: upload=${uploadId} tenant=${tenantId} affected=${result.affected ?? 0}`,
        );
      }
      this.logger.log(
        `Upload validado: upload=${uploadId} tenant=${tenantId} file=${fileName} status=${UploadStatus.READY}`,
      );
      return true;
    });

    // Only a verified upload may become an asset: downstream linking waits for this event.
    if (verified) {
      this.events?.emitTyped(DOMAIN_EVENTS.ASSET_VERIFIED, {
        tenantId,
        userId: event.payload.uploadedBy,
        aggregateType: 'upload',
        aggregateId: uploadId,
        payload: event.payload,
      });
    }
  }
}
