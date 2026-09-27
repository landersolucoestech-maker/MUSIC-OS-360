import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../../core/guards/auth.guard';
import { AudiovisualApprovalsService } from './approvals.service';
import {
  RequestApprovalDto, ApprovalDecisionDto, QueryApprovalDto,
} from '../dto/audiovisual.dto';

@ApiTags('Audiovisual — Approvals')
@ApiBearerAuth()
@Controller('audiovisual')
export class AudiovisualApprovalsController {
  constructor(private readonly svc: AudiovisualApprovalsService) {}

  @Get('approvals') @RequireRole('viewer') @ApiOperation({ summary: 'List approvals' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryApprovalDto) {
    return this.svc.list(t.id, q);
  }

  @Get('approvals/:id') @RequireRole('viewer') @ApiOperation({ summary: 'Get an approval' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post('projects/:projectId/approvals') @RequireRole('editor') @Audit('audiovisual.approval.requested')
  @ApiOperation({ summary: 'Request an approval (project or specific deliverable)' })
  request(
    @CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth,
    @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: RequestApprovalDto,
  ) {
    return this.svc.request(t.id, u?.userId ?? '', projectId, dto);
  }

  @Post('approvals/:id/decision') @RequireRole('manager') @Audit('audiovisual.approval.decided')
  @ApiOperation({ summary: 'Decide an approval (approve / reject / revision_requested)' })
  decide(
    @CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApprovalDecisionDto,
  ) {
    return this.svc.decide(t.id, u?.userId ?? '', id, dto);
  }
}
