import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }     from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }       from '../../core/decorators/current-user.decorator';
import { RequireRole }       from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { ArtistGoalsService }   from './artist-goals.service';
import { CreateArtistGoalDto }  from './dto/create-artist-goal.dto';
import { UpdateArtistGoalDto }  from './dto/update-artist-goal.dto';

@ApiTags('ArtistGoals')
@ApiBearerAuth()
@Controller('artist-goals')
export class ArtistGoalsController {
  constructor(private readonly svc: ArtistGoalsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('artist_goal:read')
  @ApiOperation({ summary: 'Listar metas de artistas do tenant' })
  list(
    @CurrentTenant() tenant: { id: string },
    @Query('artist_id') artist_id?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('ascending') ascending?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(tenant.id, {
      artist_id,
      status,
      type,
      ascending: ascending === 'true',
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('artist_goal:read')
  @ApiOperation({ summary: 'Obter meta de artista por ID' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('artist_goal:create')
  @ApiOperation({ summary: 'Criar meta de artista' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateArtistGoalDto,
  ) {
    return this.svc.create(tenant.id, user.userId, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('artist_goal:update')
  @ApiOperation({ summary: 'Atualizar meta de artista' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArtistGoalDto,
  ) {
    return this.svc.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('artist_goal:delete')
  @ApiOperation({ summary: 'Remover meta de artista (soft delete)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(tenant.id, id);
  }
}
