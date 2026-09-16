import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { BriefingsService } from './briefings.service';
import { CreateBriefingDto, UpdateBriefingDto, QueryBriefingDto } from './dto/briefings.dto';

@ApiTags('Briefings') @ApiBearerAuth() @Controller('briefings')
export class BriefingsController {
  constructor(private readonly svc: BriefingsService) {}

  @Get()    @RequireRole('viewer')  @ApiOperation({ summary: 'Listar briefings' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryBriefingDto) { return this.svc.list(t.id, q); }

  @Get(':id') @RequireRole('viewer') @ApiOperation({ summary: 'Obter briefing' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.findById(t.id, id); }

  @Post() @RequireRole('editor') @Audit('briefing.created') @ApiOperation({ summary: 'Criar briefing' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: { id: string }, @Body() dto: CreateBriefingDto) { return this.svc.create(t.id, u.id, dto); }

  @Patch(':id') @RequireRole('editor') @Audit('briefing.updated') @ApiOperation({ summary: 'Atualizar briefing' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBriefingDto) { return this.svc.update(t.id, id, dto); }

  @Delete(':id') @RequireRole('manager') @Audit('briefing.deleted') @ApiOperation({ summary: 'Arquivar briefing' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id); }
}
