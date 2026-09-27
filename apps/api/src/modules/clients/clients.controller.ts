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
import { DealsCrmAutomation } from '../../core/automation/deals-crm.automation';

@ApiTags('Clients') @ApiBearerAuth() @Controller('clients')
export class ClientsController {
  constructor(
    private readonly svc: ClientsService,
    private readonly dealsCrm: DealsCrmAutomation,
  ) {}

  @Get()    @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'List clients' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryClientDto) { return this.svc.list(t.id, q); }

  @Get(':id') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Get a client' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.findById(t.id, id); }

  @Post() @RequireRole('editor') @RequirePermission('client:create') @Audit('client.created') @ApiOperation({ summary: 'Create a client' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateClientDto) { return this.svc.create(t.id, u?.userId ?? '', dto); }

  @Patch(':id') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.updated') @ApiOperation({ summary: 'Update a client' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) { return this.svc.update(t.id, u?.userId ?? '', id, dto); }

  @Delete(':id') @RequireRole('manager') @RequirePermission('client:delete') @Audit('client.deleted') @ApiOperation({ summary: 'Remove a client' })
  remove(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id, u?.userId); }

  // ── Timeline ──────────────────────────────────────────────────────────────
  @Get(':id/timeline') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Client timeline (real, persisted events)' })
  getTimeline(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string) {
    return this.svc.getTimeline(t.id, id, limit ? Number(limit) : undefined);
  }

  @Post(':id/timeline') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.timeline_entry_added')
  @ApiOperation({ summary: 'Add a manual timeline entry (note, call, meeting)' })
  addTimelineEntry(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateClientTimelineEntryDto) {
    return this.svc.addTimelineEntry(t.id, u?.userId ?? '', id, dto);
  }

  // ── Linked contracts ─────────────────────────────────────────────────
  @Get(':id/contracts') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'Contracts linked to the client (contracts.client_id)' })
  getContracts(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getContracts(t.id, id);
  }

  @Post(':id/ai/deals-crm') @RequireRole('viewer') @RequirePermission('client:read')
  @ApiOperation({ summary: 'AI Skill deals-crm — analysis of the client\'s real commercial pipeline (contracts)' })
  runDealsCrm(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.dealsCrm.run(t.id, u?.userId ?? '', id);
  }

  // ── Attachments (real metadata; binary in Cloudflare R2) ──────────────────
  @Get(':id/attachments') @RequireRole('viewer') @RequirePermission('client:read') @ApiOperation({ summary: 'List client attachments' })
  listAttachments(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listAttachments(t.id, id);
  }

  @Post(':id/attachments/presign') @RequireRole('editor') @RequirePermission('client:update')
  @ApiOperation({ summary: 'Generate a presigned URL for direct upload to R2 (503 if R2 is not configured)' })
  presignAttachment(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PresignClientAttachmentDto) {
    return this.svc.presignAttachmentUpload(t.id, u?.userId ?? '', id, dto);
  }

  @Post(':id/attachments') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.attachment_added')
  @ApiOperation({ summary: 'Confirm a completed R2 upload and persist its metadata' })
  confirmAttachment(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmClientAttachmentDto) {
    return this.svc.confirmAttachmentUpload(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id/attachments/:attachmentId') @RequireRole('editor') @RequirePermission('client:update') @Audit('client.attachment_removed')
  @ApiOperation({ summary: 'Remove an attachment (metadata + R2 object)' })
  removeAttachment(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.svc.removeAttachment(t.id, u?.userId ?? '', id, attachmentId);
  }
}
