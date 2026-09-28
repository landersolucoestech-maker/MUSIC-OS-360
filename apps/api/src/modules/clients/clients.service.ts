import { BadRequestException, Injectable, Inject, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DATA_SOURCE } from '../../database/database.module';
import { ClientEntity, ClientAttachmentEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { StorageService, type UploadCategory } from '../../storage/storage.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateClientDto, UpdateClientDto, QueryClientDto } from './dto/clients.dto';
import { canonicalClientTimelineType, canonicalizeClientInput, canonicalizeClientQuery } from './client-legacy-fields';

/** Persisted client columns accepted from the (canonical) request. */
const CLIENT_COLUMNS = [
  'name', 'person_type', 'category', 'profile', 'photo_url', 'individual_name', 'legal_name', 'trade_name',
  'instagram', 'job_title', 'street', 'street_number', 'address_complement', 'neighborhood', 'city', 'state',
  'zip_code', 'address', 'priority', 'responsible_name', 'responsible_job_title', 'responsible_email',
  'responsible_phone', 'notes', 'interactions', 'status',
] as const;

const TIMELINE_ENTITY_TYPE = 'client';
const ATTACHMENT_CATEGORY: UploadCategory = 'documents';

@Injectable()
export class ClientsService {
  private readonly repo: Repository<ClientEntity> | null = null;
  private readonly attachmentsRepo: Repository<ClientAttachmentEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly enc: EncryptionService,
    @Optional() private readonly activityLogs?: ActivityLogsService,
    @Optional() private readonly storage?: StorageService,
  ) {
    if (ds) {
      this.repo = ds.getRepository(ClientEntity);
      this.attachmentsRepo = ds.getRepository(ClientAttachmentEntity);
    }
  }

  /**
   * Response shape (CZ-043): canonical columns + decrypted email/phone/cpf_cnpj.
   * Ciphertext and `metadata` (historical Portuguese copies, including
   * plaintext cpf/cnpj — BLK-CRM-PII-PLAINTEXT) never leave the API.
   */
  private mapClient(c: ClientEntity) {
    const { email_encrypted, phone_encrypted, cpf_cnpj_encrypted, metadata: _metadata, ...columns } = c;
    void _metadata;
    return {
      ...columns,
      email:    this.enc.decryptNullable(email_encrypted),
      phone:    this.enc.decryptNullable(phone_encrypted),
      cpf_cnpj: this.enc.decryptNullable(cpf_cnpj_encrypted),
    };
  }

  async list(tenantId: string, query: QueryClientDto) {
    const q = canonicalizeClientQuery(query) as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (q['status'])   qb.andWhere('c.status = :status',      { status:   q['status'] });
    if (q['person_type']) qb.andWhere('c.person_type = :personType', { personType: q['person_type'] });
    if (q['category']) qb.andWhere('c.category = :category', { category: q['category'] });
    if (q['search'])   qb.andWhere('c.name ILIKE :search',    { search: `%${q['search']}%` });

    qb.orderBy('c.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((c) => this.mapClient(c)),
      meta: { total, offset: typeof q['offset'] === 'number' ? q['offset'] : 0, limit: typeof q['limit'] === 'number' ? q['limit'] : 50 },
    };
  }

  async findById(tenantId: string, id: string) {
    return this.mapClient(await this.findEntity(tenantId, id));
  }

  private async findEntity(tenantId: string, id: string): Promise<ClientEntity> {
    const result = await this.repo!
      .createQueryBuilder('c')
      .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Cliente não encontrado');
    return result;
  }

  async create(tenantId: string, userId: string, dto: CreateClientDto) {
    const { email, phone, cpf_cnpj, ...rest } = canonicalizeClientInput(dto) as unknown as Record<string, unknown>;
    const client = this.toColumns(rest, true);
    const entity = this.repo!.create({
      tenant_id:          tenantId,
      ...(client as Partial<ClientEntity>),
      email_encrypted:    this.enc.encryptNullable(email as string | undefined),
      phone_encrypted:    this.enc.encryptNullable(phone as string | undefined),
      cpf_cnpj_encrypted: this.enc.encryptNullable(cpf_cnpj as string | undefined),
      created_by:         userId,
      updated_by:         userId,
    } as Partial<ClientEntity>);
    const saved = await this.repo!.save(entity as ClientEntity);
    await this.recordActivity(tenantId, userId, saved.id, 'created', `Cliente "${saved.name}" criado`, {});
    return this.mapClient(saved as ClientEntity);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateClientDto) {
    const existing = await this.findEntity(tenantId, id);
    const { email, phone, cpf_cnpj, expectedUpdatedAt, ...rest } =
      canonicalizeClientInput(dto, { update: true }) as unknown as Record<string, unknown>;
    const updates: Record<string, unknown> = {
      ...this.toColumns(rest),
      updated_at: new Date(),
      updated_by: userId,
    };
    // CT-D3: an edit merges its metadata keys into the stored object (same rule
    // as artists) — it never replaces keys it did not send (lead conversion
    // keys, historical copies awaiting the BLK-CRM-PII-PLAINTEXT backfill).
    if (updates['metadata'] !== undefined) {
      updates['metadata'] = { ...(existing.metadata ?? {}), ...(updates['metadata'] as Record<string, unknown>) };
    }
    if (email    !== undefined) updates['email_encrypted']    = this.enc.encryptNullable(email as string | null);
    if (phone    !== undefined) updates['phone_encrypted']    = this.enc.encryptNullable(phone as string | null);
    if (cpf_cnpj !== undefined) updates['cpf_cnpj_encrypted'] = this.enc.encryptNullable(cpf_cnpj as string | null);
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt as string | undefined,
      'Este cliente foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    await this.recordActivity(tenantId, userId, id, 'updated', 'Cliente atualizado', {
      fields: Object.keys(updates).filter((k) => k !== 'updated_at' && k !== 'updated_by'),
    });
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string, userId?: string) {
    await this.findById(tenantId, id);
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    if (userId) await this.recordActivity(tenantId, userId, id, 'removed', 'Cliente removido', {});
    return { deleted: true };
  }

  // ── Timeline (Part 80) ───────────────────────────────────────────────────────
  // Reuses activity_logs (real, tenant-scoped, already used by LeadsService
  // for the same purpose) instead of creating a parallel table — avoids
  // duplicating the same kind of event in two uncorrelated sources.

  async getTimeline(tenantId: string, id: string, limit = 50) {
    await this.findById(tenantId, id);
    if (!this.activityLogs) return [];
    return this.activityLogs.list(tenantId, { entityType: TIMELINE_ENTITY_TYPE, entityId: id, limit });
  }

  /** Manual timeline entry (note, call, meeting, etc). Client creation/editing/
   * removal already records events automatically via recordActivity. */
  async addTimelineEntry(
    tenantId: string,
    userId: string,
    id: string,
    input: { type: string; description: string },
  ) {
    await this.findById(tenantId, id);
    if (!this.activityLogs) throw new ServiceUnavailableException('O histórico do cliente está indisponível no momento. Tente novamente mais tarde.');
    return this.activityLogs.create(tenantId, userId, {
      entity_type: TIMELINE_ENTITY_TYPE,
      entity_id: id,
      action: canonicalClientTimelineType(input.type) as string,
      description: input.description,
      metadata: {},
    });
  }

  private async recordActivity(
    tenantId: string,
    userId: string,
    clientId: string,
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ) {
    if (!this.activityLogs) return;
    try {
      await this.activityLogs.create(tenantId, userId, {
        entity_type: TIMELINE_ENTITY_TYPE,
        entity_id: clientId,
        action,
        description,
        metadata,
      });
    } catch {
      // The timeline is auxiliary — a failure to record must not bring down the client's
      // real operation (same pattern as LeadsService.recordActivity).
    }
  }

  // ── Linked contracts (Part 80) ───────────────────────────────────────────────
  // Reuses the already existing physical relation (contracts.client_id) — no
  // new join table.

  async getContracts(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.repo!.manager.query(
      `SELECT id, title, type, status, fixed_value, start_date, end_date, created_at
         FROM contracts
        WHERE tenant_id = $1 AND client_id = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [tenantId, id],
    );
  }

  // ── Attachments (Part 80) ────────────────────────────────────────────────────
  // Real metadata in client_attachments; binary only in R2 (StorageService).
  // Without R2 configured, presign() fails explicitly (503 R2_NOT_CONFIGURED)
  // instead of fabricating success — see StorageService.getClient().

  async listAttachments(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    const rows = await this.attachmentsRepo!
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId AND a.client_id = :id AND a.deleted_at IS NULL', { tenantId, id })
      .orderBy('a.created_at', 'DESC')
      .getMany();
    return rows;
  }

  async presignAttachmentUpload(
    tenantId: string,
    userId: string,
    id: string,
    input: { fileName: string; mimeType: string; sizeBytes: number },
  ) {
    await this.findById(tenantId, id);
    if (!this.storage) throw new ServiceUnavailableException('O armazenamento de arquivos está indisponível no momento. Tente novamente mais tarde.');
    return this.storage.createPresignedUpload({
      tenantId,
      userId,
      category: ATTACHMENT_CATEGORY,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      entity: TIMELINE_ENTITY_TYPE,
      entityId: id,
    });
  }

  /** Confirms that the direct upload to R2 (via presigned URL) finished and
   * persists the metadata. Never receives nor writes the binary. */
  async confirmAttachmentUpload(
    tenantId: string,
    userId: string,
    id: string,
    input: { storageKey: string; filename: string; mimeType: string; sizeBytes: number; checksum?: string },
  ) {
    await this.findById(tenantId, id);
    if (!input.storageKey.startsWith(`tenants/${tenantId}/`)) {
      throw new BadRequestException('O arquivo informado não pertence a este workspace.');
    }
    const entity = this.attachmentsRepo!.create({
      id: randomUUID(),
      tenant_id: tenantId,
      client_id: id,
      storage_key: input.storageKey,
      filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      checksum: input.checksum ?? null,
      uploaded_by: userId,
    } as Partial<ClientAttachmentEntity>);
    const saved = await this.attachmentsRepo!.save(entity as ClientAttachmentEntity);
    await this.recordActivity(tenantId, userId, id, 'attachment_uploaded', `Anexo "${input.filename}" enviado`, {
      attachmentId: saved.id,
    });
    return saved;
  }

  async removeAttachment(tenantId: string, userId: string, id: string, attachmentId: string) {
    const attachment = await this.attachmentsRepo!
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId AND a.client_id = :id AND a.id = :attachmentId AND a.deleted_at IS NULL', { tenantId, id, attachmentId })
      .getOne();
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    await this.attachmentsRepo!.update({ id: attachmentId, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    if (this.storage) {
      try {
        await this.storage.delete(attachment.storage_key);
      } catch {
        // Metadata already marked as removed; a failure to delete from R2 stays only in the StorageService log.
      }
    }
    await this.recordActivity(tenantId, userId, id, 'attachment_removed', `Anexo "${attachment.filename}" removido`, {
      attachmentId,
    });
    return { deleted: true };
  }

  /** category/profile are NOT NULL in the physical table; the DTO treats both as
   * optional — explicit fallbacks instead of letting the INSERT fail with a
   * NOT NULL violation. */
  private static readonly DEFAULT_CATEGORY = 'CORPORATE_CLIENT';
  private static readonly DEFAULT_PROFILE = 'outros';

  /** Canonical DTO -> persisted columns (only the keys sent; `undefined` = untouched). */
  private toColumns(input: Record<string, unknown>, isCreate = false): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    for (const column of CLIENT_COLUMNS) {
      if (input[column] !== undefined) mapped[column] = input[column] === '' ? null : input[column];
    }
    if (input['metadata'] !== undefined) mapped['metadata'] = input['metadata'];
    if (isCreate) {
      mapped['category'] = mapped['category'] ?? ClientsService.DEFAULT_CATEGORY;
      mapped['profile'] = mapped['profile'] ?? ClientsService.DEFAULT_PROFILE;
    } else {
      // NOT NULL columns: a null in a PATCH is ignored instead of failing the UPDATE.
      for (const column of ['name', 'category', 'profile', 'person_type', 'status']) {
        if (mapped[column] === null) delete mapped[column];
      }
    }
    return mapped;
  }
}
