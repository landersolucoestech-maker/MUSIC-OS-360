import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { CurrentTenant }    from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }      from '../../core/decorators/current-user.decorator';
import { RequireRole }      from '../../core/decorators/roles.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { ArtistsService }   from './artists.service';
import type { JwtAuth }     from '../../core/guards/auth.guard';
import { CreateArtistDto }  from './dto/create-artist.dto';
import { UpdateArtistDto }  from './dto/update-artist.dto';
import { QueryArtistDto }   from './dto/query-artist.dto';
import { SyncPlatformProfileDto } from './dto/sync-platform-profile.dto';
import { ArtistPlatformProfilesService } from './platform-profiles/artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from './platform-profiles/artist-metric-snapshots.service';
import { ArtistExternalProfileSyncService } from './platform-profiles/artist-external-profile-sync.service';
import { isSocialPlatform } from './platform-profiles/social-platform-sync.types';
import { isMetricKey, type MetricKey } from './platform-profiles/metric-keys';
import { computeGrowth, STANDARD_GROWTH_PERIODS_DAYS } from './platform-profiles/metric-growth.util';
import { CareerStageService } from './platform-profiles/analytics/career-stage.service';
import { MarketBenchmarkService } from './platform-profiles/analytics/market-benchmark.service';
import { AudienceHealthAutomation } from '../../core/automation/audience-health.automation';

@ApiTags('Artists')
@ApiBearerAuth()
@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly service: ArtistsService,
    private readonly platformProfiles: ArtistPlatformProfilesService,
    private readonly metricSnapshots: ArtistMetricSnapshotsService,
    private readonly platformSync: ArtistExternalProfileSyncService,
    private readonly careerStage: CareerStageService,
    private readonly marketBenchmark: MarketBenchmarkService,
    private readonly audienceHealth: AudienceHealthAutomation,
  ) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Listar artistas do tenant' })
  @ApiResponse({ status: 200, description: 'Lista paginada de artistas' })
  list(
    @CurrentTenant() tenant: { id: string },
    @Query() query: QueryArtistDto,
  ) {
    return this.service.list(tenant.id, query);
  }

  @Get('stats/vinculo')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Contagem de artistas por vínculo (exclusivo/parceiro/independente), tenant inteiro' })
  vinculoStats(@CurrentTenant() tenant: { id: string }) {
    return this.service.vinculoStats(tenant.id);
  }

  @Get('stats/generos')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Gêneros musicais distintos do tenant' })
  distinctGeneros(@CurrentTenant() tenant: { id: string }) {
    return this.service.distinctGeneros(tenant.id);
  }

  @Get(':id/platform-profiles')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Listar snapshots de perfis externos do artista' })
  async listPlatformProfiles(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.findById(tenant.id, id);
    return this.platformProfiles.findByArtist(tenant.id, id);
  }

  @Get(':id/platform-profiles/:platform')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Obter snapshot de perfil externo do artista por plataforma' })
  async getPlatformProfile(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('platform') platform: string,
  ) {
    if (!isSocialPlatform(platform)) throw new BadRequestException('Plataforma inválida para sync de perfil do artista');
    await this.service.findById(tenant.id, id);
    return this.platformProfiles.findByArtistAndPlatform(tenant.id, id, platform);
  }

  @Get(':id/platform-profiles/:platform/history')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Histórico real de uma métrica de plataforma (Fase 2 — Time-Series Foundation)' })
  async getPlatformMetricHistory(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('platform') platform: string,
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!isSocialPlatform(platform)) throw new BadRequestException('Plataforma inválida');
    if (!metric || !isMetricKey(metric)) throw new BadRequestException('Métrica inválida ou ausente — ver registry em metric-keys.ts');
    await this.service.findById(tenant.id, id);

    const toDate = to ? new Date(to) : new Date();
    if (Number.isNaN(toDate.getTime())) throw new BadRequestException('Parâmetro "to" inválido');
    let fromDate: Date;
    if (from) {
      fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) throw new BadRequestException('Parâmetro "from" inválido');
    } else {
      // Sem range explícito: janela larga o bastante para cobrir o maior
      // período padrão (365d) + tolerância de computeGrowth.
      fromDate = new Date(toDate.getTime() - 400 * 24 * 60 * 60 * 1000);
    }

    const points = await this.metricSnapshots.history({
      tenantId: tenant.id, artistId: id, platform, metric: metric as MetricKey, from: fromDate, to: toDate,
    });

    const growth = from || to
      ? null
      : Object.fromEntries(
          STANDARD_GROWTH_PERIODS_DAYS.map((days) => [`${days}d`, computeGrowth(points, days, toDate)]),
        );

    return {
      metric,
      platform,
      points: points.map((p) => ({ value: p.value, observed_at: p.observedAt.toISOString() })),
      growth,
    };
  }

  @Get(':id/career-stage')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Estágio da Carreira (Fase 3) — calculado sobre métricas Soundcharts já ingeridas, nunca ao vivo' })
  async getCareerStage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.findById(tenant.id, id);
    return this.careerStage.calculate(tenant.id, id);
  }

  @Get(':id/market-benchmark')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Benchmark de Mercado (Fase 3.2) — leitura rápida; refresh de coorte externa roda em background, nunca no request' })
  async getMarketBenchmark(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.findById(tenant.id, id);
    return this.marketBenchmark.getStatus(tenant.id, id);
  }

  @Post(':id/audience-health')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({
    summary: 'AI Skill audience-health — síntese narrativa sobre Career Stage + Market Benchmark já calculados',
  })
  async getAudienceHealth(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    const artist = await this.service.findById(tenant.id, id);
    return this.audienceHealth.run(tenant.id, user.userId, id, artist.nome_artistico, force === 'true');
  }

  @Post(':id/platform-profiles/:platform/sync')
  @RequireRole('editor')
  @RequirePermission('artist:update')
  @Audit('artist.platform_profile_sync_requested')
  @ApiOperation({ summary: 'Enfileirar sincronização manual de perfil externo do artista' })
  syncPlatformProfile(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('platform') platform: string,
    @Body() body?: SyncPlatformProfileDto,
  ) {
    return this.platformSync.enqueueManualSync({
      tenantId: tenant.id,
      artistId: id,
      platform,
      requestedBy: user.userId,
      profileUrl: body?.profileUrl,
    });
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('artist:read')
  @ApiOperation({ summary: 'Obter artista por ID' })
  findById(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findByIdForResponse(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('artist:create')
  @Audit('artist.created')
  @ApiOperation({ summary: 'Criar artista' })
  @ApiResponse({ status: 201, description: 'Artista criado com sucesso' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   JwtAuth,
    @Body()          dto:    CreateArtistDto,
  ) {
    return this.service.create(tenant.id, user.userId, dto, user.orgId ?? undefined);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('artist:update')
  @Audit('artist.updated')
  @ApiOperation({ summary: 'Atualizar artista' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto:    UpdateArtistDto,
  ) {
    return this.service.update(tenant.id, user.userId, id, dto);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('artist:delete')
  @Audit('artist.deleted')
  @ApiOperation({ summary: 'Remover artista (soft delete auditável)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser()   user:   { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.softDelete(tenant.id, user.userId, id);
  }
}
