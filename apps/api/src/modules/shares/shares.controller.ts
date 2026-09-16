import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { SharesService } from './shares.service';
import { CreateShareDto, UpdateShareDto, QueryShareDto } from './dto/shares.dto';

@ApiTags('Shares') @ApiBearerAuth() @Controller('shares')
export class SharesController {
  constructor(private readonly svc: SharesService) {}

  @Get()    @RequireRole('viewer') @RequirePermission('share:read') @ApiOperation({ summary: 'Listar shares' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryShareDto) { return this.svc.list(t.id, q); }

  @Get('stats') @RequireRole('viewer') @RequirePermission('share:read') @ApiOperation({ summary: 'Distribuição exata direção×status (tenant inteiro)' })
  stats(@CurrentTenant() t: { id: string }, @Query() q: QueryShareDto) { return this.svc.stats(t.id, q); }

  @Get(':id') @RequireRole('viewer') @RequirePermission('share:read') @ApiOperation({ summary: 'Obter share' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.findById(t.id, id); }

  @Post() @RequireRole('editor') @RequirePermission('share:create') @Audit('share.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Criar share' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne duplicação de share em duplo-clique/retry', required: false })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() _u: any, @Body() dto: CreateShareDto) { return this.svc.create(t.id, dto); }

  @Patch(':id') @RequireRole('editor') @RequirePermission('share:update') @Audit('share.updated') @ApiOperation({ summary: 'Atualizar share' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() _u: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShareDto) { return this.svc.update(t.id, id, dto); }

  @Delete(':id') @RequireRole('manager') @RequirePermission('share:delete') @Audit('share.deleted') @ApiOperation({ summary: 'Inactivar share' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id); }
}
