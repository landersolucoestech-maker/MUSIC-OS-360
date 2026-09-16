import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { ClientsService } from './clients.service';
import {
  CreateClientDto, UpdateClientDto, QueryClientDto,
  CreateClientTimelineEntryDto, PresignClientAttachmentDto, ConfirmClientAttachmentDto,
} from './dto/clients.dto';

@ApiTags('Clients') @ApiBearerAuth() @Controller('clients')
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()    @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Listar clientes' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryClientDto) { return this.svc.list(t.id, q); }

  @Get(':id') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Obter cliente' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.findById(t.id, id); }

  @Post() @RequireRole('editor') @RequirePermission('client:create') @Audit('client.created') @ApiOperation({ summary: 'Criar cliente' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateClientDto) { return this.svc.create(t.id, u?.userId ?? '', dto); }

  @Patch(':id') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.updated') @ApiOperation({ summary: 'Atualizar cliente' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) { return this.svc.update(t.id, u?.userId ?? '', id, dto); }

  @Delete(':id') @RequireRole('manager') @RequirePermission('client:delete') @Audit('client.deleted') @ApiOperation({ summary: 'Remover cliente' })
  remove(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id, u?.userId); }

  // ── Timeline ──────────────────────────────────────────────────────────────
  @Get(':id/timeline') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Timeline do cliente (eventos reais, persistidos)' })
  getTimeline(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string) {
    return this.svc.getTimeline(t.id, id, limit ? Number(limit) : undefined);
  }

  @Post(':id/timeline') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.timeline_entry_added')
  @ApiOperation({ summary: 'Adicionar entrada manual à timeline (nota, ligação, reunião)' })
  addTimelineEntry(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateClientTimelineEntryDto) {
    return this.svc.addTimelineEntry(t.id, u?.userId ?? '', id, dto);
  }

  // ── Contratos vinculados ─────────────────────────────────────────────────
  @Get(':id/contracts') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Contratos vinculados ao cliente (contracts.client_id)' })
  getContracts(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getContracts(t.id, id);
  }

  // ── Anexos (metadata real; binário no Cloudflare R2) ────────────────────
  @Get(':id/attachments') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Listar anexos do cliente' })
  listAttachments(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listAttachments(t.id, id);
  }

  @Post(':id/attachments/presign') @RequireRole('editor') @RequirePermission('client:update')
  @ApiOperation({ summary: 'Gera URL pré-assinada de upload direto ao R2 (503 se R2 não configurado)' })
  presignAttachment(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PresignClientAttachmentDto) {
    return this.svc.presignAttachmentUpload(t.id, u?.userId ?? '', id, dto);
  }

  @Post(':id/attachments') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.attachment_added')
  @ApiOperation({ summary: 'Confirma upload concluído no R2 e persiste a metadata' })
  confirmAttachment(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmClientAttachmentDto) {
    return this.svc.confirmAttachmentUpload(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id/attachments/:attachmentId') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.attachment_removed')
  @ApiOperation({ summary: 'Remove anexo (metadata + objeto no R2)' })
  removeAttachment(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.svc.removeAttachment(t.id, u?.userId ?? '', id, attachmentId);
  }
}
