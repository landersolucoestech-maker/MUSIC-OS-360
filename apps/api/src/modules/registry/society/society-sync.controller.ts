import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../../core/guards/auth.guard';
import { SocietySyncService, toPublicSocietySyncJob } from './society-sync.service';
import { RunSyncDto } from '../dto/operations.dto';

@ApiTags('Registry · Sync') @ApiBearerAuth() @Controller('registry')
export class SocietySyncController {
  constructor(private readonly svc: SocietySyncService) {}

  @Post('sync/abramus') @RequireRole('manager') @Audit('registry.sync.run') @ApiOperation({ summary: 'Trigger a status sync' })
  async run(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: RunSyncDto) {
    return toPublicSocietySyncJob(await this.svc.runSync(t.id, u?.userId ?? '', dto));
  }

  @Get('sync-jobs') @RequireRole('viewer') @ApiOperation({ summary: 'List sync jobs' })
  async list(@CurrentTenant() t: { id: string }) {
    const { data, meta } = await this.svc.list(t.id);
    return { data: data.map(toPublicSocietySyncJob), meta };
  }

  @Get('sync-jobs/:id') @RequireRole('viewer') @ApiOperation({ summary: 'Get a sync job' })
  async findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return toPublicSocietySyncJob(await this.svc.findById(t.id, id));
  }
}
