import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { TransactionsService } from './transactions.service';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import {
  createTransactionSchema,
  patchTransactionSchema,
  type CreateTransactionDto,
  type PatchTransactionDto,
} from './validators/transaction.validator';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('transaction:read')
  @ApiOperation({ summary: 'Listar transações do tenant' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryTransactionDto) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats')
  @RequireRole('viewer')
  @RequirePermission('transaction:read')
  @ApiOperation({ summary: 'Distribuição exata type×status + soma de valor (tenant inteiro)' })
  stats(@CurrentTenant() tenant: { id: string }) {
    return this.service.stats(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('transaction:read')
  @ApiOperation({ summary: 'Obter transação por ID' })
  findById(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('financial')
  @RequirePermission('transaction:create')
  @Audit('transaction.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Criar transação (financial+)' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne duplicação de transações', required: false })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Body(new ZodValidationPipe(createTransactionSchema)) dto: CreateTransactionDto,
  ) {
    return this.service.create(tenant.id, user.userId, dto);
  }

  @Put(':id')
  @RequireRole('financial')
  @RequirePermission('transaction:update')
  @Audit('transaction.updated')
  @ApiOperation({ summary: 'Atualizar transação (financial+)' })
  replace(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createTransactionSchema)) dto: CreateTransactionDto,
  ) {
    return this.service.update(tenant.id, user.userId, id, dto);
  }

  @Patch(':id')
  @RequireRole('financial')
  @RequirePermission('transaction:update')
  @Audit('transaction.updated')
  @ApiOperation({ summary: 'Atualizar transação parcial (financial+)' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(patchTransactionSchema)) dto: PatchTransactionDto,
  ) {
    return this.service.patch(tenant.id, user.userId, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('transaction:cancel')
  @Audit('transaction.cancelled')
  @ApiOperation({ summary: 'Cancelar transação (manager+)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.softDelete(tenant.id, user.userId, id);
  }
}
