import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ArtistEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import {
  REPORT_FORM_CONTRACTS,
  contractEncryptedFields,
  contractLegacyPlaintextColumns,
} from '../reports/form-contracts/report-form-contracts';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { safeOrderBy } from '../../common/utils/safe-order-by';
import type { CreateArtistDto } from './dto/create-artist.dto';
import type { UpdateArtistDto } from './dto/update-artist.dto';
import type { QueryArtistDto }  from './dto/query-artist.dto';
import { ArtistStatus, ArtistRelationshipType } from '@music-os-360/types';
import { ARTIST_METADATA_ONLY_FIELDS, assertArtistSpecialtiesInClosedList, canonicalizeArtistInput, canonicalizeArtistQuery } from './artist-legacy-fields';
import { sanitizeArtistMetadataInput } from './artist-input-sanitizer';

/** Contract statuses treated as "active" for artist-relationship classification
 * (relationship/relationshipStats). Contract status values are English since the
 * ContractStatus migration (packages/types/src/enums.ts) — see
 * `apps/api/src/database/migrations/20260910000010_BackfillAndRestrictContractStatusToEnglish.ts`.
 */
const ACTIVE_CONTRACT_STATUSES_SQL = `('active','signed','in_force','expiring')`;

// ── Single source of the DTO ↔ entity column mapping (CZ-042) ────────────────
// Every form field has its own physical column (product rule 2026-07-12); the
// request key is the column name. `metadata` keeps only the metadata-only
// fields (ARTIST_METADATA_ONLY_FIELDS).
// NOT NULL columns: null in a PATCH is ignored (never overwritten with null).
const REQUIRED_COLUMNS = ['stage_name', 'status'] as const;

// Nullable columns: `undefined` = leave untouched; `null`/value = persist exactly.
const NULLABLE_COLUMNS = [
  'full_name', 'music_genre', 'notes', 'photo_url', 'personal_documents_url', 'press_kit_url',
  'spotify_url', 'youtube_url', 'soundcloud_url', 'apple_music_url', 'deezer_url',
  'profile_type', 'internal_notes', 'contract_id', 'artist_slug', 'career_stage',
  'agent_id', 'agent_name', 'agent_phone', 'agent_email',
  'record_label_id', 'record_label_name', 'record_label_phone', 'record_label_email',
  'record_label_contact_id', 'record_label_contact_name', 'record_label_contact_phone', 'record_label_contact_email',
  'manager_name', 'executive_producer', 'booking_agency', 'partner_label',
  // nullable jsonb
  'linked_contacts', 'general_distributors', 'music_tags', 'relationships',
  'selected_distributors', 'distributor_emails', 'company_selected_distributors', 'company_distributor_emails',
  'team_contacts',
] as const;

// Typed (date/uuid) columns: an empty string means "no value" (the form sends
// '' for a blank input) — persisted as null instead of failing the cast.
const EMPTY_AS_NULL_COLUMNS = new Set<string>(['contract_id']);

// jsonb NOT NULL DEFAULT [] columns: null becomes an empty list.
const JSONB_LIST_COLUMNS = ['gallery_urls', 'documents', 'specialties'] as const;

// SINGLE SOURCE: the sets of encrypted and metadata fields derive from the
// central Reports contract (form-contracts) — the same one used by
// export/import.
const ENCRYPTED_FIELDS = new Set(Object.keys(contractEncryptedFields(REPORT_FORM_CONTRACTS.artists)));

// BLK-CRM-PII-PLAINTEXT: personal/bank fields that used to be plaintext columns (birth_date, rg, address, bank_*,
// pix_key, account_holder). They are ENCRYPTED_FIELDS too (`<field>_encrypted`); the plaintext column of the same
// name is never written again (null on every write of the field) and only read as a dual-read fallback.
const LEGACY_PLAINTEXT_FIELDS: readonly string[] = Object.keys(contractLegacyPlaintextColumns(REPORT_FORM_CONTRACTS.artists));

