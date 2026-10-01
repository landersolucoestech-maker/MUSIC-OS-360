import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ContractTemplateEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CONTRACT_TEMPLATE_DEPRECATED_FIELDS } from './dto/create-contract-template.dto';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { canonicalContractCategorySlug, contractCategorySlugVariants } from '../contracts/contract-category-slugs';
import type { UpdateContractTemplateDto } from './dto/update-contract-template.dto';

@Injectable()
export class ContractTemplatesService {
  private readonly repo: Repository<ContractTemplateEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(ContractTemplateEntity);
  }

  async list(tenantId: string, query: any) {
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');

    if (query.type) {
      const typeVariants = contractCategorySlugVariants(query.type);
      if (typeVariants.length > 1) qb.andWhere('t.service_type IN (:...types)', { types: typeVariants });
      else                         qb.andWhere('t.service_type = :type', { type:   query.type });
    }
    if (query.active !== undefined) qb.andWhere('t.active = :active', { active: query.active });
    if (query.search) qb.andWhere('t.name ILIKE :search',   { search: `%${query.search}%` });

    qb.orderBy('t.created_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<ContractTemplateEntity> {
    const result = await this.repo!
      .createQueryBuilder('t')
      .where('t.id = :id AND t.tenant_id = :tenantId AND t.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Template não encontrado');
    return result;
  }

  async create(tenantId: string, userId: string, dto: CreateContractTemplateDto): Promise<ContractTemplateEntity> {
    const fields = applyDeprecatedFieldAliases(dto as any, CONTRACT_TEMPLATE_DEPRECATED_FIELDS) as Record<string, unknown>;
    if (typeof fields['service_type'] === 'string') fields['service_type'] = canonicalContractCategorySlug(fields['service_type']);
    const entity = this.repo!.create({ tenant_id: tenantId, ...fields, created_by: userId });
    return this.repo!.save(entity as any) as any;
  }

  async update(tenantId: string, id: string, dto: UpdateContractTemplateDto): Promise<ContractTemplateEntity> {
    await this.findById(tenantId, id);
    const updates: Record<string, unknown> = { ...applyDeprecatedFieldAliases(dto as any, CONTRACT_TEMPLATE_DEPRECATED_FIELDS), updated_at: new Date() };
    if (typeof updates['service_type'] === 'string') updates['service_type'] = canonicalContractCategorySlug(updates['service_type']);
    const expectedUpdatedAt = updates['expectedUpdatedAt'] as string | undefined;
    delete updates['expectedUpdatedAt'];
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt,
      'Este template foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
