import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { ContractServiceTypesService } from './contract-service-types.service';
import { CreateContractServiceTypeDto } from './dto/create-contract-service-type.dto';
import { UpdateContractServiceTypeDto } from './dto/update-contract-service-type.dto';

@ApiTags('Contract Service Types')
@ApiBearerAuth()
@Controller('contract-service-types')
export class ContractServiceTypesController {
  constructor(private readonly svc: ContractServiceTypesService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('contract_service_type:read')
  @ApiOperation({ summary: 'Listar tipos de serviço de contrato' })
  list(@CurrentTenant() t: { id: string }) {
    return this.svc.list(t.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('contract_service_type:read')
  @ApiOperation({ summary: 'Obter tipo de serviço por ID' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('contract_service_type:create')
  @Audit('contract_service_type.created')
  @ApiOperation({ summary: 'Criar tipo de serviço de contrato' })
  create(@CurrentTenant() t: { id: string }, @Body() dto: CreateContractServiceTypeDto) {
    return this.svc.create(t.id, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('contract_service_type:update')
  @Audit('contract_service_type.updated')
  @ApiOperation({ summary: 'Atualizar tipo de serviço de contrato' })
  update(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractServiceTypeDto,
  ) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('contract_service_type:archive')
  @Audit('contract_service_type.deleted')
  @ApiOperation({ summary: 'Arquivar (soft-delete) tipo de serviço de contrato' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
