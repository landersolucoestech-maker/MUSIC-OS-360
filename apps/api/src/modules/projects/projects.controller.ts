import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, QueryProjectDto } from './dto/projects.dto';

@ApiTags('Projects') @ApiBearerAuth() @Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get() @RequireRole('viewer') @RequirePermission('project:read') @ApiOperation({ summary: 'Listar projectos' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryProjectDto) {
    return this.svc.list(t.id, q);
  }

  // Precisa vir ANTES de @Get(':id') — senão o Nest casa "stats" como :id.
  @Get('stats') @RequireRole('viewer') @RequirePermission('project:read') @ApiOperation({ summary: 'Contagem por status, sobre o tenant inteiro' })
  stats(@CurrentTenant() t: { id: string }) {
    return this.svc.stats(t.id);
  }

  @Get(':id') @RequireRole('viewer') @RequirePermission('project:read') @ApiOperation({ summary: 'Obter projecto' })
  findById(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(t.id, id, u?.orgRole ?? undefined);
  }

  @Post() @RequireRole('editor') @RequirePermission('project:create') @Audit('project.created') @ApiOperation({ summary: 'Criar projecto' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Body()          dto: CreateProjectDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @RequirePermission('project:update') @Audit('project.updated') @ApiOperation({ summary: 'Atualizar projecto' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto: UpdateProjectDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto, u?.orgRole ?? undefined);
  }

  @Delete(':id') @RequireRole('manager') @RequirePermission('project:delete') @Audit('project.deleted') @ApiOperation({ summary: 'Cancelar projecto' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(t.id, id);
  }
}
