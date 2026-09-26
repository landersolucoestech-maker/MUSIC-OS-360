import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualProductionDayEntity, AudiovisualProjectEntity } from '../../../database/entities';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateProductionDayInput {
  shooting_date: string;
  call_time?: string;
  end_time?: string;
  location?: string;
  weather_notes?: string;
  team_notes?: string;
  production_notes?: string;
  status?: string;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
}

@Injectable()
export class AudiovisualProductionDaysService {
  private readonly repo: Repository<AudiovisualProductionDayEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualProductionDayEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualProductionDayEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async listByProject(tenantId: string, projectId: string) {
    await this.assertProject(tenantId, projectId);
    return this.r.createQueryBuilder('d')
      .where('d.tenant_id = :tenantId AND d.audiovisual_project_id = :pid', { tenantId, pid: projectId })
      .orderBy('d.shooting_date', 'ASC').getMany();
  }

  async create(tenantId: string, projectId: string, input: CreateProductionDayInput) {
    await this.assertProject(tenantId, projectId);
    const e = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      shooting_date:    input.shooting_date,
      call_time:        input.call_time ?? null,
      end_time:         input.end_time ?? null,
      location:         input.location ?? null,
      weather_notes:    input.weather_notes ?? null,
      team_notes:       input.team_notes ?? null,
      production_notes: input.production_notes ?? null,
      status:           input.status ?? 'scheduled',
      metadata:         {},
    } as Partial<AudiovisualProductionDayEntity>);
    return this.r.save(e as AudiovisualProductionDayEntity);
  }

  async update(tenantId: string, id: string, input: Partial<CreateProductionDayInput>) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId } as never });
    if (!cur) throw new NotFoundException('Dia de produção não encontrado');
    const { expectedUpdatedAt, ...rest } = input;
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      { ...rest, updated_at: new Date() } as never,
      expectedUpdatedAt,
      'Este dia de produção foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.r.findOne({ where: { id, tenant_id: tenantId } as never });
  }

  async remove(tenantId: string, id: string) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId } as never });
    if (!cur) throw new NotFoundException('Dia de produção não encontrado');
    await this.r.delete({ id, tenant_id: tenantId } as never);
    return { deleted: true };
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Database unavailable');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto não encontrado');
  }
}
