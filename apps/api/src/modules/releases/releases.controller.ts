import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto, UpdateReleaseDto, QueryReleaseDto } from './dto/releases.dto';

@ApiTags('Releases') @ApiBearerAuth() @Controller('releases')
export class ReleasesController {
  constructor(private readonly svc: ReleasesService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'Listar lançamentos' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryReleaseDto) {
    return this.svc.list(t.id, q);
  }

  @Get('stats') @RequireRole('viewer') @ApiOperation({ summary: 'Distribuição exata por status (tenant inteiro)' })
  stats(@CurrentTenant() t: { id: string }, @Query() q: QueryReleaseDto) {
    return this.svc.stats(t.id, q);
  }

  @Get(':id') @RequireRole('viewer') @ApiOperation({ summary: 'Obter lançamento' })
  findById(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(t.id, id, u?.orgRole ?? undefined);
  }

  @Post() @RequireRole('editor') @Audit('release.created')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Criar lançamento' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne duplicação de lançamento em duplo-clique/retry', required: false })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Body() dto: CreateReleaseDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @Audit('release.updated') @ApiOperation({ summary: 'Atualizar lançamento' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReleaseDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto, u?.orgRole ?? undefined);
  }

  @Delete(':id') @RequireRole('manager') @Audit('release.deleted') @ApiOperation({ summary: 'Arquivar lançamento' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
