import { Injectable, Inject } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ActivityLogEntity } from '../../database/entities';
import { toPublicActivityLog } from './activity-log.public';
import type { CreateActivityLogDto, QueryActivityLogDto } from './dto/activity-log.dto';

@Injectable()
export class ActivityLogsService {
  private readonly repo: Repository<ActivityLogEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(ActivityLogEntity);
  }

  async create(tenantId: string, userId: string, dto: CreateActivityLogDto) {
    const entity = this.repo!.create({
      tenant_id:       tenantId,
      entity_type:     dto.entity_type,
      entity_id:       dto.entity_id,
      action:          dto.action,
      description:     dto.description,
      metadata:        dto.metadata ?? {},
      user_id:         userId,
      user_name:       dto.user_name ?? null,
      user_avatar_url: dto.user_avatar_url ?? null,
    });
    return this.repo!.save(entity as any);
  }

  async list(tenantId: string, query: QueryActivityLogDto) {
    const qb = this.repo!
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .orderBy('a.created_at', 'DESC')
      .take(query.limit ?? 50);

    if (query.entityType) {
      qb.andWhere('a.entity_type = :entityType', { entityType: query.entityType });
    }

    if (query.entityId) {
      qb.andWhere('a.entity_id = :entityId', { entityId: query.entityId });
    }

    return (await qb.getMany()).map(toPublicActivityLog);
  }
}
