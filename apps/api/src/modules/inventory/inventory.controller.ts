import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto, QueryInventoryDto } from './dto/inventory.dto';

@ApiTags('Inventory') @ApiBearerAuth() @Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get() @RequireRole('viewer') @RequirePermission('inventory:read') @ApiOperation({ summary: 'Listar itens de inventário' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryInventoryDto) {
    return this.svc.list(t.id, q);
  }

  // Must come before @Get(':id') — otherwise Nest matches "stats" as :id.
  @Get('stats') @RequireRole('viewer') @RequirePermission('inventory:read') @ApiOperation({ summary: 'Contagem por status + soma de valor, sobre o tenant inteiro' })
  stats(@CurrentTenant() t: { id: string }) {
    return this.svc.stats(t.id);
  }

  @Get(':id') @RequireRole('viewer') @RequirePermission('inventory:read') @ApiOperation({ summary: 'Obter item de inventário' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post() @RequireRole('editor') @RequirePermission('inventory:create') @Audit('inventory.created') @ApiOperation({ summary: 'Criar item de inventário' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateInventoryItemDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @RequirePermission('inventory:update') @Audit('inventory.updated') @ApiOperation({ summary: 'Atualizar item de inventário' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @RequirePermission('inventory:delete') @Audit('inventory.deleted') @ApiOperation({ summary: 'Remover item de inventário' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(t.id, id);
  }
}
