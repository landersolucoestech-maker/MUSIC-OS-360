/**
 * modules/assets/assets.controller.ts
 *
 * READ-ONLY exposure of the central asset model + skill executions.
 * Tenant isolation in every query; RBAC via @RequireRole.
 *
 * Linked assets (project/task) → consumed by Content/Scheduling and the UI.
 * skill-runs → traceability/history (internal/operational use).
 */

import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { AssetLinkingService } from './asset-linking.service';
import { AssetClassificationService } from './asset-classification.service';
import { ReleaseReadinessService } from './release-readiness.service';
import { SkillRunService } from '../../core/skills/skill-run.service';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller()
export class AssetsController {
  constructor(
    private readonly assetLinking: AssetLinkingService,
    private readonly classification: AssetClassificationService,
    private readonly releaseReadiness: ReleaseReadinessService,
    private readonly skillRuns: SkillRunService,
  ) {}

  @Get('release-readiness')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Evaluate the mandatory requirements for distribution' })
  readiness(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Query() q: { projectId?: string; phonogramId?: string },
  ) {
    return this.releaseReadiness.evaluate(
      t.id,
      { projectId: q.projectId ?? null, phonogramId: q.phonogramId ?? null },
      user.userId,
    );
  }

  @Get('projects/:projectId/assets')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List assets linked to a project' })
  projectAssets(
    @CurrentTenant() t: { id: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.assetLinking.getProjectAssetsDetailed(t.id, projectId);
  }

  @Get('tasks/:taskId/assets')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List assets linked to a task' })
  taskAssets(
    @CurrentTenant() t: { id: string },
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.assetLinking.getTaskAssetsDetailed(t.id, taskId);
  }

  @Get('assets/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Central asset detail + versions' })
  async asset(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const found = await this.assetLinking.getAssetById(t.id, id);
    if (!found) throw new NotFoundException('Asset não encontrado');
    return found;
  }

  @Post('assets/:id/classify')
  @RequireRole('editor')
  @Audit('asset.classified')
  @ApiOperation({ summary: 'Manual review of an asset classification' })
  async classify(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assetType?: string },
  ) {
    const assetType = (body?.assetType ?? '').trim();
    if (!assetType) throw new BadRequestException('assetType é obrigatório');
    return this.classification.review(t.id, id, assetType, user.userId);
  }

  @Get('skill-runs')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Skill run history (read-only)' })
  skillRunsList(
    @CurrentTenant() t: { id: string },
    @Query() q: { skillName?: string; status?: string; limit?: string; offset?: string },
  ) {
    return this.skillRuns.listRuns(t.id, {
      skillName: q.skillName,
      status: q.status,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
  }

  @Get('skill-runs/:id')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Skill run detail + logs' })
  async skillRun(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const found = await this.skillRuns.getRun(t.id, id);
    if (!found) throw new NotFoundException('Execução não encontrada');
    return found;
  }
}
