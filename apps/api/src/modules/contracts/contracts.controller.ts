import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { CurrentTenant }   from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }     from '../../core/decorators/current-user.decorator';
import { RequireRole }     from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }    from '../../core/guards/auth.guard';
import { ContractsService }        from './contracts.service';
import { CreateContractDto }       from './dto/create-contract.dto';
import { UpdateContractDto }       from './dto/update-contract.dto';
import { QueryContractDto }        from './dto/query-contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Listar contratos do tenant' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryContractDto) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats')
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Contagem + soma de valor por status, sobre o tenant inteiro' })
  stats(@CurrentTenant() tenant: { id: string }) {
    return this.service.stats(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Obter contrato por ID' })
  findById(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findById(tenant.id, id, user?.orgRole ?? undefined);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('contract:create')
  @Audit('contract.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Criar contrato' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne criação de contratos duplicados', required: false })
  create(
    @CurrentTenant() tenant: { id: string; org_id?: string },
    @CurrentUser()   user:   JwtAuth,
    @Body()          dto:    CreateContractDto,
  ) {
    return this.service.create(tenant.id, user.userId, dto, tenant.org_id ?? user.orgId ?? undefined);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('contract:update')
  @Audit('contract.updated')
  @ApiOperation({ summary: 'Atualizar contrato' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto:    UpdateContractDto,
  ) {
    return this.service.update(tenant.id, user.userId, id, dto, user?.orgRole ?? undefined);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('contract:cancel')
  @Audit('contract.cancelled')
  @ApiOperation({ summary: 'Cancelar contrato (soft delete auditável)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.softDelete(tenant.id, user.userId, id);
  }
}
