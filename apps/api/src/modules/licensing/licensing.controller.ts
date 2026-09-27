import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { LicensingService } from './licensing.service';
import { CreateLicenseDto, UpdateLicenseDto, QueryLicenseDto } from './dto/licensing.dto';

@ApiTags('Licensing') @ApiBearerAuth() @Controller('licenses')
export class LicensingController {
  constructor(private readonly svc: LicensingService) {}

  @Get() @RequireRole('viewer') @RequirePermission('license:read') @ApiOperation({ summary: 'List licenses' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryLicenseDto) {
    return this.svc.list(t.id, q);
  }

  @Get('stats') @RequireRole('viewer') @RequirePermission('license:read') @ApiOperation({ summary: 'Count + sum of value per status, over the whole tenant' })
  stats(@CurrentTenant() t: { id: string }) {
    return this.svc.stats(t.id);
  }

  @Get(':id') @RequireRole('viewer') @RequirePermission('license:read') @ApiOperation({ summary: 'Get a license' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post() @RequireRole('editor') @RequirePermission('license:create') @Audit('license.created') @ApiOperation({ summary: 'Create a license' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateLicenseDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @RequirePermission('license:update') @Audit('license.updated') @ApiOperation({ summary: 'Update a license' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLicenseDto) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @RequirePermission('license:delete') @Audit('license.deleted') @ApiOperation({ summary: 'Remove a license' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(t.id, id);
  }
}
