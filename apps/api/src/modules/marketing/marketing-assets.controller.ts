import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { MarketingAssetsService } from './marketing-assets.service';
import {
  CreateMarketingAssetDto,
  DecideMarketingAssetApprovalDto,
  QueryMarketingAssetDto,
  UpdateMarketingAssetDto,
} from './dto/marketing-assets.dto';

@ApiTags('Marketing Assets')
@ApiBearerAuth()
@Controller('marketing/assets')
export class MarketingAssetsController {
  constructor(private readonly svc: MarketingAssetsService) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List produced, reusable assets' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryMarketingAssetDto) {
    return this.svc.list(tenant.id, query);
  }

  @Get('project/:projectId/library')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List the music project\'s approved asset library' })
  listProjectLibrary(
    @CurrentTenant() tenant: { id: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryMarketingAssetDto,
  ) {
    return this.svc.listProjectLibrary(tenant.id, projectId, query);
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get a produced asset' })
  findById(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(tenant.id, id);
  }

  @Get(':id/versions')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List asset versions' })
  versions(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.versions(tenant.id, id);
  }

  @Get(':id/approvals')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List asset approvals' })
  approvals(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approvals(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @Audit('marketing.asset.created')
  @ApiOperation({ summary: 'Create a marketing asset' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: CreateMarketingAssetDto,
  ) {
    return this.svc.create(tenant.id, user?.userId ?? '', dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @Audit('marketing.asset.updated')
  @ApiOperation({ summary: 'Update a marketing asset' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingAssetDto,
  ) {
    return this.svc.update(tenant.id, user?.userId ?? '', id, dto);
  }

  @Post(':id/request-approval')
  @RequireRole('editor')
  @Audit('marketing.asset.approval_requested')
  @ApiOperation({ summary: 'Submit an asset for approval' })
  requestApproval(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.requestApproval(tenant.id, user?.userId ?? '', id);
  }

  @Post('approvals/:approvalId/decision')
  @RequireRole('manager')
  @Audit('marketing.asset.approval_decided')
  @ApiOperation({ summary: 'Approve, reject or request revision of an asset' })
  decideApproval(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: DecideMarketingAssetApprovalDto,
  ) {
    return this.svc.decideApproval(tenant.id, user?.userId ?? '', approvalId, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @Audit('marketing.asset.archived')
  @ApiOperation({ summary: 'Archive a marketing asset' })
  archive(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.archive(tenant.id, user?.userId ?? '', id);
  }
}
