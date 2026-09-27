import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ArtistEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import {
  REPORT_FORM_CONTRACTS,
  contractEncryptedFields,
  contractMetadataFields,
} from '../reports/form-contracts/report-form-contracts';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { safeOrderBy } from '../../common/utils/safe-order-by';
import type { CreateArtistDto } from './dto/create-artist.dto';
import type { UpdateArtistDto } from './dto/update-artist.dto';
import type { QueryArtistDto }  from './dto/query-artist.dto';
import { ArtistStatus, ArtistRelationshipType } from '@music-os-360/types';

/** Contract statuses treated as "active" for artist-relationship classification
 * (relationship/relationshipStats). Contract status values are English since the
 * ContractStatus migration (packages/types/src/enums.ts) — see
 * `apps/api/src/database/migrations/20260910000010_BackfillAndRestrictContractStatusToEnglish.ts`.
 */
const ACTIVE_CONTRACT_STATUSES_SQL = `('active','signed','in_force','expiring')`;

// ── Single source of the DTO ↔ entity column mapping ─────────────────────────
// NOT NULL columns: null in a PATCH is ignored (never overwritten with null).
const REQUIRED_COLUMNS = ['nome_artistico', 'status'] as const;

// Nullable columns: `undefined` = leave untouched; `null`/value = persist exactly.
const NULLABLE_COLUMNS = [
  'nome_civil', 'music_genre', 'notes', 'foto_url',
  'manager_nome', 'produtor_executivo',
  'agencia_booking', 'label_parceira', 'spotify_url', 'youtube_url',
  'deezer_url', 'apple_music_url', 'soundcloud_url', 'contrato_id',
] as const;

// jsonb NOT NULL DEFAULT [] columns: null becomes an empty list.
const JSONB_LIST_COLUMNS = ['galeria_urls', 'documents', 'especialidades'] as const;

// SINGLE SOURCE: the sets of encrypted and metadata fields derive from the
// central Reports contract (form-contracts) — the same one used by
// export/import. There used to be a local list here with legacy keys
// (instagram/tiktok without _url) that made create SILENTLY DROP real form
// fields (instagram_url, tiktok_url, etc.).
const ENCRYPTED_FIELDS = new Set(Object.keys(contractEncryptedFields(REPORT_FORM_CONTRACTS.artists)));

const METADATA_FIELDS = new Set([
  ...Object.keys(contractMetadataFields(REPORT_FORM_CONTRACTS.artists)),
  // A persistable form field that is NEVER exported (internal by policy).
  'notas_internas',
]);

