import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto, QueryInvoiceDto } from './dto/invoices.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('invoice:read')
  @ApiOperation({ summary: 'Listar notas fiscais' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryInvoiceDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('invoice:read')
  @ApiOperation({ summary: 'Obter nota fiscal' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post()
  @RequireRole('financial')
  @RequirePermission('invoice:create')
  @Audit('invoice.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Criar nota fiscal (financial+)' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne duplicação de nota fiscal em duplo-clique/retry', required: false })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id')
  @RequireRole('financial')
  @RequirePermission('invoice:update')
  @Audit('invoice.updated')
  @ApiOperation({ summary: 'Atualizar nota fiscal (financial+)' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('invoice:cancel')
  @Audit('invoice.deleted')
  @ApiOperation({ summary: 'Cancelar nota fiscal (manager+)' })
  remove(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(t.id, u?.userId ?? '', id);
  }
}
