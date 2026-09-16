import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { SupportTicketsService } from './support-tickets.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto, QuerySupportTicketDto, CreateSupportTicketMessageDto, AdminListSupportTicketsDto } from './dto/support-tickets.dto';

const ADMIN_ORG_ROLES = new Set(['owner', 'admin', 'super_admin']);

function senderName(u: JwtAuth): string {
  const email = u?.claims?.['email'];
  return typeof email === 'string' && email.length > 0 ? email : (u?.userId ?? 'unknown');
}

function senderRole(u: JwtAuth): 'support' | 'admin' {
  return u?.orgRole && ADMIN_ORG_ROLES.has(u.orgRole) ? 'admin' : 'support';
}

@ApiTags('SupportTickets') @ApiBearerAuth() @Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly svc: SupportTicketsService) {}

  @Get() @RequireRole('manager') @ApiOperation({ summary: 'Listar tickets de suporte' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QuerySupportTicketDto) {
    return this.svc.list(t.id, q);
  }

  // Rota pública admin ANTES de ':id' — do contrário ':id' capturaria 'admin'.
  @Get('admin') @RequireRole('super_admin')
  @ApiOperation({ summary: 'Listar tickets de todos os tenants (painel Admin SaaS, super_admin)' })
  listAdmin(@Query() q: AdminListSupportTicketsDto) {
    return this.svc.listAdmin(q);
  }

  @Get(':id') @RequireRole('manager') @ApiOperation({ summary: 'Obter ticket de suporte' })
  findById(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(t.id, id, u?.orgRole ?? undefined);
  }

  @Post() @RequireRole('viewer') @Audit('support-ticket.created') @ApiOperation({ summary: 'Criar ticket de suporte' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Body()          dto: CreateSupportTicketDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? 'unknown', dto);
  }

  @Patch(':id') @RequireRole('manager') @Audit('support-ticket.updated') @ApiOperation({ summary: 'Atualizar ticket de suporte' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto: UpdateSupportTicketDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? 'unknown', id, dto, u?.orgRole ?? undefined);
  }

  @Delete(':id') @RequireRole('manager') @Audit('support-ticket.deleted') @ApiOperation({ summary: 'Fechar ticket de suporte' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }

  @Get(':id/messages') @RequireRole('manager') @ApiOperation({ summary: 'Listar mensagens do ticket' })
  listMessages(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listMessages(t.id, id);
  }

  @Post(':id/messages') @RequireRole('manager') @Audit('support-ticket.message_sent') @ApiOperation({ summary: 'Responder ticket de suporte' })
  addMessage(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto: CreateSupportTicketMessageDto,
  ) {
    return this.svc.addMessage(
      t.id,
      id,
      { id: u?.userId ?? 'unknown', name: senderName(u), role: senderRole(u) },
      dto,
    );
  }
}
