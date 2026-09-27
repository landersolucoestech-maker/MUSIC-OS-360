import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { SupportRequestsService } from './support-requests.service';
import { CreateSupportRequestDto } from './dto/support-requests.dto';

@ApiTags('SupportRequests') @ApiBearerAuth() @Controller('support-requests')
export class SupportRequestsController {
  constructor(private readonly svc: SupportRequestsService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'List requests (ordered by votes)' })
  list(@CurrentTenant() t: { id: string }) {
    return this.svc.list(t.id);
  }

  @Post() @RequireRole('viewer') @Audit('support-request.created') @ApiOperation({ summary: 'Create a request' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Body()          dto: CreateSupportRequestDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? 'unknown', dto);
  }

  @Post(':id/upvote') @RequireRole('viewer') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Vote on a request' })
  upvote(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.upvote(t.id, id);
  }
}
