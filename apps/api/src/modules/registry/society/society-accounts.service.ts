import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { SocietyAccountEntity } from '../../../database/entities';
import { SocietyAccountStatus } from '@music-os-360/types';
import type { CreateSocietyAccountDto, UpdateSocietyAccountDto } from '../dto/society.dto';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

@Injectable()
export class SocietyAccountsService {
  private readonly repo: Repository<SocietyAccountEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(SocietyAccountEntity);
  }

  private get repository(): Repository<SocietyAccountEntity> {
    if (!this.repo) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string) {
    const data = await this.repository.find({
      where: { tenant_id: tenantId },
      order: { society: 'ASC', account_name: 'ASC' },
    });
    return { data: data.filter((a) => !a.deleted_at), meta: { total: data.length } };
  }

  async findById(tenantId: string, id: string): Promise<SocietyAccountEntity> {
    const acc = await this.repository.findOne({ where: { id, tenant_id: tenantId } });
    if (!acc || acc.deleted_at) throw new NotFoundException('Conta de sociedade não encontrada');
    return acc;
  }

  async create(tenantId: string, userId: string, dto: CreateSocietyAccountDto): Promise<SocietyAccountEntity> {
    const entity = this.repository.create({
      tenant_id: tenantId,
      society: dto.society,
      driver: dto.driver,
      account_name: dto.account_name.trim(),
      member_code: dto.member_code ?? null,
      credentials_ref: dto.credentials_ref ?? null,
      status: dto.status ?? SocietyAccountStatus.PENDING,
      created_by: userId || null,
      updated_by: userId || null,
    });
    return this.repository.save(entity);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateSocietyAccountDto): Promise<SocietyAccountEntity> {
    await this.findById(tenantId, id);
    const updates: Record<string, unknown> = {
      ...(dto.account_name != null ? { account_name: dto.account_name.trim() } : {}),
      ...(dto.member_code != null ? { member_code: dto.member_code } : {}),
      ...(dto.credentials_ref != null ? { credentials_ref: dto.credentials_ref } : {}),
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.driver != null ? { driver: dto.driver } : {}),
      updated_by: userId || null,
    };
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as never,
      updates as never,
      dto.expectedUpdatedAt,
      'Esta conta de sociedade foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const current = await this.findById(tenantId, id);
    current.deleted_at = new Date();
    await this.repository.save(current);
    return { deleted: true };
  }
}
