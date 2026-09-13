import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { FinanceCategoryKeywordRuleEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { matchCategoryRule } from './finance-category-matcher.util';
import type {
  CreateFinanceCategoryRuleDto,
  UpdateFinanceCategoryRuleDto,
  QueryFinanceCategoryRuleDto,
} from './dto/finance-category-rules.dto';

export interface FinanceCategorySuggestion {
  categoryId: string;
  categoryName: string;
  ruleId: string;
}

@Injectable()
export class FinanceCategoryRulesService {
  private readonly repo: Repository<FinanceCategoryKeywordRuleEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo = ds?.getRepository(FinanceCategoryKeywordRuleEntity) ?? null;
  }

  private get repository(): Repository<FinanceCategoryKeywordRuleEntity> {
    if (!this.repo) {
      throw new ServiceUnavailableException('Database unavailable for finance category rules');
    }
    return this.repo;
  }

  async list(tenantId: string, query: QueryFinanceCategoryRuleDto) {
    const qb = this.repository.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.deleted_at IS NULL');

    if (query.transaction_type) qb.andWhere('r.transaction_type = :tt', { tt: query.transaction_type });
    if (query.category_id)      qb.andWhere('r.category_id = :cid',    { cid: query.category_id });
    if (query.active !== undefined) qb.andWhere('r.active = :active', { active: query.active });
    if (query.search)           qb.andWhere('r.keywords::text ILIKE :search', { search: `%${query.search}%` });

    qb.orderBy('r.priority', 'ASC')
      .addOrderBy('r.created_at', 'ASC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 100);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string): Promise<FinanceCategoryKeywordRuleEntity> {
    const item = await this.repository.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as any });
    if (!item) throw new NotFoundException('Regra de categorização não encontrada');
    return item;
  }

  async create(tenantId: string, userId: string, dto: CreateFinanceCategoryRuleDto): Promise<FinanceCategoryKeywordRuleEntity> {
    // find-de6031eb: category_id had no cross-tenant ownership check — a
    // categorization rule could silently reference another tenant's category.
    await assertSameTenantFk(this.repository.manager.connection, 'financial_categories', (dto as { category_id?: string }).category_id, tenantId, 'Categoria financeira');
    const item = this.repository.create({ tenant_id: tenantId, ...dto, created_by: userId, updated_by: userId } as any);
    return this.repository.save(item as any) as any;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateFinanceCategoryRuleDto): Promise<FinanceCategoryKeywordRuleEntity> {
    await this.findById(tenantId, id);
    // find-de6031eb: only validate when the patch actually sets category_id —
    // omitted means "unchanged", already validated at its own create time.
    const dtoCategoryId = (dto as { category_id?: string }).category_id;
    if (dtoCategoryId !== undefined) {
      await assertSameTenantFk(this.repository.manager.connection, 'financial_categories', dtoCategoryId, tenantId, 'Categoria financeira');
    }
    const updates: Record<string, unknown> = { ...dto, updated_at: new Date(), updated_by: userId };
    const expectedUpdatedAt = updates['expectedUpdatedAt'] as string | undefined;
    delete updates['expectedUpdatedAt'];
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt,
      'Esta regra de categorização foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repository.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }

  /**
   * Task W — ponto único de auto-categorização por palavra-chave, usado na
   * criação/importação de transações (ver TransactionsService.create()).
   * Só considera regras ATIVAS do tenant informado, do mesmo transaction_type,
   * ordenadas por prioridade (empate: created_at mais antigo primeiro — mesmo
   * critério de list()). Nunca cruza tenant (WHERE tenant_id sempre presente).
   * Retorna null se nenhuma regra corresponder — o chamador decide o fallback.
   *
   * `financial_categories` não tem `slug` nem `deleted_at` (schema real —
   * ver information_schema; a versão com slug era de um schema antigo já
   * substituído). Usa `name` (o único identificador legível da categoria) e
   * `is_active` (o soft-delete real da tabela).
   */
  async suggestCategoryForTransaction(
    tenantId: string,
    transactionType: 'RECEITA' | 'DESPESA',
    descricao: string,
  ): Promise<FinanceCategorySuggestion | null> {
    if (!this.repo || !descricao?.trim()) return null;

    const { entities, raw } = await this.repo
      .createQueryBuilder('r')
      .innerJoin('financial_categories', 'fc', 'fc.id = r.category_id AND fc.is_active = true')
      .addSelect('fc.name', 'category_name')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.deleted_at IS NULL')
      .andWhere('r.active = true')
      .andWhere('r.transaction_type = :transactionType', { transactionType })
      .orderBy('r.priority', 'ASC')
      .addOrderBy('r.created_at', 'ASC')
      .limit(500)
      .getRawAndEntities();

    const matched = matchCategoryRule(entities, { descricao, transactionType });
    if (!matched) return null;

    const index = entities.indexOf(matched);
    const categoryName = raw[index]?.category_name as string | undefined;
    if (!categoryName) return null;

    return { categoryId: matched.category_id, categoryName, ruleId: matched.id };
  }
}
