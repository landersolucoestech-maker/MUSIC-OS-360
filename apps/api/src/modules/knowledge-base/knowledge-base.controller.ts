/**
 * knowledge-base/knowledge-base.controller.ts
 *
 * Support Center — knowledge base. GLOBAL content (not
 * tenant-scoped): Music OS 360 writes the platform documentation
 * (super_admin), every authenticated tenant reads what is published.
 */
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { KnowledgeBaseService } from './knowledge-base.service';
import {
  CreateKnowledgeCategoryDto, UpdateKnowledgeCategoryDto,
  CreateKnowledgeArticleDto, UpdateKnowledgeArticleDto,
  MoveKnowledgeArticleDto,
} from './dto/knowledge-base.dto';

@ApiTags('KnowledgeBase') @ApiBearerAuth() @Controller()
export class KnowledgeBaseController {
  constructor(private readonly svc: KnowledgeBaseService) {}

  // ── Categories ──────────────────────────────────────────────────────────
  @Get('knowledge-categories') @RequireRole('viewer')
  @ApiOperation({ summary: 'List knowledge base categories' })
  listCategories() {
    return this.svc.listCategories();
  }

  @Post('knowledge-categories') @RequireRole('super_admin')
  @Audit('knowledge_category.created')
  @ApiOperation({ summary: 'Create a category (super_admin)' })
  createCategory(@Body() dto: CreateKnowledgeCategoryDto) {
    return this.svc.createCategory(dto);
  }

  @Patch('knowledge-categories/:id') @RequireRole('super_admin')
  @Audit('knowledge_category.updated')
  @ApiOperation({ summary: 'Edit a category (super_admin)' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKnowledgeCategoryDto) {
    return this.svc.updateCategory(id, dto);
  }

  @Delete('knowledge-categories/:id') @RequireRole('super_admin')
  @Audit('knowledge_category.deleted') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category (super_admin) — blocked when articles are linked' })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.deleteCategory(id);
  }

  // ── Articles ────────────────────────────────────────────────────────────
  @Get('knowledge-articles') @RequireRole('viewer')
  @ApiOperation({ summary: 'List published articles (tenant read)' })
  listPublicArticles() {
    return this.svc.listPublicArticles();
  }

  @Get('knowledge-articles/admin') @RequireRole('super_admin')
  @ApiOperation({ summary: 'List all articles, any status (authoring, super_admin)' })
  listAllArticles() {
    return this.svc.listAllArticles();
  }

  @Post('knowledge-articles') @RequireRole('super_admin')
  @Audit('knowledge_article.created')
  @ApiOperation({ summary: 'Create an article (super_admin)' })
  createArticle(@CurrentUser() user: JwtAuth, @Body() dto: CreateKnowledgeArticleDto) {
    return this.svc.createArticle(user?.userId ?? 'unknown', dto);
  }

  @Patch('knowledge-articles/:id') @RequireRole('super_admin')
  @Audit('knowledge_article.updated')
  @ApiOperation({ summary: 'Edit an article, including status/featured (super_admin)' })
  updateArticle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKnowledgeArticleDto) {
    return this.svc.updateArticle(id, dto);
  }

  @Patch('knowledge-articles/:id/move') @RequireRole('super_admin')
  @Audit('knowledge_article.moved')
  @ApiOperation({ summary: 'Move an article in the display order (super_admin)' })
  moveArticle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveKnowledgeArticleDto) {
    return this.svc.moveArticle(id, dto.direction);
  }

  @Delete('knowledge-articles/:id') @RequireRole('super_admin')
  @Audit('knowledge_article.deleted') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an article (super_admin)' })
  async deleteArticle(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.deleteArticle(id);
  }

  @Post('knowledge-articles/:id/view') @RequireRole('viewer') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a view (tenant read)' })
  async incrementViews(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.incrementViews(id);
  }
}
