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
import { PhonogramsService }       from './phonograms.service';
import { CreatePhonogramDto }      from './dto/create-phonogram.dto';
import { UpdatePhonogramDto }      from './dto/update-phonogram.dto';
import { QueryPhonogramDto }       from './dto/query-phonogram.dto';

@ApiTags('Phonograms')
@ApiBearerAuth()
@Controller('phonograms')
export class PhonogramsController {
  constructor(private readonly service: PhonogramsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('phonogram:read')
  @ApiOperation({ summary: 'Listar fonogramas do tenant' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryPhonogramDto) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats')
  @RequireRole('viewer')
  @RequirePermission('phonogram:read')
  @ApiOperation({ summary: 'Contagem exata de fonogramas por status (tenant inteiro)' })
  stats(@CurrentTenant() tenant: { id: string }, @Query() query: QueryPhonogramDto) {
    return this.service.stats(tenant.id, query);
  }

  @Get('stats/generos')
  @RequireRole('viewer')
  @RequirePermission('phonogram:read')
  @ApiOperation({ summary: 'Gêneros distintos dos fonogramas do tenant' })
  distinctGeneros(@CurrentTenant() tenant: { id: string }) {
    return this.service.distinctGeneros(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('phonogram:read')
  @ApiOperation({ summary: 'Obter fonograma por ID' })
  findById(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('phonogram:create')
  @Audit('phonogram.created')
  @ApiOperation({ summary: 'Criar fonograma' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Body()          dto:    CreatePhonogramDto,
  ) {
    return this.service.create(tenant.id, user.userId, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('phonogram:update')
  @Audit('phonogram.updated')
  @ApiOperation({ summary: 'Atualizar fonograma' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto:    UpdatePhonogramDto,
  ) {
    return this.service.update(tenant.id, user.userId, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('phonogram:delete')
  @Audit('phonogram.deleted')
  @ApiOperation({ summary: 'Remover fonograma (soft delete)' })
  remove(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(tenant.id, id);
  }
}
