import { Controller, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../../core/guards/auth.guard';
import { AudiovisualBriefingsService } from './briefings.service';
import { UpsertBriefingDto } from '../dto/audiovisual.dto';

@ApiTags('Audiovisual — Briefings')
@ApiBearerAuth()
@Controller('audiovisual/projects/:projectId/briefing')
export class AudiovisualBriefingsController {
  constructor(private readonly svc: AudiovisualBriefingsService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'Get the project briefing' })
  get(@CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.getByProject(t.id, projectId);
  }

  @Put() @RequireRole('editor') @Audit('audiovisual.briefing.upserted')
  @ApiOperation({ summary: 'Create or update a briefing' })
  upsert(
    @CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth,
    @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: UpsertBriefingDto,
  ) {
    return this.svc.upsert(t.id, u?.userId ?? '', projectId, dto);
  }
}
