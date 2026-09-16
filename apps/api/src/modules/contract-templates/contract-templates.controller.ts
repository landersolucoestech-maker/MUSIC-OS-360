import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { ContractTemplatesService }    from './contract-templates.service';
import { CreateContractTemplateDto }   from './dto/create-contract-template.dto';
import { UpdateContractTemplateDto }   from './dto/update-contract-template.dto';
import { QueryContractTemplateDto }    from './dto/query-contract-template.dto';

@ApiTags('Contract Templates')
@ApiBearerAuth()
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(private readonly svc: ContractTemplatesService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('contract_template:read')
  @ApiOperation({ summary: 'Listar templates de contrato' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryContractTemplateDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('contract_template:read')
  @ApiOperation({ summary: 'Obter template por ID' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('contract_template:create')
  @Audit('contract_template.created')
  @ApiOperation({ summary: 'Criar template' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateContractTemplateDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('contract_template:update')
  @Audit('contract_template.updated')
  @ApiOperation({ summary: 'Atualizar template' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractTemplateDto) {
    return this.svc.update(t.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('contract_template:archive')
  @Audit('contract_template.deleted')
  @ApiOperation({ summary: 'Arquivar template' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