const METADATA_FIELDS: ReadonlySet<string> = new Set(ARTIST_METADATA_ONLY_FIELDS);

const columnValue = (column: string, value: unknown): unknown =>
  EMPTY_AS_NULL_COLUMNS.has(column) && value === '' ? null : value;

/** Metadata-only fields of the response (explicit allow-list — never the whole jsonb). */
export type ArtistMetadataResponse = Partial<Record<(typeof ARTIST_METADATA_ONLY_FIELDS)[number], unknown>>;

/** Response shape: entity columns without ciphertext/raw metadata + decrypted PII + allow-listed metadata. */
type ArtistPiiField = 'birth_date' | 'rg' | 'address' | 'bank_name' | 'bank_branch' | 'bank_account' | 'pix_key' | 'account_holder';
export type ArtistResponse =
  Omit<
    ArtistEntity,
    'email_encrypted' | 'phone_encrypted' | 'cpf_cnpj_encrypted' | 'manager_contact_encrypted' | 'metadata'
    | `${ArtistPiiField}_encrypted`
  >
  & ArtistMetadataResponse
  & { email: string | null; phone: string | null; cpf_cnpj: string | null; manager_contact: string | null };

@Injectable()
export class ArtistsService {
  private readonly repo: Repository<ArtistEntity> | null = null;
  private readonly ds: DataSource | null = null;
  private readonly logger = new Logger(ArtistsService.name);

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly encryption: EncryptionService,
    private readonly events: EventsService,
    private readonly planLimit: PlanLimitService,
  ) {
    if (ds) {
      this.repo = ds.getRepository(ArtistEntity);
      this.ds = ds;
    }
  }

  /**
   * Frontend response (CZ-042): the entity columns (canonical names, no
   * ciphertext), the PII DECRYPTED under its wire names (email, phone,
   * cpf_cnpj, manager_contact) and ONLY the allow-listed metadata-only keys.
   * The raw `metadata` jsonb is never returned: it still holds the historical
   * pre-CZ-042 Portuguese keys.
   */
  private toResponse(entity: ArtistEntity): ArtistResponse {
    const {
      email_encrypted, phone_encrypted, cpf_cnpj_encrypted, manager_contact_encrypted, metadata,
      birth_date_encrypted, rg_encrypted, address_encrypted, bank_name_encrypted, bank_branch_encrypted,
      bank_account_encrypted, pix_key_encrypted, account_holder_encrypted,
      ...columns
    } = entity;
    const meta = (metadata ?? {}) as Record<string, unknown>;
    const metadataFields: Record<string, unknown> = {};
    for (const key of ARTIST_METADATA_ONLY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) metadataFields[key] = meta[key];
    }
    // Dual-read (BLK-CRM-PII-PLAINTEXT): ciphertext wins; a row not yet backfilled still answers from its plaintext column.
    const pii = {
      birth_date:     this.piiValue(birth_date_encrypted, columns.birth_date, 'birth_date'),
      rg:             this.piiValue(rg_encrypted, columns.rg, 'rg'),
      address:        this.piiValue(address_encrypted, columns.address, 'address'),
      bank_name:      this.piiValue(bank_name_encrypted, columns.bank_name, 'bank_name'),
      bank_branch:    this.piiValue(bank_branch_encrypted, columns.bank_branch, 'bank_branch'),
      bank_account:   this.piiValue(bank_account_encrypted, columns.bank_account, 'bank_account'),
      pix_key:        this.piiValue(pix_key_encrypted, columns.pix_key, 'pix_key'),
      account_holder: this.piiValue(account_holder_encrypted, columns.account_holder, 'account_holder'),
    };
    return {
      ...columns,
      ...metadataFields,
      ...pii,
      email:           this.safeDecrypt(email_encrypted, 'email'),
      phone:           this.safeDecrypt(phone_encrypted, 'phone'),
      cpf_cnpj:        this.safeDecrypt(cpf_cnpj_encrypted, 'cpf_cnpj'),
      manager_contact: this.safeDecrypt(manager_contact_encrypted, 'manager_contact'),
    };
  }

  /** Ciphertext column first, legacy plaintext column as fallback; unreadable ciphertext never leaks a raw value. */
  private piiValue(ciphertext: string | null, legacyPlaintext: string | null, field: string): string | null {
    if (ciphertext != null && ciphertext !== '') return this.safeDecrypt(ciphertext, field);
    return legacyPlaintext ?? null;
  }

  /** Unreadable ciphertext (rotated key/legacy value) never breaks the read. */
  private safeDecrypt(value: string | null, field: string): string | null {
    try {
      return this.encryption.decryptNullable(value);
    } catch {
      this.logger.warn(`Failed to decrypt field "${field}" — returning null`);
      return null;
    }
  }

  async list(tenantId: string, rawQuery: QueryArtistDto) {
    const query = canonicalizeArtistQuery(rawQuery);
    const qb = this.repo!
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL');

    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.genre)  qb.andWhere('a.music_genre = :genre', { genre: query.genre });
    if (query.search) {
      qb.andWhere('(a.stage_name ILIKE :search OR a.full_name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    // Same classification as relationshipStats() (see there for the full explanation)
    // — here as a WHERE filter instead of an aggregation, so the paginated table
    // and the KPIs agree on "who is exclusive/partner/independent" (Task H:
    // Artistas.tsx used to filter this on the client).
    const relationship = query.relationship ?? query.vinculo;
    if (relationship === ArtistRelationshipType.EXCLUSIVE) {
      qb.andWhere(`EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusive = true
      )`);
    } else if (relationship === ArtistRelationshipType.PARTNER) {
      qb.andWhere(`EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
      )`).andWhere(`NOT EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusive = true
      )`);
    } else if (relationship === ArtistRelationshipType.INDEPENDENT) {
      qb.andWhere(`NOT EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
      )`);
    }

    // find-924ed503: query.orderBy is client-supplied free text (PaginationDto);
    // TypeORM's QueryBuilder.orderBy() concatenates the column expression
    // directly into SQL (columns aren't parameterizable) -- an unvalidated
    // value here is a SQL injection vector. Same allow-list pattern already
    // used by marketing-projects/contents/assets services.
    const orderField = safeOrderBy(
      query.orderBy,
      ['stage_name', 'status', 'registration_status', 'created_at', 'updated_at'],
      'created_at',
    );
    qb.orderBy(`a.${orderField}`, query.ascending ? 'ASC' : 'DESC')
      .addOrderBy('a.id', 'ASC') // deterministic paging for offset sweeps
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    const relationshipById = await this.relationshipByArtistIds(tenantId, data.map((e) => e.id));
    return {
      data: data.map((e) => ({ ...this.toResponse(e), relationship: relationshipById[e.id] ?? ArtistRelationshipType.INDEPENDENT })),
      meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 },
    };
  }

  /** Contract type per artist, restricted to the given IDs (e.g. only the current
   * page — never the whole tenant) — same classification as relationshipStats(). */
  private async relationshipByArtistIds(tenantId: string, artistIds: string[]): Promise<Record<string, ArtistRelationshipType.EXCLUSIVE | ArtistRelationshipType.PARTNER>> {
    if (artistIds.length === 0) return {};
    const rows = await this.ds!.query<Array<{ artist_id: string; exclusive: boolean }>>(
      `
      SELECT DISTINCT ON (c.artist_id) c.artist_id, bool_or(c.exclusive) OVER (PARTITION BY c.artist_id) AS exclusive
      FROM contracts c
      WHERE c.tenant_id = $1 AND c.deleted_at IS NULL AND c.artist_id = ANY($2::uuid[])
        AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
      `,
      [tenantId, artistIds],
    );
    const result: Record<string, ArtistRelationshipType.EXCLUSIVE | ArtistRelationshipType.PARTNER> = {};
    for (const r of rows) {
      result[r.artist_id] = r.exclusive ? ArtistRelationshipType.EXCLUSIVE : ArtistRelationshipType.PARTNER;
    }
    return result;
  }

  /**
   * Exact KPIs over the WHOLE TENANT (not the current page) — Task H.
   *
   * `relationship` reproduces exactly the classification the frontend used to do on
   * the client (the removed Artists page relationship classifier; now `relationshipStats()`): an artist is "exclusive" if it
   * has any active/signed/in-force/expiring contract with exclusive=true;
   * "partner" if it has any such contract that is not exclusive; otherwise
   * "independent". Before: it downloaded whole artists AND contracts and
   * cross-referenced them on the client. Now: a single aggregate query.
   */
  async relationshipStats(tenantId: string): Promise<{ exclusive: number; partner: number; independent: number; total: number }> {
    const rows = await this.ds!.query<Array<{ relationship: string; cnt: string }>>(
      `
      SELECT relationship, COUNT(*)::int AS cnt FROM (
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1 FROM contracts c
              WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id AND c.deleted_at IS NULL
                AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusive = true
            ) THEN '${ArtistRelationshipType.EXCLUSIVE}'
            WHEN EXISTS (
              SELECT 1 FROM contracts c
              WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id AND c.deleted_at IS NULL
                AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
            ) THEN '${ArtistRelationshipType.PARTNER}'
            ELSE '${ArtistRelationshipType.INDEPENDENT}'
          END AS relationship
        FROM artists a
        WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
      ) x
      GROUP BY relationship
      `,
      [tenantId],
    );
    const byRelationship: Record<string, number> = {
      [ArtistRelationshipType.EXCLUSIVE]: 0,
      [ArtistRelationshipType.PARTNER]: 0,
      [ArtistRelationshipType.INDEPENDENT]: 0,
    };
    let total = 0;
    for (const r of rows) {
      const cnt = parseInt(r.cnt, 10) || 0;
      byRelationship[r.relationship] = cnt;
      total += cnt;
    }
    return {
      exclusive: byRelationship[ArtistRelationshipType.EXCLUSIVE],
      partner: byRelationship[ArtistRelationshipType.PARTNER],
      independent: byRelationship[ArtistRelationshipType.INDEPENDENT],
      total,
    };
  }

  /** The tenant's distinct music genres (for the filter dropdown) — without
   * downloading whole artists just to extract unique values of one column. */
  async distinctMusicGenres(tenantId: string): Promise<string[]> {
    const rows = await this.ds!.query<Array<{ music_genre: string }>>(
      `SELECT DISTINCT music_genre FROM artists WHERE tenant_id = $1 AND deleted_at IS NULL AND music_genre IS NOT NULL ORDER BY music_genre`,
      [tenantId],
    );
    return rows.map((r) => r.music_genre).filter(Boolean);
  }

  async findById(tenantId: string, id: string): Promise<ArtistEntity> {
    const result = await this.repo!
      .createQueryBuilder('a')
      .where('a.id = :id AND a.tenant_id = :tenantId AND a.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Artista não encontrado');
    return result;
  }

  async findByIdForResponse(tenantId: string, id: string) {
    return this.toResponse(await this.findById(tenantId, id));
  }

  async create(tenantId: string, userId: string, dto: CreateArtistDto, orgId?: string): Promise<ArtistResponse> {
    const input = this.canonicalInput(dto as unknown as Record<string, unknown>);
    const stageName = typeof input.stage_name === 'string' ? input.stage_name.trim() : '';
    if (!stageName) {
      throw new BadRequestException('Informe o nome artístico.');
    }
    await this.planLimit.enforce(tenantId, orgId ?? tenantId, 'artists');
    await this.assertContractInTenant(tenantId, input.contract_id);

    const data: Record<string, unknown> = {
      tenant_id:  tenantId,
      stage_name: input.stage_name,
      status:     input.status ?? ArtistStatus.IN_NEGOTIATION,
      created_by: userId,
      updated_by: userId,
    };
    for (const col of NULLABLE_COLUMNS) data[col] = columnValue(col, input[col]) ?? null;
    for (const col of JSONB_LIST_COLUMNS) data[col] = input[col] ?? [];
    for (const field of ENCRYPTED_FIELDS) {
      data[`${field}_encrypted`] = this.encryption.encryptNullable(input[field] as string | null | undefined);
    }
    const metadataExtras: Record<string, unknown> = {};
    for (const field of METADATA_FIELDS) {
      if (input[field] !== undefined) metadataExtras[field] = input[field];
    }
    data.metadata = { ...((input.metadata as Record<string, unknown> | undefined) ?? {}), ...metadataExtras };

    const entity = this.repo!.create(data as Partial<ArtistEntity>);
    const saved = await this.repo!.save(entity);

    this.events.emitTyped(DOMAIN_EVENTS.ARTIST_CREATED, {
      tenantId,
      userId,
      aggregateType: 'artist',
      aggregateId:   saved.id,
      payload: {
        artistId:  saved.id,
        tenantId,
        stageName: saved.stage_name,
        status:    saved.status,
        createdBy: userId,
      },
    });

    return this.toResponse(saved);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateArtistDto): Promise<ArtistResponse> {
    const existing = await this.findById(tenantId, id);
    const input = this.canonicalInput(dto as unknown as Record<string, unknown>, { update: true });
    // contract_id had no ownership check — an artist could reference another tenant's contract.
    await this.assertContractInTenant(tenantId, input.contract_id);

    // ── Status transition validation ───────────────────────────────────────────
    const newStatus = input.status as ArtistStatus | undefined;
    const statusChanging = newStatus != null && newStatus !== existing.status;
    if (statusChanging) {
      this.validateStatusTransition(existing, input, newStatus);
    }

    const updates: Record<string, unknown> = { updated_at: new Date(), updated_by: userId };
    const changedFields: string[] = [];

    // Direct columns, driven by the canonical lists (single source):
    // NOT NULL ignore null; nullable persist exactly what came (null clears);
    // NOT NULL jsonb lists normalize null → [].
    for (const col of REQUIRED_COLUMNS) {
      if (input[col] != null) { updates[col] = input[col]; changedFields.push(col); }
    }
    for (const col of NULLABLE_COLUMNS) {
      if (input[col] !== undefined) { updates[col] = columnValue(col, input[col]) ?? null; changedFields.push(col); }
    }
    for (const col of JSONB_LIST_COLUMNS) {
      if (input[col] !== undefined) { updates[col] = input[col] ?? []; changedFields.push(col); }
    }

    // Encrypted fields (wire name + _encrypted suffix, uniform for every encrypted field)
    for (const field of ENCRYPTED_FIELDS) {
      if (input[field] !== undefined) {
        updates[`${field}_encrypted`] = this.encryption.encryptNullable(input[field] as string | null);
        // The plaintext column of a moved field never keeps a copy once the field is written (this row only).
        if (LEGACY_PLAINTEXT_FIELDS.includes(field)) updates[field] = null;
        changedFields.push(field);
      }
    }

    // Metadata-only fields
    const metadataExtras: Record<string, unknown> = {};
    for (const field of METADATA_FIELDS) {
      if (input[field] !== undefined) {
        metadataExtras[field] = input[field];
        changedFields.push(field);
      }
    }
    const metadataInput = input.metadata as Record<string, unknown> | null | undefined;
    if (Object.keys(metadataExtras).length > 0 || metadataInput != null) {
      updates.metadata = {
        ...(existing.metadata ?? {}),
        ...(metadataInput ?? {}),
        ...metadataExtras,
      };
    }

    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      input.expectedUpdatedAt as string | undefined,
      'Este artista foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    const result = await this.findById(tenantId, id);

    // ── Domain events ──────────────────────────────────────────────────────────
    if (changedFields.length > 0) {
      this.events.emitTyped(DOMAIN_EVENTS.ARTIST_UPDATED, {
        tenantId,
        userId,
        aggregateType: 'artist',
        aggregateId:   id,
        payload: {
          artistId:  id,
          tenantId,
          stageName: result.stage_name,
          changedFields,
          updatedBy: userId,
        },
      });
    }

    // Status change gets its own dedicated event for fine-grained handlers
    if (statusChanging) {
      this.events.emitTyped(DOMAIN_EVENTS.ARTIST_STATUS_CHANGED, {
        tenantId,
        userId,
        aggregateType: 'artist',
        aggregateId:   id,
        payload: {
          artistId:       id,
          tenantId,
          stageName:      result.stage_name,
          previousStatus: existing.status,
          newStatus,
          changedBy:      userId,
        },
      });
    }

    return this.toResponse(result);
  }

  async softDelete(tenantId: string, userId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as any,
      { deleted_at: new Date(), updated_by: userId } as any,
    );

    this.events.emitTyped(DOMAIN_EVENTS.ARTIST_DELETED, {
      tenantId,
      userId,
      aggregateType: 'artist',
      aggregateId:   id,
      payload: {
        artistId:  id,
        tenantId,
        stageName: existing.stage_name,
        deletedBy: userId,
      },
    });

    return { deleted: true };
  }

  /**
   * Canonical request body (CZ-042 legacy names/values mapped) with the
   * caller-supplied `metadata` stripped of every allow-listed response key
   * that fails its DTO rule (SEC-F1: no `javascript:` link through metadata).
   */
  private canonicalInput(dto: Record<string, unknown>, options: { update?: boolean } = {}): Record<string, unknown> {
    const input = canonicalizeArtistInput(dto, options);
    assertArtistSpecialtiesInClosedList(input.specialties);
    if (input.metadata !== undefined) input.metadata = sanitizeArtistMetadataInput(input.metadata);
    return input;
  }

  /**
   * The linked contract must be a live (not soft-deleted) contract of the SAME
   * tenant — the tenant id is bound as a parameter, never inferred.
   */
  private async assertContractInTenant(tenantId: string, contractId: unknown): Promise<void> {
    if (contractId === undefined || contractId === null || contractId === '') return;
    const rows = await this.ds!.query(
      `SELECT 1 FROM "contracts" WHERE "id" = $1 AND "tenant_id" = $2 AND "deleted_at" IS NULL LIMIT 1`,
      [contractId, tenantId],
    ) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Contrato não encontrado neste workspace.');
    }
  }

  // ── Lifecycle validation ─────────────────────────────────────────────────────

  private validateStatusTransition(existing: ArtistEntity, input: Record<string, unknown>, newStatus: ArtistStatus): void {
    if (newStatus === ArtistStatus.ACTIVE) {
      const genre    = input.music_genre ?? existing.music_genre;
      const hasEmail = input.email != null || existing.email_encrypted != null;
      const hasPhone = input.phone != null || existing.phone_encrypted != null;

      const errors: string[] = [];
      if (!genre)                 errors.push('Gênero musical obrigatório para ativar o artista');
      if (!hasEmail && !hasPhone) errors.push('Informe e-mail ou telefone para ativar o artista');

      // Same wire shape as the global ValidationPipe: stable code + PT-BR message list.
      if (errors.length > 0) throw new BadRequestException({ statusCode: 400, error: 'VALIDATION_FAILED', message: errors });
    }

    // signed: a contract must be linked in the update or already exist
    if (newStatus === ArtistStatus.SIGNED) {
      const contractId = columnValue('contract_id', input.contract_id) ?? existing.contract_id;
      if (!contractId) {
        throw new BadRequestException('Vincule um contrato para marcar o artista como contratado.');
      }
    }
  }
}
