import {
  Injectable, Inject, NotFoundException, BadRequestException, ConflictException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import {
  AudiovisualApprovalEntity,
  AudiovisualProjectEntity,
  AudiovisualDeliverableEntity,
} from '../../../database/entities';
import { buildExpectedUpdatedAtCriterion } from '../../../common/persistence/optimistic-update.util';
import type { RequestApprovalDto, ApprovalDecisionDto, QueryApprovalDto } from '../dto/audiovisual.dto';

@Injectable()
export class AudiovisualApprovalsService {
  private readonly repo: Repository<AudiovisualApprovalEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;
  private readonly deliverables: Repository<AudiovisualDeliverableEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo         = ds?.getRepository(AudiovisualApprovalEntity) ?? null;
    this.projects     = ds?.getRepository(AudiovisualProjectEntity) ?? null;
    this.deliverables = ds?.getRepository(AudiovisualDeliverableEntity) ?? null;
  }

  private get r(): Repository<AudiovisualApprovalEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string, q: QueryApprovalDto) {
    const qb = this.r.createQueryBuilder('a').where('a.tenant_id = :tenantId', { tenantId });
    if (q.audiovisual_project_id) qb.andWhere('a.audiovisual_project_id = :pid', { pid: q.audiovisual_project_id });
    if (q.deliverable_id)         qb.andWhere('a.deliverable_id = :did',          { did: q.deliverable_id });
    if (q.status)                 qb.andWhere('a.status = :st',                   { st:  q.status });
    qb.orderBy('a.requested_at', 'DESC').skip(q.offset ?? 0).take(q.limit ?? 100);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string) {
    const a = await this.r.findOne({ where: { id, tenant_id: tenantId } as never });
    if (!a) throw new NotFoundException('Aprovação não encontrada');
    return a;
  }

  async request(tenantId: string, userId: string, projectId: string, dto: RequestApprovalDto) {
    if (!this.projects) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    const project = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    if (dto.deliverable_id) {
      if (!this.deliverables) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
      const d = await this.deliverables.findOne({
        where: { id: dto.deliverable_id, tenant_id: tenantId, audiovisual_project_id: projectId, deleted_at: null } as never,
      });
      if (!d) throw new NotFoundException('Entregável não pertence ao projeto');
    }

    // Next revision_round = max + 1 of the project+deliverable combination
    const previous = await this.r.createQueryBuilder('a')
      .where('a.tenant_id = :tenantId AND a.audiovisual_project_id = :pid', { tenantId, pid: projectId })
      .andWhere(dto.deliverable_id ? 'a.deliverable_id = :did' : 'a.deliverable_id IS NULL', { did: dto.deliverable_id })
      .orderBy('a.revision_round', 'DESC').limit(1).getOne();
    const round = (previous?.revision_round ?? 0) + 1;

    const entity = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      deliverable_id:  dto.deliverable_id ?? null,
      requested_by:    userId,
      status:          'pending',
      comments:        dto.comments ?? null,
      revision_round:  round,
      metadata:        {},
    } as Partial<AudiovisualApprovalEntity>);
    return this.r.save(entity as AudiovisualApprovalEntity);
  }

  async decide(tenantId: string, userId: string, id: string, dto: ApprovalDecisionDto) {
    const current = await this.findById(tenantId, id);
    if (current.status !== 'pending') {
      throw new BadRequestException('Esta aprovação já foi decidida e não pode ser alterada.');
    }
    const now = new Date();
    const patch: Record<string, unknown> = {
      status: dto.status,
      comments: dto.comments ?? current.comments,
    };
    if (dto.status === 'approved') {
      patch.approved_by = userId; patch.approved_at = now;
    } else if (dto.status === 'rejected' || dto.status === 'revision_requested') {
      patch.rejected_by = userId; patch.rejected_at = now;
    }

    // Keeps status='pending' in the UPDATE's OWN condition (not only in the
    // pre-check above) — closes the window between findById and this UPDATE in
    // which two concurrent decisions (two managers) could silently overwrite
    // each other. 0 affected rows = another decision already
    // won the race (or the record changed since expectedUpdatedAt) — it ALWAYS
    // becomes 409, even without expectedUpdatedAt (the status guard alone already
    // detects the race). This differs from the shared casUpdate(), which only
    // checks affected===0 when expectedUpdatedAt is provided (backward compatibility
    // with callers without an extra guard) — which is why the whole call cannot be
    // delegated to it. Reuses only the part that matters (Task Y): the
    // updated_at-truncated-to-milliseconds criterion, extracted from the same
    // casUpdate — never duplicates the comparison logic/the precision bug
    // it once had (Task X).
    const criteria: Record<string, unknown> = { id, tenant_id: tenantId, status: 'pending' };
    if (dto.expectedUpdatedAt) {
      criteria.updated_at = buildExpectedUpdatedAtCriterion(dto.expectedUpdatedAt);
    }
    const result = await this.r.update(criteria as never, patch as never);
    if (result.affected === 0) {
      throw new ConflictException('Esta aprovação já foi decidida (ou alterada) por outro usuário. Recarregue e tente novamente.');
    }

    // If it is a deliverable approval, marks deliverable.approved = true — only
    // after the decision itself was persisted successfully.
    if (dto.status === 'approved' && current.deliverable_id && this.deliverables) {
      await this.deliverables.update(
        { id: current.deliverable_id, tenant_id: tenantId } as never,
        { approved: true, status: 'approved', updated_at: now } as never,
      );
    }
    return this.findById(tenantId, id);
  }
}
