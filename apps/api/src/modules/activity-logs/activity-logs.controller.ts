import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto, QueryActivityLogDto } from './dto/activity-log.dto';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly svc: ActivityLogsService) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List activity logs' })
  list(@CurrentTenant() t: { id: string }, @Query() query: QueryActivityLogDto) {
    return this.svc.list(t.id, query);
  }

  @Post()
  @RequireRole('editor')
  @Audit('activity-log.created')
  @ApiOperation({ summary: 'Create an activity log' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Body() dto: CreateActivityLogDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }
}
