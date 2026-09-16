import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }   from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }     from '../../core/decorators/current-user.decorator';
import { RequireRole }     from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { WorksService }    from './works.service';
import { CreateWorkDto }   from './dto/create-work.dto';
import { UpdateWorkDto }   from './dto/update-work.dto';
import { QueryWorkDto }    from './dto/query-work.dto';

@ApiTags('Works')
@ApiBearerAuth()
@Controller('works')
export class WorksController {
  constructor(private readonly service: WorksService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('work:read')
  @ApiOperation({ summary: 'Listar obras do tenant' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryWorkDto) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats')
  @RequireRole('viewer')
  @RequirePermission('work:read')
  @ApiOperation({ summary: 'Contagem exata de obras por status (tenant inteiro)' })
  stats(@CurrentTenant() tenant: { id: string }, @Query() query: QueryWorkDto) {
    return this.service.stats(tenant.id, query);
  }

  @Get('stats/generos')
  @RequireRole('viewer')
  @RequirePermission('work:read')
  @ApiOperation({ summary: 'Gêneros distintos das obras do tenant' })
  distinctGeneros(@CurrentTenant() tenant: { id: string }) {
    return this.service.distinctGeneros(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('work:read')
  @ApiOperation({ summary: 'Obter obra por ID' })
  findById(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('work:create')
  @Audit('work.created')
  @ApiOperation({ summary: 'Criar obra musical' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Body()          dto:    CreateWorkDto,
  ) {
    return this.service.create(tenant.id, user.userId, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('work:update')
  @Audit('work.updated')
  @ApiOperation({ summary: 'Atualizar obra' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto:    UpdateWorkDto,
  ) {
    return this.service.update(tenant.id, user.userId, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('work:delete')
  @Audit('work.deleted')
  @ApiOperation({ summary: 'Remover obra (soft delete)' })
  remove(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(tenant.id, id);
  }
}
