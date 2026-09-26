import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DATA_SOURCE } from '../../database/database.tokens';
import { ActivityLogEntity } from '../../database/entities';

@Injectable()
export class MarketingAiSuggestionsService {
  private readonly logs: Repository<ActivityLogEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.logs = ds?.getRepository(ActivityLogEntity) ?? null;
  }

  private get repo(): Repository<ActivityLogEntity> {
    if (!this.logs) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.logs;
  }

  async list(tenantId: string) {
    const records = await this.repo.find({
      where: { tenant_id: tenantId, entity_type: 'marketing_ai' } as never,
      order: { created_at: 'DESC' },
      take: 100,
    });
    return records.map((record) => ({
      ...(record.metadata ?? {}),
      id: record.entity_id,
      at: record.created_at.toISOString(),
    }));
  }

  async create(tenantId: string, userId: string, suggestion: Record<string, unknown>) {
    const id = randomUUID();
    const record = await this.repo.save(this.repo.create({
      tenant_id: tenantId,
      entity_type: 'marketing_ai',
      entity_id: id,
      action: 'marketing.ai.generated',
      description: String(suggestion['targetName'] ?? suggestion['kind'] ?? 'Sugestão de Marketing'),
      metadata: suggestion,
      user_id: userId,
      user_name: null,
      user_avatar_url: null,
    }));
    return { ...suggestion, id, at: record.created_at.toISOString() };
  }
}
