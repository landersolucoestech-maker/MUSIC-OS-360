import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../../core/guards/auth.guard';
import { AudiovisualDeliverablesService } from './deliverables.service';
import {
  CreateDeliverableDto, UpdateDeliverableDto, QueryDeliverableDto,
} from '../dto/audiovisual.dto';

@ApiTags('Audiovisual — Deliverables')
@ApiBearerAuth()
@Controller('audiovisual')
export class AudiovisualDeliverablesController {
  constructor(private readonly svc: AudiovisualDeliverablesService) {}

  @Get('deliverables') @RequireRole('viewer') @ApiOperation({ summary: 'List deliverables' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryDeliverableDto) {
    return this.svc.list(t.id, q);
  }

  @Get('deliverables/:id') @RequireRole('viewer') @ApiOperation({ summary: 'Get a deliverable' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post('projects/:projectId/deliverables') @RequireRole('editor') @Audit('audiovisual.deliverable.created')
  @ApiOperation({ summary: 'Create a deliverable inside the project' })
  create(
    @CurrentTenant() t: { id: string }, @CurrentUser() _u: JwtAuth,
    @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateDeliverableDto,
  ) {
    return this.svc.create(t.id, projectId, dto);
  }

  @Post('projects/:projectId/deliverables/seed-defaults') @RequireRole('editor')
  @Audit('audiovisual.deliverable.seeded_defaults')
  @ApiOperation({ summary: 'Create the default deliverables for the project type' })
  seed(
    @CurrentTenant() t: { id: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: { project_type: string },
  ) {
    return this.svc.seedDefaults(t.id, projectId, body.project_type);
  }

  @Patch('deliverables/:id') @RequireRole('editor') @Audit('audiovisual.deliverable.updated')
  @ApiOperation({ summary: 'Update a deliverable' })
  update(
    @CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliverableDto,
  ) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete('deliverables/:id') @RequireRole('manager') @Audit('audiovisual.deliverable.deleted')
  @ApiOperation({ summary: 'Remove a deliverable (soft delete)' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(t.id, id);
  }
}
