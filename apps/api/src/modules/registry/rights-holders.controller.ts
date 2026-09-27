import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { RightsHoldersService } from './rights-holders.service';
import { CreateRightsHolderDto, UpdateRightsHolderDto, QueryRightsHolderDto } from './dto/rights-holder.dto';

@ApiTags('Registry · Rights Holders') @ApiBearerAuth() @Controller('registry/rights-holders')
export class RightsHoldersController {
  constructor(private readonly svc: RightsHoldersService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'List rights holders' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryRightsHolderDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id') @RequireRole('viewer') @ApiOperation({ summary: 'Get a rights holder' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post() @RequireRole('editor') @Audit('registry.rights_holder.created') @ApiOperation({ summary: 'Create a rights holder' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateRightsHolderDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @Audit('registry.rights_holder.updated') @ApiOperation({ summary: 'Update a rights holder' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRightsHolderDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @Audit('registry.rights_holder.deleted') @ApiOperation({ summary: 'Archive a rights holder' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
