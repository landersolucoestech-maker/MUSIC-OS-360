import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../../core/guards/auth.guard';
import { SocietyAccountsService } from './society-accounts.service';
import { CreateSocietyAccountDto, UpdateSocietyAccountDto } from '../dto/society.dto';

@ApiTags('Registry · Society Accounts') @ApiBearerAuth() @Controller('registry/society-accounts')
export class SocietyAccountsController {
  constructor(private readonly svc: SocietyAccountsService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'List society accounts' })
  list(@CurrentTenant() t: { id: string }) {
    return this.svc.list(t.id);
  }

  @Post() @RequireRole('manager') @Audit('registry.society_account.created') @ApiOperation({ summary: 'Create a society account' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateSocietyAccountDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('manager') @Audit('registry.society_account.updated') @ApiOperation({ summary: 'Update an account' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSocietyAccountDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @Audit('registry.society_account.deleted') @ApiOperation({ summary: 'Archive an account' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
