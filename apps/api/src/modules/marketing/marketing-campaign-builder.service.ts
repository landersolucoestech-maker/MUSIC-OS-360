import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { CampaignEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

export type BuilderStatus =
  | 'DRAFT' | 'READY' | 'PENDING_REVIEW' | 'SCHEDULED' | 'ACTIVE'
  | 'PAUSED' | 'REJECTED' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

export type CampaignBuilderPayload = {
  name?: string;
  objective?: string;
  expectedOutcome?: string;
  promotedEntityType?: string;
  promotedEntityId?: string;
  promotedEntityName?: string;
  destinationUrl?: string;
  platforms?: string[];
  placements?: string[];
  creatives?: Array<{ type?: string; mimeType?: string; name?: string }>;
  budgetType?: 'DAILY' | 'TOTAL';
  totalBudget?: number | null;
  dailyBudget?: number | null;
  startDate?: string;
  endDate?: string;
  audience?: Record<string, unknown>;
  utm?: Record<string, unknown>;
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
};

export type CampaignValidation = { valid: boolean; errors: string[]; warnings: string[] };
export type CampaignBlueprint = {
  recommendedPlatforms: string[];
  requiredActions: string[];
  suggestedCtas: string[];
  notes: string[];
};
export type StoredCampaign = CampaignBuilderPayload & {
  id: string;
  tenantId: string;
  status: BuilderStatus;
  validation: CampaignValidation;
  blueprint?: CampaignBlueprint;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class MarketingCampaignBuilderService {
  private readonly campaigns: Repository<CampaignEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.campaigns = ds?.getRepository(CampaignEntity) ?? null;
  }

  private get repo(): Repository<CampaignEntity> {
    if (!this.campaigns) throw new ServiceUnavailableException('Database unavailable');
    return this.campaigns;
  }

  async list(tenantId: string): Promise<StoredCampaign[]> {
    const rows = await this.repo.createQueryBuilder('campaign')
      .where('campaign.tenant_id = :tenantId', { tenantId })
      .andWhere('campaign.type = :type', { type: 'marketing_builder' })
      .andWhere('campaign.deleted_at IS NULL')
      .orderBy('campaign.updated_at', 'DESC')
      .getMany();
    return rows.map((row) => this.toStored(row));
  }

  async find(tenantId: string, id: string): Promise<StoredCampaign> {
    const row = await this.repo.findOne({
      where: {
        id,
        tenant_id: tenantId,
        type: 'marketing_builder',
        deleted_at: null,
      } as never,
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return this.toStored(row);
  }

  async create(
    tenantId: string,
    userId: string,
    payload: CampaignBuilderPayload,
    validation: CampaignValidation,
  ): Promise<StoredCampaign> {
    const row = this.repo.create({
      tenant_id: tenantId,
      name: payload.name?.trim() || 'Campanha sem título',
      type: 'marketing_builder',
      status: 'DRAFT' as never,
      objetivo: payload.objective ?? null,
      orcamento: this.budget(payload),
      start_date: payload.startDate ? new Date(payload.startDate) : null,
      end_date: payload.endDate ? new Date(payload.endDate) : null,
      metadata: { marketingBuilder: { payload, validation } },
      created_by: userId,
      updated_by: userId,
    } as Partial<CampaignEntity>);
    return this.toStored(await this.repo.save(row as CampaignEntity));
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    patch: CampaignBuilderPayload,
    validation: CampaignValidation,
  ): Promise<StoredCampaign> {
    const current = await this.find(tenantId, id);
    return this.persist(tenantId, userId, id, { ...current, ...patch }, current.status, validation, current.blueprint);
  }

  async setState(
    tenantId: string,
    userId: string,
    id: string,
    status: BuilderStatus,
    validation: CampaignValidation,
    blueprint?: CampaignBlueprint,
  ): Promise<StoredCampaign> {
    const current = await this.find(tenantId, id);
    return this.persist(tenantId, userId, id, current, status, validation, blueprint ?? current.blueprint);
  }

  async archive(tenantId: string, userId: string, id: string): Promise<StoredCampaign> {
    const archived = await this.setState(
      tenantId,
      userId,
      id,
      'ARCHIVED',
      (await this.find(tenantId, id)).validation,
    );
    await this.repo.update({ id, tenant_id: tenantId } as never, {
      deleted_at: new Date(),
      updated_by: userId,
    } as never);
    return archived;
  }

  private async persist(
    tenantId: string,
    userId: string,
    id: string,
    payload: CampaignBuilderPayload,
    status: BuilderStatus,
    validation: CampaignValidation,
    blueprint?: CampaignBlueprint,
  ): Promise<StoredCampaign> {
    await casUpdate(
      this.repo,
      { id, tenant_id: tenantId } as never,
      {
        name: payload.name?.trim() || 'Campanha sem título',
        status: status as never,
        objetivo: payload.objective ?? null,
        orcamento: this.budget(payload),
        start_date: payload.startDate ? new Date(payload.startDate) : null,
        end_date: payload.endDate ? new Date(payload.endDate) : null,
        metadata: { marketingBuilder: { payload: this.cleanPayload(payload), validation, blueprint } },
        updated_by: userId,
        updated_at: new Date(),
      } as never,
      payload.expectedUpdatedAt,
      'Esta campanha foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.find(tenantId, id);
  }

  private toStored(row: CampaignEntity): StoredCampaign {
    const builder = (row.metadata?.marketingBuilder ?? {}) as {
      payload?: CampaignBuilderPayload;
      validation?: CampaignValidation;
      blueprint?: CampaignBlueprint;
    };
    return {
      ...(builder.payload ?? {}),
      id: row.id,
      tenantId: row.tenant_id,
      name: builder.payload?.name ?? row.name,
      objective: builder.payload?.objective ?? row.objetivo ?? undefined,
      status: row.status as unknown as BuilderStatus,
      validation: builder.validation ?? { valid: false, errors: [], warnings: [] },
      blueprint: builder.blueprint,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private cleanPayload(payload: CampaignBuilderPayload): CampaignBuilderPayload {
    const {
      id: _id,
      tenantId: _tenant,
      status: _status,
      validation: _validation,
      blueprint: _blueprint,
      createdAt: _created,
      updatedAt: _updated,
      expectedUpdatedAt: _expectedUpdatedAt,
      ...clean
    } = payload as StoredCampaign;
    return clean;
  }

  private budget(payload: CampaignBuilderPayload): string | null {
    const value = payload.budgetType === 'DAILY' ? payload.dailyBudget : payload.totalBudget;
    return value == null ? null : String(value);
  }
}
