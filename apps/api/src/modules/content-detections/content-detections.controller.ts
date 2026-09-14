import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }               from '../../core/decorators/current-tenant.decorator';
import { RequireRole }                 from '../../core/decorators/roles.decorator';
import { ContentDetectionsService }    from './content-detections.service';
import { CreateContentDetectionDto }   from './dto/create-content-detection.dto';
import { UpdateContentDetectionDto }   from './dto/update-content-detection.dto';

@ApiTags('ContentDetections')
@ApiBearerAuth()
@Controller('content-detections')
export class ContentDetectionsController {
  constructor(private readonly svc: ContentDetectionsService) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Listar detecções de conteúdo do tenant' })
  list(
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('plataforma') plataforma?: string,
    @Query('artist_id') artist_id?: string,
    @Query('work_id') work_id?: string,
    @Query('ascending') ascending?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(tenant.id, {
      status,
      plataforma,
      artist_id,
      work_id,
      ascending: ascending === 'true',
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Obter detecção por ID' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Registar detecção de conteúdo' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateContentDetectionDto,
  ) {
    return this.svc.create(tenant.id, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Atualizar detecção' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDetectionDto,
  ) {
    return this.svc.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Remover detecção (soft delete)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(tenant.id, id);
  }
}
