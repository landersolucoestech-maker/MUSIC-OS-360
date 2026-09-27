import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { EventsService } from '../../core/events/events.service';
import type {
  CreateFinancialCategoryDto,
  MoveFinancialCategoryDto,
  QueryFinancialCategoryDto,
  ReorderFinancialCategoryDto,
  UpdateFinancialCategoryDto,
} from './dto/financial-categories.dto';

interface FinancialCategoryRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  template_id: string | null;
  name: string;
  nature: string;
  includes_in_pnl: boolean;
  level: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

interface DescendantRow {
  id: string;
  level: number;
}

@Injectable()
export class FinancialCategoriesService {
  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource | null,
    @Optional() private readonly events?: EventsService,
  ) {}

  private get db(): DataSource {
    if (!this.dataSource) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
    return this.dataSource;
  }

  async list(tenantId: string, query: QueryFinancialCategoryDto) {
    const values: unknown[] = [tenantId];
    const where = ['c.tenant_id = $1'];
    const add = (sql: string, value: unknown): void => {
      values.push(value);
      where.push(sql.replace('?', `$${values.length}`));
    };

    if (query.parent_id) add('c.parent_id = ?', query.parent_id);
    else if (query.root === true) where.push('c.parent_id IS NULL');

    if (query.nature) add('c.nature = ?::category_nature', query.nature);
    if (query.is_active !== undefined) add('c.is_active = ?', query.is_active);
    if (query.includes_in_pnl !== undefined) add('c.includes_in_pnl = ?', query.includes_in_pnl);
    if (query.level !== undefined) add('c.level = ?', query.level);
    if (query.search) add('c.name ILIKE ?', `%${query.search.trim()}%`);

    const limit = Math.min(Math.max(Number(query.limit ?? 100), 1), 200);
    const offset = Math.max(Number(query.offset ?? 0), 0);
    values.push(limit, offset);
    const limitRef = `$${values.length - 1}`;
    const offsetRef = `$${values.length}`;

    const rows = await this.db.query<Array<FinancialCategoryRow & { total_count: number }>>(
      `SELECT c.*, (COUNT(*) OVER())::int AS total_count
         FROM financial_categories c
        WHERE ${where.join(' AND ')}
        ORDER BY c.level ASC, c.sort_order ASC, c.name ASC
        LIMIT ${limitRef} OFFSET ${offsetRef}`,
      values,
    );

    const total = rows[0]?.total_count ?? 0;
    const data = rows.map(({ total_count: _total, ...row }) => row);
    return { data, meta: { total, offset, limit } };
  }

  async getTree(tenantId: string, query: QueryFinancialCategoryDto) {
    const values: unknown[] = [tenantId];
    let parentFilter = 'c.parent_id IS NULL';
    if (query.parent_id) {
      values.push(query.parent_id);
      parentFilter = `c.parent_id = $${values.length}`;
    }

    if (query.is_active !== undefined) values.push(query.is_active);
    const activeFilter = query.is_active !== undefined
      ? `AND c.is_active = $${values.length}`
      : '';

    const data = await this.db.query<Array<FinancialCategoryRow & { children_count: number }>>(
      `SELECT c.*,
              (SELECT COUNT(*)::int
                 FROM financial_categories child
                WHERE child.tenant_id = c.tenant_id
                  AND child.parent_id = c.id) AS children_count
         FROM financial_categories c
        WHERE c.tenant_id = $1
          AND ${parentFilter}
          ${activeFilter}
        ORDER BY c.sort_order ASC, c.name ASC`,
      values,
    );

    return { data };
  }

  async search(tenantId: string, query: QueryFinancialCategoryDto) {
    return this.list(tenantId, { ...query, limit: query.limit ?? 25 });
  }

  async findById(tenantId: string, id: string) {
    return this.findCategory(this.db, tenantId, id);
  }

  async create(tenantId: string, userId: string, dto: CreateFinancialCategoryDto) {
    const name = this.normalizedName(dto.name);
    const parent = dto.parent_id
      ? await this.findCategory(this.db, tenantId, dto.parent_id)
      : null;
    const level = parent ? parent.level + 1 : 1;
    this.assertLevel(level);

    try {
      const rows = await this.db.query<FinancialCategoryRow[]>(
        `INSERT INTO financial_categories (
           tenant_id, parent_id, template_id, name, nature,
           includes_in_pnl, level, is_active, sort_order, created_by, updated_by
         ) VALUES ($1, $2, $3, $4, $5::category_nature, $6, $7, $8, $9, $10, $10)
         RETURNING *`,
        [
          tenantId,
          parent?.id ?? null,
          dto.template_id ?? null,
          name,
          dto.nature,
          dto.includes_in_pnl ?? true,
          level,
          dto.is_active ?? true,
          dto.sort_order ?? 0,
          userId || null,
        ],
      );
      const created = rows[0];
      if (!created) throw new ServiceUnavailableException('Categoria financeira não foi criada');
      this.emit('financial_category.created', tenantId, userId, created.id, { category: created });
      return created;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateFinancialCategoryDto,
  ) {
    const current = await this.findCategory(this.db, tenantId, id);
    const assignments: string[] = [];
    const values: unknown[] = [tenantId, id];
    const set = (column: string, value: unknown, cast = ''): void => {
      values.push(value);
      assignments.push(`"${column}" = $${values.length}${cast}`);
    };

    if (dto.name !== undefined) set('name', this.normalizedName(dto.name));
    if (dto.template_id !== undefined) set('template_id', dto.template_id);
    if (dto.nature !== undefined) set('nature', dto.nature, '::category_nature');
    if (dto.includes_in_pnl !== undefined) set('includes_in_pnl', dto.includes_in_pnl);
    if (dto.is_active !== undefined) set('is_active', dto.is_active);
    if (dto.sort_order !== undefined) set('sort_order', dto.sort_order);

    if (assignments.length === 0) return current;
    set('updated_by', userId || null);
    assignments.push('updated_at = NOW()');

    // Optional CAS: if the caller sent the updated_at it read, requires the
    // row to still be in that state — 0 affected rows = someone else
    // edited the category in the meantime (same mechanism as casUpdate(), except
    // this service uses raw SQL instead of Repository<T>, so the conditional
    // WHERE is built manually here).
    let casWhere = '';
    if (dto.expectedUpdatedAt) {
      const expected = new Date(dto.expectedUpdatedAt);
      if (Number.isNaN(expected.getTime())) {
        throw new BadRequestException('A versão do registro enviada é inválida. Recarregue e tente novamente.');
      }
      values.push(expected);
      casWhere = ` AND updated_at = $${values.length}`;
    }

    try {
      const rows = await this.db.query<FinancialCategoryRow[]>(
        `UPDATE financial_categories
            SET ${assignments.join(', ')}
          WHERE tenant_id = $1 AND id = $2${casWhere}
          RETURNING *`,
        values,
      );
      const updated = rows[0];
      if (!updated) {
        if (dto.expectedUpdatedAt) {
          throw new ConflictException('Esta categoria financeira foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.');
        }
        throw new NotFoundException('Categoria financeira não encontrada');
      }
      this.emit('financial_category.updated', tenantId, userId, id, { before: current, after: updated });
      return updated;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async move(
    tenantId: string,
    userId: string,
    id: string,
    dto: MoveFinancialCategoryDto,
  ) {
    return this.db.transaction(async (manager) => {
      const current = await this.findCategory(manager, tenantId, id, true);
      const parent = dto.parent_id
        ? await this.findCategory(manager, tenantId, dto.parent_id, true)
        : null;

      if (parent?.id === current.id) {
        throw new BadRequestException('Uma categoria não pode ser pai de si mesma');
      }

      const descendants = await manager.query<DescendantRow[]>(
        `WITH RECURSIVE descendants AS (
           SELECT id, level
             FROM financial_categories
            WHERE tenant_id = $1 AND parent_id = $2
           UNION ALL
           SELECT child.id, child.level
             FROM financial_categories child
             JOIN descendants parent ON parent.id = child.parent_id
            WHERE child.tenant_id = $1
         )
         SELECT id, level FROM descendants ORDER BY level ASC`,
        [tenantId, id],
      );

      if (parent && descendants.some((item) => item.id === parent.id)) {
        throw new BadRequestException('Não é permitido mover uma categoria para dentro da própria subárvore');
      }

      const newLevel = parent ? parent.level + 1 : 1;
      const delta = newLevel - current.level;
      const deepestLevel = descendants.reduce((max, item) => Math.max(max, item.level), current.level);
      this.assertLevel(deepestLevel + delta);

      try {
        const updatedRows = await manager.query<FinancialCategoryRow[]>(
          `UPDATE financial_categories
              SET parent_id = $3,
                  level = $4,
                  sort_order = COALESCE($5, sort_order),
                  updated_by = $6,
                  updated_at = NOW()
            WHERE tenant_id = $1 AND id = $2
            RETURNING *`,
          [tenantId, id, parent?.id ?? null, newLevel, dto.sort_order ?? null, userId || null],
        );

        if (delta !== 0) {
          const oldLevels = [...new Set(descendants.map((item) => item.level))].sort((a, b) => a - b);
          for (const oldLevel of oldLevels) {
            const ids = descendants.filter((item) => item.level === oldLevel).map((item) => item.id);
            await manager.query(
              `UPDATE financial_categories
                  SET level = level + $3,
                      updated_by = $4,
                      updated_at = NOW()
                WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
              [tenantId, ids, delta, userId || null],
            );
          }
        }

        const updated = updatedRows[0];
        if (!updated) throw new NotFoundException('Categoria financeira não encontrada');
        this.emit('financial_category.moved', tenantId, userId, id, { before: current, after: updated });
        return updated;
      } catch (error) {
        this.rethrowDatabaseError(error);
      }
    });
  }

  async reorder(
    tenantId: string,
    userId: string,
    id: string,
    dto: ReorderFinancialCategoryDto,
  ) {
    return this.update(tenantId, userId, id, { sort_order: dto.sort_order });
  }

  async archive(tenantId: string, userId: string, id: string) {
    return this.update(tenantId, userId, id, { is_active: false });
  }

  async restore(tenantId: string, userId: string, id: string) {
    return this.update(tenantId, userId, id, { is_active: true });
  }

  async remove(tenantId: string, userId: string, id: string) {
    const current = await this.findCategory(this.db, tenantId, id);
    const usage = await this.db.query<Array<{
      children: number; canonical_transactions: number; legacy_transactions: number; category_rules: number;
    }>>(
      `SELECT
         (SELECT COUNT(*)::int FROM financial_categories WHERE tenant_id = $1 AND parent_id = $2) AS children,
         (SELECT COUNT(*)::int FROM financial_transactions WHERE tenant_id = $1 AND category_id = $2) AS canonical_transactions,
         (SELECT COUNT(*)::int FROM transactions WHERE tenant_id = $1 AND financial_category_id = $2 AND deleted_at IS NULL) AS legacy_transactions,
         (SELECT COUNT(*)::int FROM finance_category_keyword_rules WHERE tenant_id = $1 AND category_id = $2 AND deleted_at IS NULL) AS category_rules`,
      [tenantId, id],
    );
    const counts = usage[0];
    if ((counts?.children ?? 0) > 0) {
      throw new ConflictException('Categoria com subcategorias não pode ser excluída');
    }
    if ((counts?.canonical_transactions ?? 0) + (counts?.legacy_transactions ?? 0) > 0) {
      throw new ConflictException('Categoria vinculada a transações não pode ser excluída');
    }
    if ((counts?.category_rules ?? 0) > 0) {
      throw new ConflictException('Categoria vinculada a regra de categorização automática não pode ser excluída');
    }

    // The application guard above covers the expected use cases — but the FK of
    // finance_category_keyword_rules (ON DELETE RESTRICT) remains the
    // last line of defense against a race (a rule created between the check and
    // this DELETE). rethrowDatabaseError() already translates 23503 -> 409.
    try {
      const result = await this.db.query<Array<{ id: string }>>(
        'DELETE FROM financial_categories WHERE tenant_id = $1 AND id = $2 RETURNING id',
        [tenantId, id],
      );
      if (!result[0]) throw new NotFoundException('Categoria financeira não encontrada');
      this.emit('financial_category.deleted', tenantId, userId, id, { category: current });
      return { deleted: true, id };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async descendants(tenantId: string, id: string) {
    await this.findCategory(this.db, tenantId, id);
    const data = await this.db.query<FinancialCategoryRow[]>(
      `WITH RECURSIVE category_tree AS (
         SELECT c.*
           FROM financial_categories c
          WHERE c.tenant_id = $1 AND c.parent_id = $2
         UNION ALL
         SELECT child.*
           FROM financial_categories child
           JOIN category_tree parent ON parent.id = child.parent_id
          WHERE child.tenant_id = $1
       )
       SELECT * FROM category_tree ORDER BY level ASC, sort_order ASC, name ASC`,
      [tenantId, id],
    );
    return { data };
  }

  async ancestors(tenantId: string, id: string) {
    await this.findCategory(this.db, tenantId, id);
    const data = await this.db.query<FinancialCategoryRow[]>(
      `WITH RECURSIVE category_path AS (
         SELECT c.*
           FROM financial_categories c
          WHERE c.tenant_id = $1 AND c.id = $2
         UNION ALL
         SELECT parent.*
           FROM financial_categories parent
           JOIN category_path child ON child.parent_id = parent.id
          WHERE parent.tenant_id = $1
       )
       SELECT * FROM category_path WHERE id <> $2 ORDER BY level ASC`,
      [tenantId, id],
    );
    return { data };
  }

  private async findCategory(
    executor: DataSource | EntityManager,
    tenantId: string,
    id: string,
    forUpdate = false,
  ): Promise<FinancialCategoryRow> {
    const rows = await executor.query<FinancialCategoryRow[]>(
      `SELECT *
         FROM financial_categories
        WHERE tenant_id = $1 AND id = $2
        ${forUpdate ? 'FOR UPDATE' : ''}`,
      [tenantId, id],
    );
    const category = rows[0];
    if (!category) throw new NotFoundException('Categoria financeira não encontrada');
    return category;
  }

  private normalizedName(value: string): string {
    const name = value.trim();
    if (!name) throw new BadRequestException('Nome da categoria é obrigatório');
    return name;
  }

  private assertLevel(level: number): void {
    if (level < 1 || level > 3) {
      throw new BadRequestException('A hierarquia de categorias permite somente os níveis 1 a 3');
    }
  }

  private rethrowDatabaseError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string } | undefined)?.code;
      if (code === '23505') {
        throw new ConflictException('Já existe uma categoria com este nome no mesmo nível');
      }
      if (code === '23503') {
        throw new ConflictException('A categoria está vinculada a outro registro');
      }
      if (code === '23514' || code === '22P02') {
        throw new BadRequestException('Dados inválidos para a categoria financeira');
      }
    }
    throw error;
  }

  private emit(
    type: string,
    tenantId: string,
    userId: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): void {
    this.events?.emit({
      type,
      tenantId,
      userId,
      aggregateType: 'financial_category',
      aggregateId,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }
}
