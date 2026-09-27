import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { ExternalIdentifierService } from './external-identifiers.service';
import { CreateExternalIdentifierDto, UpdateExternalIdentifierDto } from './dto/external-identifier.dto';

@ApiTags('Registry · Identifiers') @ApiBearerAuth() @Controller('registry')
export class ExternalIdentifiersController {
  constructor(private readonly svc: ExternalIdentifierService) {}

  @Get('entities/:entityType/:entityId/identifiers')
  @RequireRole('viewer') @ApiOperation({ summary: 'List the entity\'s identifiers' })
  list(
    @CurrentTenant() t: { id: string },
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.svc.listByEntity(t.id, entityType, entityId);
  }

  @Post('entities/:entityType/:entityId/identifiers')
  @RequireRole('editor') @Audit('registry.identifier.created') @ApiOperation({ summary: 'Add an identifier' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Body() dto: CreateExternalIdentifierDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', entityType, entityId, dto);
  }

  @Patch('identifiers/:id')
  @RequireRole('editor') @Audit('registry.identifier.updated') @ApiOperation({ summary: 'Update an identifier' })
  update(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExternalIdentifierDto,
  ) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete('identifiers/:id')
  @RequireRole('manager') @Audit('registry.identifier.deleted') @ApiOperation({ summary: 'Remove an identifier' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
