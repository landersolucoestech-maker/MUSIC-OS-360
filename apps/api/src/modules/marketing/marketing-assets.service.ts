import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import {
  MarketingAssetApprovalEntity,
  MarketingAssetEntity,
  MarketingAssetVersionEntity,
} from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import type { AssetAvailableForContentPayload } from '../../core/events/domain-events.types';
import type {
  CreateMarketingAssetDto,
  DecideMarketingAssetApprovalDto,
  QueryMarketingAssetDto,
  UpdateMarketingAssetDto,
} from './dto/marketing-assets.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { safeOrderBy } from '../../common/utils/safe-order-by';

@Injectable()
export class MarketingAssetsService {
  private readonly assetRepo: Repository<MarketingAssetEntity> | null;
  private readonly versionRepo: Repository<MarketingAssetVersionEntity> | null;
  private readonly approvalRepo: Repository<MarketingAssetApprovalEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    this.assetRepo = ds?.getRepository(MarketingAssetEntity) ?? null;
    this.versionRepo = ds?.getRepository(MarketingAssetVersionEntity) ?? null;
    this.approvalRepo = ds?.getRepository(MarketingAssetApprovalEntity) ?? null;
  }

  private get assets(): Repository<MarketingAssetEntity> {
    if (!this.assetRepo || !this.versionRepo || !this.approvalRepo || !this.ds) {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return this.assetRepo;
  }

  async list(tenantId: string, query: QueryMarketingAssetDto) {
    const qb = this.assets.createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL');

    if (query.search) {
      qb.andWhere('(a.title ILIKE :search OR a.description ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.assetType) qb.andWhere('a.asset_type = :assetType', { assetType: query.assetType });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.marketingProjectId) qb.andWhere('a.marketing_project_id = :marketingProjectId', { marketingProjectId: query.marketingProjectId });
    if (query.artistId) qb.andWhere('a.artist_id = :artistId', { artistId: query.artistId });
    if (query.companyId) qb.andWhere('a.company_id = :companyId', { companyId: query.companyId });
    if (query.projectId) {
      qb.leftJoin('marketing_projects', 'mp', 'mp.id = a.marketing_project_id AND mp.tenant_id = a.tenant_id')
        .andWhere(
          "((a.metadata ->> 'projectId') = :projectId OR mp.source_project_id = :projectId)",
          { projectId: query.projectId },
        );
    }
    if (query.taskId) qb.andWhere("(a.metadata ->> 'taskId') = :taskId", { taskId: query.taskId });
    if (query.sourceDepartment) {
      qb.andWhere("LOWER(a.metadata ->> 'sourceDepartment') = LOWER(:sourceDepartment)", {
        sourceDepartment: query.sourceDepartment,
      });
    }

    const orderBy = safeOrderBy(
      query.orderBy,
      ['created_at', 'updated_at', 'title', 'status', 'asset_type'],
      'updated_at',
    );
    qb.orderBy(`a.${orderBy}`, query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<MarketingAssetEntity> {
    const asset = await this.assets.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!asset) throw new NotFoundException('Marketing asset not found');
    return asset;
  }

  listProjectLibrary(tenantId: string, projectId: string, query: QueryMarketingAssetDto) {
    return this.list(tenantId, { ...query, projectId, status: query.status ?? 'approved' });
  }

  async versions(tenantId: string, assetId: string) {
    await this.findById(tenantId, assetId);
    return this.versionRepo!.find({
      where: { tenant_id: tenantId, asset_id: assetId } as never,
      order: { version: 'DESC' },
    });
  }

  async approvals(tenantId: string, assetId: string) {
    await this.findById(tenantId, assetId);
    return this.approvalRepo!.find({
      where: { tenant_id: tenantId, asset_id: assetId } as never,
      order: { requested_at: 'DESC' },
    });
  }

  /**
   * find-d0c3ebb4: marketing_project_id/artist_id/campaign_id/
   * audiovisual_project_id/source_upload_id had no cross-tenant ownership
   * check. company_id/creative_request_id are deliberately NOT checked here
   * — neither has an established backing table anywhere in this codebase
   * (no entity, no FK, no other reader), so guessing one would risk
   * encoding a wrong mapping.
   */
  private async assertLinkedFks(tenantId: string, fields: {
    marketing_project_id?: string | null; artist_id?: string | null; campaign_id?: string | null;
    audiovisual_project_id?: string | null; source_upload_id?: string | null;
  }): Promise<void> {
    await assertSameTenantFk(this.ds!, 'marketing_projects', fields.marketing_project_id ?? undefined, tenantId, 'Projeto de marketing');
    await assertSameTenantFk(this.ds!, 'artists', fields.artist_id ?? undefined, tenantId, 'Artista');
    await assertSameTenantFk(this.ds!, 'campaigns', fields.campaign_id ?? undefined, tenantId, 'Campanha');
    await assertSameTenantFk(this.ds!, 'audiovisual_projects', fields.audiovisual_project_id ?? undefined, tenantId, 'Projeto audiovisual');
    await assertSameTenantFk(this.ds!, 'uploads', fields.source_upload_id ?? undefined, tenantId, 'Upload');
  }

  async create(tenantId: string, userId: string, dto: CreateMarketingAssetDto): Promise<MarketingAssetEntity> {
    void this.assets;
    await this.assertLinkedFks(tenantId, {
      marketing_project_id: dto.marketingProjectId,
      artist_id: dto.artistId,
      campaign_id: dto.campaignId,
      audiovisual_project_id: dto.audiovisualProjectId,
      source_upload_id: dto.sourceUploadId,
    });
    return this.ds!.transaction(async (manager) => {
      const assets = manager.getRepository(MarketingAssetEntity);
      const versions = manager.getRepository(MarketingAssetVersionEntity);

      const asset = await assets.save(assets.create({
        tenant_id:              tenantId,
        marketing_project_id:   dto.marketingProjectId ?? null,
        artist_id:              dto.artistId ?? null,
        company_id:             dto.companyId ?? null,
        campaign_id:            dto.campaignId ?? null,
        creative_request_id:    dto.creativeRequestId ?? null,
        audiovisual_project_id: dto.audiovisualProjectId ?? null,
        source_upload_id:       dto.sourceUploadId ?? null,
        title:                  dto.title,
        description:            dto.description ?? null,
        asset_type:             dto.assetType,
        status:                 'draft',
        current_version:        1,
        file_url:               dto.fileUrl,
        thumbnail_url:          dto.thumbnailUrl ?? null,
        mime_type:              dto.mimeType ?? null,
        size_bytes:             dto.sizeBytes ?? null,
        tags:                   dto.tags ?? [],
        metadata:               this.buildAssetMetadata(dto),
        created_by:             userId,
        updated_by:             userId,
      } as Partial<MarketingAssetEntity>));

      const version = await versions.save(versions.create({
        tenant_id:      tenantId,
        asset_id:       asset.id,
        version:        1,
        status:         'draft',
        file_url:       dto.fileUrl,
        thumbnail_url:  dto.thumbnailUrl ?? null,
        mime_type:      dto.mimeType ?? null,
        size_bytes:     dto.sizeBytes ?? null,
        change_notes:   'Initial version',
        metadata:       this.buildAssetMetadata(dto),
        created_by:     userId,
      } as Partial<MarketingAssetVersionEntity>));

      await assets.update({ id: asset.id, tenant_id: tenantId } as never, { current_version_id: version.id } as never);
      return this.findById(tenantId, asset.id);
    });
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateMarketingAssetDto): Promise<MarketingAssetEntity> {
    const current = await this.findById(tenantId, id);
    // find-d0c3ebb4: buildMetadataPatch() persists these FK fields on
    // update() too — only validate when the patch actually sets them
    // (undefined means "unchanged", already validated at create time).
    await this.assertLinkedFks(tenantId, {
      marketing_project_id: dto.marketingProjectId,
      artist_id: dto.artistId,
      campaign_id: dto.campaignId,
      audiovisual_project_id: dto.audiovisualProjectId,
      source_upload_id: dto.sourceUploadId,
    });
    const incomingFileUrl = dto.fileUrl ?? current.file_url;
    if (!incomingFileUrl) throw new BadRequestException('fileUrl is required');

    const fileChanged = Boolean(dto.fileUrl && dto.fileUrl !== current.file_url);
    if (current.status === 'approved' && !fileChanged) {
      const patch = this.buildMetadataPatch(dto, userId, current.metadata ?? {});
      await casUpdate(
        this.assets,
        { id, tenant_id: tenantId } as never,
        patch as never,
        dto.expectedUpdatedAt,
        'Este asset de marketing foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
      );
      return this.findById(tenantId, id);
    }

    if (current.status === 'approved' && fileChanged) {
      return this.createNewVersionFromApprovedAsset(tenantId, userId, current, dto);
    }

    const patch = {
      ...this.buildMetadataPatch(dto, userId, current.metadata ?? {}),
      file_url:      incomingFileUrl,
      thumbnail_url: dto.thumbnailUrl ?? current.thumbnail_url,
      mime_type:     dto.mimeType ?? current.mime_type,
      size_bytes:    dto.sizeBytes ?? current.size_bytes,
      status:        current.status === 'rejected' ? 'draft' : current.status,
    };
    await casUpdate(
      this.assets,
      { id, tenant_id: tenantId } as never,
      patch as never,
      dto.expectedUpdatedAt,
      'Este asset de marketing foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );

    if (fileChanged && current.current_version_id) {
      await this.versionRepo!.update(
        { id: current.current_version_id, tenant_id: tenantId } as never,
        {
          file_url:      incomingFileUrl,
          thumbnail_url: dto.thumbnailUrl ?? current.thumbnail_url,
          mime_type:     dto.mimeType ?? current.mime_type,
          size_bytes:    dto.sizeBytes ?? current.size_bytes,
          change_notes:  dto.changeNotes ?? null,
        } as never,
      );
    }

    return this.findById(tenantId, id);
  }

  async requestApproval(tenantId: string, userId: string, id: string): Promise<MarketingAssetApprovalEntity> {
    const asset = await this.findById(tenantId, id);
    if (!asset.current_version_id) throw new BadRequestException('Asset has no current version');
    if (asset.status === 'approved') throw new BadRequestException('Approved asset is already available');
    if (asset.status === 'archived') throw new BadRequestException('Archived asset cannot be reviewed');

    await this.assets.update({ id, tenant_id: tenantId } as never, { status: 'in_review', updated_by: userId } as never);
    await this.versionRepo!.update(
      { id: asset.current_version_id, tenant_id: tenantId } as never,
      { status: 'in_review' } as never,
    );

    return this.approvalRepo!.save(this.approvalRepo!.create({
      tenant_id:    tenantId,
      asset_id:     id,
      version_id:   asset.current_version_id,
      status:       'pending',
      requested_by: userId,
      metadata:     {},
    } as Partial<MarketingAssetApprovalEntity>));
  }

  async decideApproval(
    tenantId: string,
    userId: string,
    approvalId: string,
    dto: DecideMarketingAssetApprovalDto,
  ): Promise<MarketingAssetApprovalEntity> {
    void this.assets;
    const approval = await this.approvalRepo!.findOne({ where: { id: approvalId, tenant_id: tenantId } as never });
    if (!approval) throw new NotFoundException('Marketing asset approval not found');
    if (approval.status !== 'pending') throw new BadRequestException('Approval already decided');

    const nextAssetStatus = dto.status === 'approved' ? 'approved' : 'rejected';
    const decidedAt = new Date();
    // Guarda status='pending' na PRÓPRIA condição do UPDATE (não só no
    // pre-check acima) — fecha a janela entre a leitura e este UPDATE em que
    // duas decisões concorrentes poderiam sobrescrever uma à outra
    // silenciosamente. Esta entidade não tem updated_at gerenciado, então o
    // próprio status é o guard de concorrência otimista aqui.
    const decisionResult = await this.approvalRepo!.update(
      { id: approvalId, tenant_id: tenantId, status: 'pending' } as never,
      {
        status:     dto.status,
        decided_by: userId,
        decided_at: decidedAt,
        comments:   dto.comments ?? null,
        metadata:   dto.metadata ?? {},
      } as never,
    );
    if (decisionResult.affected === 0) {
      throw new ConflictException('Esta aprovação já foi decidida por outro usuário. Recarregue e tente novamente.');
    }
    await this.versionRepo!.update(
      { id: approval.version_id, tenant_id: tenantId } as never,
      { status: nextAssetStatus } as never,
    );
    await this.assets.update(
      { id: approval.asset_id, tenant_id: tenantId } as never,
      {
        status: nextAssetStatus,
        approved_at: dto.status === 'approved' ? decidedAt : null,
        approved_by: dto.status === 'approved' ? userId : null,
        updated_by: userId,
      } as never,
    );

    if (dto.status === 'approved') {
      const asset = await this.findById(tenantId, approval.asset_id);
      const payload: AssetAvailableForContentPayload = {
        assetId:            asset.id,
        versionId:          approval.version_id,
        tenantId,
        marketingProjectId: asset.marketing_project_id,
        assetType:          asset.asset_type,
        approvedBy:         userId,
        approvedAt:         decidedAt.toISOString(),
      };
      this.events.emitTyped(DOMAIN_EVENTS.ASSET_AVAILABLE_FOR_CONTENT, {
        tenantId,
        userId,
        aggregateType: 'marketing_asset',
        aggregateId: asset.id,
        payload,
      });
    }

    return this.approvalRepo!.findOneOrFail({ where: { id: approvalId, tenant_id: tenantId } as never });
  }

  async archive(tenantId: string, userId: string, id: string) {
    await this.findById(tenantId, id);
    await this.assets.update({ id, tenant_id: tenantId } as never, {
      status: 'archived',
      deleted_at: new Date(),
      updated_by: userId,
    } as never);
    return { ok: true };
  }

  private async createNewVersionFromApprovedAsset(
    tenantId: string,
    userId: string,
    current: MarketingAssetEntity,
    dto: UpdateMarketingAssetDto,
  ): Promise<MarketingAssetEntity> {
    return this.ds!.transaction(async (manager) => {
      const assets = manager.getRepository(MarketingAssetEntity);
      const versions = manager.getRepository(MarketingAssetVersionEntity);
      const nextVersion = current.current_version + 1;
      const version = await versions.save(versions.create({
        tenant_id:      tenantId,
        asset_id:       current.id,
        version:        nextVersion,
        status:         'draft',
        file_url:       dto.fileUrl!,
        thumbnail_url:  dto.thumbnailUrl ?? current.thumbnail_url,
        mime_type:      dto.mimeType ?? current.mime_type,
        size_bytes:     dto.sizeBytes ?? current.size_bytes,
        change_notes:   dto.changeNotes ?? null,
        metadata:       this.buildAssetMetadata(dto, current.metadata ?? {}),
        created_by:     userId,
      } as Partial<MarketingAssetVersionEntity>));

      await assets.update({ id: current.id, tenant_id: tenantId } as never, {
        ...this.buildMetadataPatch(dto, userId, current.metadata ?? {}),
        status:             'draft',
        current_version:    nextVersion,
        current_version_id: version.id,
        file_url:           dto.fileUrl,
        thumbnail_url:      dto.thumbnailUrl ?? current.thumbnail_url,
        mime_type:          dto.mimeType ?? current.mime_type,
        size_bytes:         dto.sizeBytes ?? current.size_bytes,
        approved_at:        null,
        approved_by:        null,
      } as never);

      return this.findById(tenantId, current.id);
    });
  }

  private buildMetadataPatch(
    dto: UpdateMarketingAssetDto,
    userId: string,
    baseMetadata: Record<string, unknown> = {},
  ): Partial<MarketingAssetEntity> {
    const metadataChanged =
      dto.metadata !== undefined ||
      dto.projectId !== undefined ||
      dto.taskId !== undefined ||
      dto.sourceDepartment !== undefined;

    return {
      title:                  dto.title,
      description:            dto.description,
      asset_type:             dto.assetType,
      marketing_project_id:   dto.marketingProjectId,
      artist_id:              dto.artistId,
      company_id:             dto.companyId,
      campaign_id:            dto.campaignId,
      creative_request_id:    dto.creativeRequestId,
      audiovisual_project_id: dto.audiovisualProjectId,
      source_upload_id:       dto.sourceUploadId,
      tags:                   dto.tags,
      metadata:               metadataChanged ? this.buildAssetMetadata(dto, baseMetadata) : undefined,
      updated_by:             userId,
    };
  }

  private buildAssetMetadata(
    dto: CreateMarketingAssetDto | UpdateMarketingAssetDto,
    base: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const metadata = { ...base, ...(dto.metadata ?? {}) };
    if (dto.projectId !== undefined) metadata.projectId = dto.projectId;
    if (dto.taskId !== undefined) metadata.taskId = dto.taskId;
    if (dto.sourceDepartment !== undefined) metadata.sourceDepartment = dto.sourceDepartment;
    return metadata;
  }
}
