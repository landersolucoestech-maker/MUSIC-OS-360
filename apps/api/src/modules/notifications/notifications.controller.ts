import {
  Controller, Get, Post, Patch,
  Body, Param, Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }   from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }     from '../../core/decorators/current-user.decorator';
import { RequireRole }     from '../../core/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationSettingsService } from './notification-settings.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { PaginationDto }         from '../../common/dto/pagination.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly settings: NotificationSettingsService,
  ) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List the authenticated user\'s notifications' })
  list(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string; orgId?: string | null; orgRole?: string | null },
    @Query()         query:  PaginationDto,
  ) {
    return this.service.list(tenant.id, user.userId, query, { orgId: user.orgId, role: user.orgRole });
  }

  @Get('unread-count')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Count unread notifications' })
  async countUnread(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string; orgId?: string | null; orgRole?: string | null },
  ) {
    const count = await this.service.countUnread(tenant.id, user.userId, { orgId: user.orgId, role: user.orgRole });
    return { count };
  }

  @Post()
  @RequireRole('manager')
  @ApiOperation({ summary: 'Create and enqueue a notification' })
  enqueue(
    @CurrentTenant() tenant: { id: string },
    @Body()          dto:    CreateNotificationDto,
  ) {
    return this.service.enqueue(tenant.id, dto);
  }

  @Patch(':id/read')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string; orgId?: string | null; orgRole?: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(tenant.id, id, { orgId: user.orgId, role: user.orgRole });
  }

  @Patch('read-all')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string; orgId?: string | null; orgRole?: string | null },
  ) {
    return this.service.markAllRead(tenant.id, user.userId, { orgId: user.orgId, role: user.orgRole });
  }

  // ─── Settings (per-tenant notification configuration) ─────────────────────────

  @Get('settings')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List the tenant\'s notification settings (with defaults)' })
  listSettings(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { orgId?: string | null; orgRole?: string | null },
  ) {
    return this.settings.list(tenant.id, { orgId: user.orgId, role: user.orgRole });
  }

  @Patch('settings')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Update the tenant\'s notification settings (admin+)' })
  updateSettings(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string; orgId?: string | null; orgRole?: string | null },
    @Body()          dto:    UpdateNotificationSettingsDto,
  ) {
    return this.settings.update(tenant.id, user.userId, dto.settings, { orgId: user.orgId, role: user.orgRole });
  }
}