/** Response shape: entity without ciphertext + flattened metadata + decrypted PII. */
export type ArtistResponse =
  Omit<ArtistEntity, 'email_encrypted' | 'telefone_encrypted' | 'cpf_cnpj_encrypted' | 'manager_contato_encrypted'>
  & Record<string, unknown>;

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
   * Frontend response: spreads the metadata fields to the top level and
   * DECRYPTS the PII fields back to the names the form uses
   * (email/telefone/cpf_cnpj/manager_contato). Ciphertext never leaves the API.
   * Without this, everything saved encrypted "disappears" on reload.
   */
  private toResponse(entity: ArtistEntity): ArtistResponse {
    const meta = (entity.metadata ?? {}) as Record<string, unknown>;
    const {
      email_encrypted, telefone_encrypted: phone_encrypted, cpf_cnpj_encrypted, manager_contato_encrypted: manager_contact_encrypted,
      ...rest
    } = entity;
    return {
      ...rest,
      ...meta,
      email:           this.safeDecrypt(email_encrypted, 'email'),
      telefone:        this.safeDecrypt(phone_encrypted, 'telefone'),
      cpf_cnpj:        this.safeDecrypt(cpf_cnpj_encrypted, 'cpf_cnpj'),
      manager_contato: this.safeDecrypt(manager_contact_encrypted, 'manager_contato'),
    };
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

  async list(tenantId: string, query: QueryArtistDto) {
    const qb = this.repo!
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL');

    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.genre)  qb.andWhere('a.music_genre = :genre', { genre: query.genre });
    if (query.search) {
      qb.andWhere('(a.nome_artistico ILIKE :search OR a.nome_civil ILIKE :search)', {
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
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusivo = true
      )`);
    } else if (relationship === ArtistRelationshipType.PARTNER) {
      qb.andWhere(`EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
      )`).andWhere(`NOT EXISTS (
        SELECT 1 FROM contracts c WHERE c.artist_id = a.id AND c.tenant_id = a.tenant_id
        AND c.deleted_at IS NULL AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusivo = true
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
      ['nome_artistico', 'status', 'status_cadastro', 'created_at', 'updated_at'],
      'created_at',
    );
    qb.orderBy(`a.${orderField}`, query.ascending ? 'ASC' : 'DESC')
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
    const rows = await this.ds!.query<Array<{ artist_id: string; exclusivo: boolean }>>(
      `
      SELECT DISTINCT ON (c.artist_id) c.artist_id, bool_or(c.exclusivo) OVER (PARTITION BY c.artist_id) AS exclusivo
      FROM contracts c
      WHERE c.tenant_id = $1 AND c.deleted_at IS NULL AND c.artist_id = ANY($2::uuid[])
        AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL}
      `,
      [tenantId, artistIds],
    );
    const result: Record<string, ArtistRelationshipType.EXCLUSIVE | ArtistRelationshipType.PARTNER> = {};
    for (const r of rows) {
      result[r.artist_id] = r.exclusivo ? ArtistRelationshipType.EXCLUSIVE : ArtistRelationshipType.PARTNER;
    }
    return result;
  }

  /**
   * Exact KPIs over the WHOLE TENANT (not the current page) — Task H.
   *
   * `relationship` reproduces exactly the classification the frontend used to do on
   * the client (Artistas.tsx `classifyVinculo`, since removed): an artist is "exclusive" if it
   * has any active/signed/in-force/expiring contract with exclusivo=true;
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
                AND LOWER(c.status) IN ${ACTIVE_CONTRACT_STATUSES_SQL} AND c.exclusivo = true
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
    await this.planLimit.enforce(tenantId, orgId ?? tenantId, 'artists');

    // Collect metadata extras from dto
    const metadataExtras: Record<string, unknown> = {};
    for (const field of METADATA_FIELDS) {
      if ((dto as any)[field] !== undefined) metadataExtras[field] = (dto as any)[field];
    }

    const entity = this.repo!.create({
      tenant_id:           tenantId,
      nome_artistico:      dto.nome_artistico,
      nome_civil:          dto.nome_civil          ?? null,
      status:              dto.status ?? ArtistStatus.IN_NEGOTIATION,
      music_genre:         dto.music_genre         ?? null,
      notes:               dto.notes               ?? null,
      foto_url:            dto.foto_url            ?? null,
      galeria_urls:        (dto.galeria_urls        ?? []) as any,
      documents:          (dto.documents          ?? []) as any,
      manager_nome:        dto.manager_nome        ?? null,
      manager_contato_encrypted: this.encryption.encryptNullable(dto.manager_contato),
      produtor_executivo:  dto.produtor_executivo  ?? null,
      agencia_booking:     dto.agencia_booking     ?? null,
      label_parceira:      dto.label_parceira      ?? null,
      spotify_url:         dto.spotify_url         ?? null,
      youtube_url:         dto.youtube_url         ?? null,
      deezer_url:          dto.deezer_url          ?? null,
      apple_music_url:     dto.apple_music_url     ?? null,
      soundcloud_url:      dto.soundcloud_url      ?? null,
      contrato_id:         dto.contrato_id         ?? null,
      especialidades:      (dto.especialidades     ?? []) as any,
      metadata:            { ...(dto.metadata ?? {}), ...metadataExtras },
      email_encrypted:     this.encryption.encryptNullable(dto.email),
      telefone_encrypted:  this.encryption.encryptNullable(dto.telefone),
      cpf_cnpj_encrypted:  this.encryption.encryptNullable(dto.cpf_cnpj),
      created_by:          userId,
      updated_by:          userId,
    });
    const saved = await (this.repo!.save(entity as any) as any);

    this.events.emitTyped(DOMAIN_EVENTS.ARTIST_CREATED, {
      tenantId,
      userId,
      aggregateType: 'artist',
      aggregateId:   saved.id,
      payload: {
        artistId:      saved.id,
        tenantId,
        nomeArtistico: saved.nome_artistico,
        status:        saved.status,
        createdBy:     userId,
      },
    });

    return this.toResponse(saved);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateArtistDto): Promise<ArtistResponse> {
    const existing = await this.findById(tenantId, id);

    // ── Status transition validation ───────────────────────────────────────────
    const statusChanging = dto.status != null && dto.status !== existing.status;
    if (statusChanging) {
      this.validateStatusTransition(existing, dto);
    }

    const updates: Record<string, unknown> = { updated_at: new Date(), updated_by: userId };
    const changedFields: string[] = [];

    // Direct columns, driven by the canonical lists (single source):
    // NOT NULL ignore null; nullable persist exactly what came (null clears);
    // NOT NULL jsonb lists normalize null → [].
    const dtoRec = dto as Record<string, unknown>;
    for (const col of REQUIRED_COLUMNS) {
      if (dtoRec[col] != null) { updates[col] = dtoRec[col]; changedFields.push(col); }
    }
    for (const col of NULLABLE_COLUMNS) {
      if (dtoRec[col] !== undefined) { updates[col] = dtoRec[col] ?? null; changedFields.push(col); }
    }
    for (const col of JSONB_LIST_COLUMNS) {
      if (dtoRec[col] !== undefined) { updates[col] = dtoRec[col] ?? []; changedFields.push(col); }
    }

    // Encrypted fields (field name + _encrypted suffix, uniform for all 4)
    for (const field of ENCRYPTED_FIELDS) {
      if (dtoRec[field] !== undefined) {
        updates[`${field}_encrypted`] = this.encryption.encryptNullable(dtoRec[field] as string | null);
        changedFields.push(field);
      }
    }

    // Collect metadata-only fields
    const metadataExtras: Record<string, unknown> = {};
    for (const field of METADATA_FIELDS) {
      if ((dto as any)[field] !== undefined) {
        metadataExtras[field] = (dto as any)[field];
        changedFields.push(field);
      }
    }
    if (Object.keys(metadataExtras).length > 0 || dto.metadata != null) {
      updates.metadata = {
        ...(existing.metadata ?? {}),
        ...(dto.metadata ?? {}),
        ...metadataExtras,
      };
    }

    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      dto.expectedUpdatedAt,
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
          artistId:      id,
          tenantId,
          nomeArtistico: result.nome_artistico,
          changedFields,
          updatedBy:     userId,
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
          nomeArtistico:  result.nome_artistico,
          previousStatus: existing.status,
          newStatus:      dto.status!,
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
        artistId:      id,
        tenantId,
        nomeArtistico: existing.nome_artistico,
        deletedBy:     userId,
      },
    });

    return { deleted: true };
  }

  // ── Lifecycle validation ─────────────────────────────────────────────────────

  private validateStatusTransition(existing: ArtistEntity, dto: UpdateArtistDto): void {
    const newStatus = dto.status!;

    if (newStatus === ArtistStatus.ACTIVE) {
      const genre      = dto.music_genre ?? existing.music_genre;
      const hasEmail    = (dto as any).email    != null || existing.email_encrypted    != null;
      const hasPhone = (dto as any).telefone != null || existing.telefone_encrypted != null;

      const errors: string[] = [];
      if (!genre)                  errors.push('music_genre obrigatório para ativar artista');
      if (!hasEmail && !hasPhone) errors.push('email ou telefone obrigatório para ativar artista');

      if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    }

    // signed: contrato_id must be provided in the update or already exist
    if (newStatus === ArtistStatus.SIGNED) {
      const contractId = dto.contrato_id ?? existing.contrato_id;
      if (!contractId) {
        throw new BadRequestException('Vincule um contrato para marcar o artista como contratado.');
      }
    }
  }
}
