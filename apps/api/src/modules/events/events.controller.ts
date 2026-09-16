import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto/events.dto';

@ApiTags('Events') @ApiBearerAuth() @Controller('events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Get()    @RequireRole('viewer') @RequirePermission('event:read') @ApiOperation({ summary: 'Listar eventos' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryEventDto) { return this.svc.list(t.id, q); }

  @Get('stats') @RequireRole('viewer') @RequirePermission('event:read') @ApiOperation({ summary: 'KPIs exatos do tenant inteiro (status + próximos 7 dias)' })
  stats(@CurrentTenant() t: { id: string }) { return this.svc.stats(t.id); }

  @Get(':id') @RequireRole('viewer') @RequirePermission('event:read') @ApiOperation({ summary: 'Obter evento' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.findById(t.id, id); }

  @Post() @RequireRole('editor') @RequirePermission('event:create') @Audit('event.created') @ApiOperation({ summary: 'Criar evento' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateEventDto) { return this.svc.create(t.id, u?.userId ?? '', dto); }

  @Patch(':id') @RequireRole('editor') @RequirePermission('event:update') @Audit('event.updated') @ApiOperation({ summary: 'Atualizar evento' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) { return this.svc.update(t.id, u?.userId ?? '', id, dto); }

  @Delete(':id') @RequireRole('manager') @RequirePermission('event:delete') @Audit('event.deleted') @ApiOperation({ summary: 'Cancelar evento' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.softDelete(t.id, id); }
}
