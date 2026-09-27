import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { CampaignOperationsService } from './campaign-operations.service';
import {
  CreateCampaignTaskDto, UpdateCampaignTaskDto, QueryCampaignTaskDto,
  CreateCampaignAssetDto,
} from './dto/campaign-operations.dto';

@ApiTags('Campaigns / Operations') @ApiBearerAuth()
@Controller('campaigns/:campaignId')
export class CampaignOperationsController {
  constructor(private readonly svc: CampaignOperationsService) {}

  // ── Tasks ──────────────────────────────────────────────────────────────────

  @Get('tasks') @RequireRole('viewer') @ApiOperation({ summary: 'List campaign tasks' })
  listTasks(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() q: QueryCampaignTaskDto,
  ) {
    return this.svc.listTasks(t.id, campaignId, q);
  }

  @Get('calendar') @RequireRole('viewer') @ApiOperation({ summary: 'Campaign task calendar' })
  getCalendar(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.svc.getCalendar(t.id, campaignId);
  }

  @Post('tasks') @RequireRole('editor') @Audit('campaign.task.created')
  createTask(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateCampaignTaskDto,
  ) {
    return this.svc.createTask(t.id, campaignId, u?.userId ?? '', dto);
  }

  @Patch('tasks/:taskId') @RequireRole('editor') @Audit('campaign.task.updated')
  updateTask(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateCampaignTaskDto,
  ) {
    return this.svc.updateTask(t.id, campaignId, taskId, dto);
  }

  @Delete('tasks/:taskId') @RequireRole('editor') @Audit('campaign.task.deleted')
  deleteTask(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.svc.deleteTask(t.id, campaignId, taskId);
  }

  // ── Assets ─────────────────────────────────────────────────────────────────

  @Get('assets') @RequireRole('viewer') @ApiOperation({ summary: 'List campaign assets' })
  listAssets(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.svc.listAssets(t.id, campaignId);
  }

  @Post('assets') @RequireRole('editor') @Audit('campaign.asset.added')
  addAsset(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateCampaignAssetDto,
  ) {
    return this.svc.addAsset(t.id, campaignId, u?.userId ?? '', dto);
  }

  @Delete('assets/:assetId') @RequireRole('editor') @Audit('campaign.asset.deleted')
  deleteAsset(
    @CurrentTenant() t: { id: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    return this.svc.deleteAsset(t.id, campaignId, assetId);
  }
}
