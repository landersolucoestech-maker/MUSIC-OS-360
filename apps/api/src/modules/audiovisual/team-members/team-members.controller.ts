import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import { AudiovisualTeamMembersService, type CreateTeamMemberInput } from './team-members.service';

@ApiTags('Audiovisual — Team Members')
@ApiBearerAuth()
@Controller('audiovisual')
export class AudiovisualTeamMembersController {
  constructor(private readonly svc: AudiovisualTeamMembersService) {}

  @Get('projects/:projectId/team') @RequireRole('viewer')
  @ApiOperation({ summary: 'List project team members' })
  list(@CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listByProject(t.id, projectId);
  }

  @Post('projects/:projectId/team') @RequireRole('editor') @Audit('audiovisual.team_member.created')
  @ApiOperation({ summary: 'Add a team member' })
  create(
    @CurrentTenant() t: { id: string }, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTeamMemberInput,
  ) {
    return this.svc.create(t.id, projectId, dto);
  }

  @Patch('team/:id') @RequireRole('editor') @Audit('audiovisual.team_member.updated')
  @ApiOperation({ summary: 'Update a team member' })
  update(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateTeamMemberInput>) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete('team/:id') @RequireRole('editor') @Audit('audiovisual.team_member.deleted')
  @ApiOperation({ summary: 'Remove a team member' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
