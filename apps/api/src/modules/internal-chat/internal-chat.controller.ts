import {
  Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { InternalChatService } from './internal-chat.service';
import type { JwtAuth } from '../../core/guards/auth.guard';
import {
  CreateInternalConversationDto,
  CreateInternalMessageDto,
  QueryInternalMembersDto,
} from './dto/internal-chat.dto';

/**
 * Internal Chat (team <-> team) — API isolated from the Service Center
 * (`/conversations`, team <-> external public). It never shares a route,
 * service, entity or authorization model with that module.
 */
@ApiTags('Internal Chat')
@ApiBearerAuth()
@Controller('internal-chat')
export class InternalChatController {
  constructor(private readonly service: InternalChatService) {}

  @Get('conversations')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List my internal conversations' })
  listConversations(@CurrentTenant() tenant: { id: string }, @CurrentUser() user: JwtAuth) {
    return this.service.listMyConversations(tenant.id, user.userId);
  }

  @Get('conversations/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get an internal conversation by ID' })
  findConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findConversationById(tenant.id, user.userId, id);
  }

  // No @Audit here either, deliberately: the group `name` is user-authored content (e.g.
  // "Demissão do Pedro"), and the audit log is readable by any tenant 'viewer' — the same
  // confidentiality bypass as the message-body leak on sendMessage below, just on
  // conversation metadata instead of message content.
  @Post('conversations')
  @RequireRole('viewer')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create an internal conversation (direct or group)' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate creation', required: false })
  createConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: CreateInternalConversationDto,
  ) {
    return this.service.createConversation(tenant.id, user.orgId ?? tenant.id, user.userId, dto);
  }

  @Get('conversations/:id/messages')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List internal conversation messages' })
  listMessages(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listMessages(tenant.id, user.userId, id);
  }

  // No @Audit here either — same reasoning as createConversation above: this would
  // mirror the message body into the viewer-readable audit log.
  @Post('conversations/:id/messages')
  @RequireRole('viewer')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Send a message in the internal conversation' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate messages', required: false })
  sendMessage(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInternalMessageDto,
  ) {
    return this.service.sendMessage(tenant.id, user.userId, id, dto);
  }

  @Post('conversations/:id/read')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Mark an internal conversation as read' })
  markRead(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(tenant.id, user.userId, id);
  }

  @Get('members')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Search organization colleagues to start an internal conversation' })
  searchMembers(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Query() query: QueryInternalMembersDto,
  ) {
    return this.service.searchMembers(tenant.id, user.userId, query);
  }
}
