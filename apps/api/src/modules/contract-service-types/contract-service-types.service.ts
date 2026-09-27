import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ContractServiceTypeEntity } from '../../database/entities';
import type { CreateContractServiceTypeDto } from './dto/create-contract-service-type.dto';
import type { UpdateContractServiceTypeDto } from './dto/update-contract-service-type.dto';

// created_at/updated_at never come from the client (@CreateDateColumn/@UpdateDateColumn
// handle that); an explicit strip prevents an input value from leaking into the insert/update.
function stripClientTimestamps(dto: Record<string, unknown>): Record<string, unknown> {
  const { created_at: _createdAt, updated_at: _updatedAt, ...rest } = dto;
  return rest;
}

@Injectable()
export class ContractServiceTypesService {
  private readonly repo: Repository<ContractServiceTypeEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(ContractServiceTypeEntity);
  }

  async list(tenantId: string): Promise<ContractServiceTypeEntity[]> {
    return this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL')
      .orderBy('t.sort_order', 'ASC')
      .getMany();
  }

  async findById(tenantId: string, id: string): Promise<ContractServiceTypeEntity> {
    const result = await this.repo!
      .createQueryBuilder('t')
      .where('t.id = :id AND t.tenant_id = :tenantId AND t.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Tipo de serviço de contrato não encontrado');
    return result;
  }

  async create(tenantId: string, dto: CreateContractServiceTypeDto): Promise<ContractServiceTypeEntity> {
    await this.assertSlugAvailable(tenantId, dto.slug);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = this.repo!.create({ tenant_id: tenantId, ...stripClientTimestamps(dto as any) } as any);
    return this.repo!.save(entity as any) as any;
  }

  async update(tenantId: string, id: string, dto: UpdateContractServiceTypeDto): Promise<ContractServiceTypeEntity> {
    await this.findById(tenantId, id);
    if (dto.slug !== undefined) await this.assertSlugAvailable(tenantId, dto.slug, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, stripClientTimestamps(dto as any) as any);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }

  private async assertSlugAvailable(tenantId: string, slug: string, excludeId?: string): Promise<void> {
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId AND t.slug = :slug AND t.deleted_at IS NULL', { tenantId, slug });
    if (excludeId) qb.andWhere('t.id != :excludeId', { excludeId });
    const existing = await qb.getOne();
    if (existing) throw new BadRequestException(`Já existe um tipo de serviço com o identificador (URL) "${slug}".`);
  }
}
