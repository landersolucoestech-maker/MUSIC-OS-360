import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { LeadInteractionEntity } from '../../database/entities';
import type { CreateLeadInteractionDto, QueryLeadInteractionDto } from './dto/lead-interactions.dto';

@Injectable()
export class LeadInteractionsService {
  private readonly repo: Repository<LeadInteractionEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(LeadInteractionEntity);
  }

  async list(tenantId: string, query: QueryLeadInteractionDto) {
    const q = query as any;
    const qb = this.repo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId });

    // REM-04: the DTO exposes `leadId` (camelCase) — `q.lead_id` never existed,
    // so the per-lead filter never worked (it returned every
    // interaction in the tenant, not only those of the requested lead).
    if (q.leadId) qb.andWhere('i.lead_id = :leadId', { leadId: q.leadId });

    qb.orderBy('i.created_at', q.ascending ? 'ASC' : 'DESC')
      .skip(q.offset ?? 0)
      .take(q.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  async create(tenantId: string, userId: string, dto: CreateLeadInteractionDto): Promise<LeadInteractionEntity> {
    // REM-04: the `...dto` spread wrote fields that do not exist on the entity
    // (leadId/type/notes) and left the real columns (lead_id/type NOT NULL)
    // empty — every POST failed with a constraint violation. Mapped
    // explicitly to the real columns; the DTO's `metadata` has no
    // matching column on this entity and is not persisted.
    const entity = this.repo!.create({
      tenant_id:  tenantId,
      lead_id:    dto.leadId,
      type:       dto.type,
      notes:      dto.notes ?? null,
      created_by: userId,
    } as any);
    return this.repo!.save(entity as any) as any;
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo!
      .createQueryBuilder('i')
      .where('i.id = :id AND i.tenant_id = :tenantId', { id, tenantId })
      .getOne();
    if (!existing) throw new NotFoundException('Interação não encontrada');
    await this.repo!.delete({ id, tenant_id: tenantId } as any);
    return { deleted: true };
  }
}
