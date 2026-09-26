import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualTeamMemberEntity, AudiovisualProjectEntity } from '../../../database/entities';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateTeamMemberInput {
  user_id?: string;
  external_name?: string;
  role: string;
  contact?: string;
  payment_amount?: number;
  payment_status?: string;
  notes?: string;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
}

@Injectable()
export class AudiovisualTeamMembersService {
  private readonly repo: Repository<AudiovisualTeamMemberEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualTeamMemberEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualTeamMemberEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async listByProject(tenantId: string, projectId: string) {
    await this.assertProject(tenantId, projectId);
    return this.r.find({
      where: { tenant_id: tenantId, audiovisual_project_id: projectId, deleted_at: null } as never,
      order: { created_at: 'ASC' as never },
    });
  }

  async create(tenantId: string, projectId: string, input: CreateTeamMemberInput) {
    await this.assertProject(tenantId, projectId);
    const e = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      user_id:        input.user_id ?? null,
      external_name:  input.external_name ?? null,
      role:           input.role,
      contact:        input.contact ?? null,
      payment_amount: input.payment_amount != null ? String(input.payment_amount) : null,
      payment_status: input.payment_status ?? 'pending',
      notes:          input.notes ?? null,
      metadata:       {},
    } as Partial<AudiovisualTeamMemberEntity>);
    return this.r.save(e as AudiovisualTeamMemberEntity);
  }

  async update(tenantId: string, id: string, input: Partial<CreateTeamMemberInput>) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!cur) throw new NotFoundException('Membro de equipe não encontrado');
    const { expectedUpdatedAt, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest, updated_at: new Date() };
    if (input.payment_amount != null) patch.payment_amount = String(input.payment_amount);
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      expectedUpdatedAt,
      'Este membro de equipe foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.r.findOne({ where: { id, tenant_id: tenantId } as never });
  }

  async remove(tenantId: string, id: string) {
    await this.r.update({ id, tenant_id: tenantId } as never, { deleted_at: new Date() } as never);
    return { deleted: true };
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Database unavailable');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto não encontrado');
  }
}
