import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { MarketingProjectsService } from './marketing-projects.service';
import {
  CreateMarketingProjectDto,
  QueryMarketingProjectDto,
  UpdateMarketingProjectDto,
} from './dto/marketing-projects.dto';

@ApiTags('Marketing Projects')
@ApiBearerAuth()
@Controller('marketing/projects')
export class MarketingProjectsController {
  constructor(private readonly svc: MarketingProjectsService) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List Marketing Projects' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryMarketingProjectDto) {
    return this.svc.list(tenant.id, query);
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get a Marketing Project' })
  findById(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @Audit('marketing_project.created')
  @ApiOperation({ summary: 'Create a Marketing Project' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: CreateMarketingProjectDto,
  ) {
    return this.svc.create(tenant.id, user?.userId ?? '', dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @Audit('marketing_project.updated')
  @ApiOperation({ summary: 'Update a Marketing Project' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingProjectDto,
  ) {
    return this.svc.update(tenant.id, user?.userId ?? '', id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @Audit('marketing_project.deleted')
  @ApiOperation({ summary: 'Archive a Marketing Project' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.softDelete(tenant.id, user?.userId ?? '', id);
  }
}
