import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import { AudiovisualShotsService, type CreateShotInput, type UpdateShotInput } from './shots.service';

@ApiTags('Audiovisual — Shots')
@ApiBearerAuth()
@Controller('audiovisual')
export class AudiovisualShotsController {
  constructor(private readonly svc: AudiovisualShotsService) {}

  @Get('projects/:projectId/shots') @RequireRole('viewer')
  @ApiOperation({ summary: 'List the project\'s shots (ordered)' })
  list(@CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listByProject(t.id, projectId);
  }

  @Post('projects/:projectId/shots') @RequireRole('editor') @Audit('audiovisual.shot.created')
  @ApiOperation({ summary: 'Create a shot (ordering is automatic when omitted)' })
  create(
    @CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateShotInput,
  ) {
    return this.svc.create(t.id, projectId, dto);
  }

  @Post('projects/:projectId/shots/reorder') @RequireRole('editor') @Audit('audiovisual.shot.reordered')
  @ApiOperation({ summary: 'Reorder shots (list of IDs in the desired order)' })
  reorder(
    @CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: { ids: string[] },
  ) {
    return this.svc.reorder(t.id, projectId, body.ids);
  }

  @Patch('shots/:id') @RequireRole('editor') @Audit('audiovisual.shot.updated')
  @ApiOperation({ summary: 'Update a shot' })
  update(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShotInput) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete('shots/:id') @RequireRole('editor') @Audit('audiovisual.shot.deleted')
  @ApiOperation({ summary: 'Remover shot (soft-delete)' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
