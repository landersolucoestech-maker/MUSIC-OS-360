import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
  HttpCode, HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant }  from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }    from '../../core/decorators/current-user.decorator';
import { RequireRole }    from '../../core/decorators/roles.decorator';
import { Audit }          from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { ConversationsService } from './conversations.service';
import type { JwtAuth }   from '../../core/guards/auth.guard';
import {
  CreateConversationDto,
  UpdateConversationDto,
  QueryConversationDto,
  CreateMessageDto,
  CreateNoteDto,
  AssignConversationDto,
  CloseConversationDto,
  ReopenConversationDto,
  TransferConversationDto,
} from './dto/conversations.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  // ── Conversations ──────────────────────────────────────────────────────────

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List the tenant\'s conversations' })
  list(
    @CurrentTenant() tenant: { id: string },
    @Query() query: QueryConversationDto,
  ) {
    return this.service.listConversations(tenant.id, query);
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  findById(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findConversationById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @Audit('conversation.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create a conversation' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate creation', required: false })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Body()          dto:    CreateConversationDto,
  ) {
    return this.service.createConversation(tenant.id, user.userId, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @Audit('conversation.updated')
  @ApiOperation({ summary: 'Update a conversation (status, channel, assignee)' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.updateConversation(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @Audit('conversation.deleted')
  @ApiOperation({ summary: 'Archive a conversation (soft delete)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.softDeleteConversation(tenant.id, id);
  }

  // ── Assignment ────────────────────────────────────────────────────────────

  @Patch(':id/assign')
  @RequireRole('editor')
  @Audit('conversation.assigned')
  @ApiOperation({ summary: 'Assign a conversation to a team member' })
  assign(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.service.assign(tenant.id, id, dto.assignee_id ?? null);
  }

  @Patch(':id/transfer')
  @RequireRole('editor')
  @Audit('conversation.transferred')
  @ApiOperation({ summary: 'Transfer a conversation between queues, departments or assignees' })
  transfer(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferConversationDto,
  ) {
    return this.service.transfer(tenant.id, user.userId, id, dto);
  }

  @Patch(':id/close')
  @RequireRole('editor')
  @Audit('conversation.closed')
  @ApiOperation({ summary: 'Close a conversation with a reason and CRM actions' })
  close(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseConversationDto,
  ) {
    return this.service.close(tenant.id, user.userId, id, dto);
  }

  @Patch(':id/reopen')
  @RequireRole('editor')
  @Audit('conversation.reopened')
  @ApiOperation({ summary: 'Reopen a closed conversation' })
  reopen(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenConversationDto,
  ) {
    return this.service.reopen(tenant.id, user.userId, id, dto);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get(':id/messages')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List conversation messages' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  listMessages(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit')  limit?:  string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listMessages(tenant.id, id, limit ? Number(limit) : 50, offset ? Number(offset) : 0);
  }

  @Post(':id/messages')
  @RequireRole('editor')
  @Audit('conversation.message_sent')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Send a message in the conversation' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate sends (e.g. double click / network retry)', required: false })
  addMessage(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.addMessage(tenant.id, user.userId, id, dto);
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  @Get(':id/notes')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List the conversation\'s internal notes' })
  listNotes(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listNotes(tenant.id, id);
  }

  @Post(':id/notes')
  @RequireRole('editor')
  @Audit('conversation.note_added')
  @ApiOperation({ summary: 'Add an internal note' })
  addNote(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.addNote(tenant.id, user.userId, id, dto);
  }
}
