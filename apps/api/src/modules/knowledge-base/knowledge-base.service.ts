import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { KnowledgeCategoryEntity, KnowledgeArticleEntity } from '../../database/entities';
import type {
  CreateKnowledgeCategoryDto, UpdateKnowledgeCategoryDto,
  CreateKnowledgeArticleDto, UpdateKnowledgeArticleDto,
} from './dto/knowledge-base.dto';

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

@Injectable()
export class KnowledgeBaseService {
  private readonly categoryRepo: Repository<KnowledgeCategoryEntity> | null = null;
  private readonly articleRepo: Repository<KnowledgeArticleEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) {
      this.categoryRepo = ds.getRepository(KnowledgeCategoryEntity);
      this.articleRepo = ds.getRepository(KnowledgeArticleEntity);
    }
  }

  // ── Categories ──────────────────────────────────────────────────────────
  async listCategories(): Promise<KnowledgeCategoryEntity[]> {
    return this.categoryRepo!
      .createQueryBuilder('c')
      .where('c.deleted_at IS NULL')
      .orderBy('c.sort_order', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getMany();
  }

  async createCategory(dto: CreateKnowledgeCategoryDto): Promise<KnowledgeCategoryEntity> {
    const dup = await this.categoryRepo!
      .createQueryBuilder('c')
      .where('c.slug = :slug AND c.deleted_at IS NULL', { slug: dto.slug })
      .getOne();
    if (dup) throw new BadRequestException(`Já existe uma categoria com slug '${dto.slug}'`);
    const entity = this.categoryRepo!.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      color: dto.color ?? null,
    });
    return this.categoryRepo!.save(entity);
  }

  async updateCategory(id: string, dto: UpdateKnowledgeCategoryDto): Promise<KnowledgeCategoryEntity> {
    const category = await this.categoryRepo!
      .createQueryBuilder('c')
      .where('c.id = :id AND c.deleted_at IS NULL', { id })
      .getOne();
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (dto.slug && dto.slug !== category.slug) {
      const dup = await this.categoryRepo!
        .createQueryBuilder('c')
        .where('c.slug = :slug AND c.deleted_at IS NULL', { slug: dto.slug })
        .getOne();
      if (dup) throw new BadRequestException(`Já existe uma categoria com slug '${dto.slug}'`);
    }
    Object.assign(category, {
      slug: dto.slug ?? category.slug,
      name: dto.name ?? category.name,
      description: dto.description !== undefined ? dto.description : category.description,
      icon: dto.icon !== undefined ? dto.icon : category.icon,
      color: dto.color !== undefined ? dto.color : category.color,
    });
    return this.categoryRepo!.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const inUse = await this.articleRepo!
      .createQueryBuilder('a')
      .where('a.category_id = :id AND a.deleted_at IS NULL', { id })
      .getCount();
    if (inUse > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${inUse} artigo(s) ainda usam esta categoria.`,
      );
    }
    const result = await this.categoryRepo!
      .createQueryBuilder()
      .update(KnowledgeCategoryEntity)
      .set({ deleted_at: new Date() })
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();
    if (!result.affected) throw new NotFoundException('Categoria não encontrada');
  }

  // ── Articles ────────────────────────────────────────────────────────────
  /** Public read (authenticated tenant): published only and never internal_doc. */
  async listPublicArticles(): Promise<KnowledgeArticleEntity[]> {
    return this.articleRepo!
      .createQueryBuilder('a')
      .where("a.deleted_at IS NULL AND a.status = 'published' AND a.type != 'internal_doc'")
      .orderBy('a.sort_order', 'ASC')
      .addOrderBy('a.created_at', 'DESC')
      .getMany();
  }

  /** Authoring (super_admin): all statuses and types. */
  async listAllArticles(): Promise<KnowledgeArticleEntity[]> {
    return this.articleRepo!
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .orderBy('a.sort_order', 'ASC')
      .addOrderBy('a.created_at', 'DESC')
      .getMany();
  }

  async createArticle(userId: string, dto: CreateKnowledgeArticleDto): Promise<KnowledgeArticleEntity> {
    const category = await this.categoryRepo!
      .createQueryBuilder('c')
      .where('c.id = :id AND c.deleted_at IS NULL', { id: dto.category_id })
      .getOne();
    if (!category) throw new BadRequestException('Categoria inválida');

    const maxOrder = await this.articleRepo!
      .createQueryBuilder('a')
      .select('MAX(a.sort_order)', 'max')
      .where('a.deleted_at IS NULL')
      .getRawOne<{ max: number | null }>();

    const entity = this.articleRepo!.create({
      category_id: dto.category_id,
      title: dto.title,
      summary: dto.summary ?? '',
      content: dto.content,
      type: (dto.type ?? 'article') as KnowledgeArticleEntity['type'],
      status: (dto.status ?? 'draft') as KnowledgeArticleEntity['status'],
      featured: dto.featured ?? false,
      read_time: estimateReadTime(dto.content),
      sort_order: (maxOrder?.max ?? -1) + 1,
      created_by: userId,
    });
    return this.articleRepo!.save(entity);
  }

  async updateArticle(id: string, dto: UpdateKnowledgeArticleDto): Promise<KnowledgeArticleEntity> {
    const article = await this.articleRepo!
      .createQueryBuilder('a')
      .where('a.id = :id AND a.deleted_at IS NULL', { id })
      .getOne();
    if (!article) throw new NotFoundException('Artigo não encontrado');

    if (dto.category_id && dto.category_id !== article.category_id) {
      const category = await this.categoryRepo!
        .createQueryBuilder('c')
        .where('c.id = :id AND c.deleted_at IS NULL', { id: dto.category_id })
        .getOne();
      if (!category) throw new BadRequestException('Categoria inválida');
    }

    Object.assign(article, {
      category_id: dto.category_id ?? article.category_id,
      title: dto.title ?? article.title,
      summary: dto.summary !== undefined ? dto.summary : article.summary,
      content: dto.content ?? article.content,
      type: (dto.type as KnowledgeArticleEntity['type']) ?? article.type,
      status: (dto.status as KnowledgeArticleEntity['status']) ?? article.status,
      featured: dto.featured !== undefined ? dto.featured : article.featured,
      read_time: dto.content ? estimateReadTime(dto.content) : article.read_time,
    });
    return this.articleRepo!.save(article);
  }

  async deleteArticle(id: string): Promise<void> {
    const result = await this.articleRepo!
      .createQueryBuilder()
      .update(KnowledgeArticleEntity)
      .set({ deleted_at: new Date() })
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();
    if (!result.affected) throw new NotFoundException('Artigo não encontrado');
  }

  /** Swaps sort_order with the adjacent neighbor in the full list (all statuses). */
  async moveArticle(id: string, direction: 'up' | 'down'): Promise<KnowledgeArticleEntity> {
    const all = await this.articleRepo!
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .orderBy('a.sort_order', 'ASC')
      .addOrderBy('a.created_at', 'DESC')
      .getMany();

    const index = all.findIndex((a) => a.id === id);
    if (index < 0) throw new NotFoundException('Artigo não encontrado');

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= all.length) return all[index]!;

    const current = all[index]!;
    const neighbor = all[swapIndex]!;
    const currentOrder = current.sort_order;
    current.sort_order = neighbor.sort_order;
    neighbor.sort_order = currentOrder;

    await this.articleRepo!.save([current, neighbor]);
    return current;
  }

  async incrementViews(id: string): Promise<void> {
    await this.articleRepo!
      .createQueryBuilder()
      .update(KnowledgeArticleEntity)
      .set({ views: () => 'views + 1' })
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();
  }
}
