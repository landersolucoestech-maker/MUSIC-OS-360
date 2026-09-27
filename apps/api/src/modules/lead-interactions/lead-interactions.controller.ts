import { Controller, Get, Post, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { LeadInteractionsService } from './lead-interactions.service';
import { CreateLeadInteractionDto, QueryLeadInteractionDto } from './dto/lead-interactions.dto';

@ApiTags('Lead Interactions') @ApiBearerAuth() @Controller('lead-interactions')
export class LeadInteractionsController {
  constructor(private readonly svc: LeadInteractionsService) {}

  @Get()  @RequireRole('viewer') @RequirePermission('lead_interaction:read') @ApiOperation({ summary: 'List lead interactions' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryLeadInteractionDto) { return this.svc.list(t.id, q); }

  @Post() @RequireRole('editor') @RequirePermission('lead_interaction:create') @Audit('lead_interaction.created') @ApiOperation({ summary: 'Register an interaction' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: { userId: string }, @Body() dto: CreateLeadInteractionDto) { return this.svc.create(t.id, u.userId, dto); }

  @Delete(':id') @RequireRole('manager') @RequirePermission('lead_interaction:delete') @Audit('lead_interaction.deleted') @ApiOperation({ summary: 'Remove an interaction' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id); }
}
