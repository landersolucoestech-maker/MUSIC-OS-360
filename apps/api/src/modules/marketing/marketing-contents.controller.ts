import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { CreateMarketingContentDto, QueryMarketingContentDto, UpdateMarketingContentDto } from './dto/marketing-contents.dto';
import { MarketingContentsService } from './marketing-contents.service';
import { PostizAutomation } from '../../core/automation/postiz.automation';

@ApiTags('Marketing Contents')
@ApiBearerAuth()
@Controller('marketing/contents')
export class MarketingContentsController {
  constructor(
    private readonly svc: MarketingContentsService,
    private readonly postiz: PostizAutomation,
  ) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Listar conteudos agendados/publicados' })
  list(@CurrentTenant() tenant: { id: string }, @Query() query: QueryMarketingContentDto) {
    return this.svc.list(tenant.id, query);
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Obter conteudo agendado/publicado' })
  findById(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @Audit('marketing.content.created')
  @ApiOperation({ summary: 'Criar conteudo e agendar publicacao automatica' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: CreateMarketingContentDto,
  ) {
    return this.svc.create(tenant.id, user?.userId ?? 'system', dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @Audit('marketing.content.updated')
  @ApiOperation({ summary: 'Atualizar conteudo e reagendar publicacao quando necessario' })
  update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingContentDto,
  ) {
    return this.svc.update(tenant.id, user?.userId ?? 'system', id, dto);
  }

  @Delete(':id')
  @RequireRole('editor')
  @Audit('marketing.content.cancelled')
  @ApiOperation({ summary: 'Cancelar conteudo agendado' })
  archive(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.archive(tenant.id, user?.userId ?? 'system', id);
  }

  @Post(':id/ai/postiz')
  @RequireRole('editor')
  @ApiOperation({ summary: 'AI Skill postiz — avalia prontidão de publicação (nunca publica)' })
  runPostizReadiness(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postiz.run(tenant.id, user?.userId ?? '', id);
  }
}
