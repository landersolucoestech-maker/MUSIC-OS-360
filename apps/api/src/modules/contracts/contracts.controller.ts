import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader, ApiExtraModels } from '@nestjs/swagger';
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
import { ContractPartyRefsDto }    from './dto/contract-party-ref.dto';

const PARTY_REFS_DESCRIPTION =
  'Each contract embeds `artist` {id, stage_name} and `client` {id, name} (null when absent). ' +
  'DEPRECATED: `artistas` / `clientes` (same projection, `clientes.nome` mirrors `name`) remain only for ' +
  'the deploy-skew window and are removed once every deployed web build reads `artist` / `client`. See ContractPartyRefsDto.';

@ApiTags('Contracts')
@ApiExtraModels(ContractPartyRefsDto)
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'List the tenant\'s contracts', description: PARTY_REFS_DESCRIPTION })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryContractDto) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats')
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Count + sum of value per status, over the whole tenant' })
  stats(@CurrentTenant() tenant: { id: string }) {
    return this.service.stats(tenant.id);
  }

  @Get('type-facets')
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Count of contracts per type (category slug), over the whole tenant' })
  typeFacets(@CurrentTenant() tenant: { id: string }) {
    return this.service.typeFacets(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('contract:read')
  @ApiOperation({ summary: 'Get a contract by ID', description: PARTY_REFS_DESCRIPTION })
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
  @ApiOperation({ summary: 'Create a contract' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate contract creation', required: false })
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
  @ApiOperation({ summary: 'Update a contract' })
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
  @ApiOperation({ summary: 'Cancel a contract (auditable soft delete)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.softDelete(tenant.id, user.userId, id);
  }
}
