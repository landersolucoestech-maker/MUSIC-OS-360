/**
 * audit-log/audit-log.controller.ts
 *
 * GET /audit-logs   — paginated list with filters (OWNER/ADMIN only)
 * GET /audit-logs/:id — detail with the full diff (OWNER/ADMIN only)
 *
 * Append-only — no POST, PATCH or DELETE.
 * Isolation is guaranteed by tenant_id in every query.
 */

import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }         from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto, AdminListAuditLogsDto } from './dto/audit-log.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Listar audit trail paginado (todos os roles dentro do tenant)' })
  list(
    @CurrentTenant() t: { id: string },
    @Query() q: QueryAuditLogDto,
  ) {
    return this.svc.list(t.id, q);
  }

  // Admin route BEFORE ':id' — otherwise ':id' would capture 'admin'.
  @Get('admin')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'Listar audit trail de todos os tenants (painel Admin SaaS, super_admin)' })
  listAdmin(@Query() q: AdminListAuditLogsDto) {
    return this.svc.listAdmin(q);
  }

  @Get(':id')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Detalhe de um audit log com before/after (OWNER/ADMIN only)' })
  findById(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(t.id, id);
  }
}
