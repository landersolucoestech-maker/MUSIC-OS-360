import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import {
  CreateMarketingTaskDto,
  QueryMarketingTaskDto,
  UpdateMarketingTaskDto,
  RunCopywritingDto,
} from './dto/marketing-tasks.dto';
import { MarketingTasksService } from './marketing-tasks.service';
import { CopywritingAutomation } from '../../core/automation/copywriting.automation';

@ApiTags('Marketing Tasks')
@ApiBearerAuth()
@Controller('marketing/tasks')
export class MarketingTasksController {
  constructor(
    private readonly service: MarketingTasksService,
    private readonly copywriting: CopywritingAutomation,
  ) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('marketing:read')
  @ApiOperation({ summary: 'List marketing tasks for the current tenant' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryMarketingTaskDto) {
    return this.service.list(tenant.id, query);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('marketing:read')
  find(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('marketing:create')
  @Audit('marketing.task.created')
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: CreateMarketingTaskDto,
  ) {
    return this.service.create(tenant.id, user?.userId ?? '', dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('marketing:update')
  @Audit('marketing.task.updated')
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingTaskDto,
  ) {
    return this.service.update(tenant.id, user?.userId ?? '', id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('marketing:delete')
  @Audit('marketing.task.deleted')
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(tenant.id, user?.userId ?? '', id);
  }

  @Post(':id/ai/copywriting')
  @RequireRole('editor')
  @RequirePermission('marketing:update')
  @ApiOperation({ summary: 'AI Skill copywriting — rascunho de texto (e-mail/release/landing) para a tarefa' })
  runCopywriting(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunCopywritingDto,
  ) {
    return this.copywriting.run(tenant.id, user?.userId ?? '', id, dto.tone, dto.sourceFacts);
  }
}
