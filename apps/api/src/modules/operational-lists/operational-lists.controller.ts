import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { OperationalListsService } from './operational-lists.service';
import {
  CreateOperationalListItemDto,
  UpdateOperationalListItemDto,
  QueryOperationalListItemDto,
} from './dto/operational-lists.dto';
import type { JwtAuth } from '../../core/guards/auth.guard';

@ApiTags('Operational Lists') @ApiBearerAuth() @Controller('operational-list-items')
export class OperationalListsController {
  constructor(private readonly svc: OperationalListsService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'Listar itens de taxonomia operacional' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryOperationalListItemDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id') @RequireRole('viewer') @ApiOperation({ summary: 'Obter item de taxonomia operacional' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post() @RequireRole('editor') @Audit('operational_list_item.created') @ApiOperation({ summary: 'Criar item de taxonomia' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Body() dto: CreateOperationalListItemDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @Audit('operational_list_item.updated') @ApiOperation({ summary: 'Atualizar item de taxonomia' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperationalListItemDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @Audit('operational_list_item.deleted') @ApiOperation({ summary: 'Remover item de taxonomia' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
