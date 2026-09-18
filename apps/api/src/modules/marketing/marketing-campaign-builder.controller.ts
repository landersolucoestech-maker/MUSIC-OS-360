import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { campaignBuilderConfig } from './campaign-builder.config';
import {
  MarketingCampaignBuilderService,
  type CampaignBlueprint,
  type CampaignBuilderPayload,
  type CampaignValidation,
} from './marketing-campaign-builder.service';
import { CampaignBuilderInsightsAutomation } from '../../core/automation/campaign-builder-insights.automation';

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

function hasCreative(payload: CampaignBuilderPayload, type: string): boolean {
  return (payload.creatives ?? []).some((creative) => {
    const creativeType = creative.type?.toUpperCase();
    const mimeType = creative.mimeType?.toLowerCase() ?? '';
    return creativeType === type || mimeType.startsWith(`${type.toLowerCase()}/`);
  });
}

function validateCampaign(payload: CampaignBuilderPayload, strict: boolean): CampaignValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const objectives = new Set(campaignBuilderConfig.objectives.map((item) => item.value));
  const outcomeMap = campaignBuilderConfig.expectedOutcomes as Record<string, string[]>;
  const platformMap = campaignBuilderConfig.platforms as Record<string, { objectives: string[]; placements: string[]; creatives: string[] }>;

  if (!hasValue(payload.name)) errors.push('O nome da campanha é obrigatório.');
  if (!payload.objective || !objectives.has(payload.objective)) errors.push('O objetivo é inválido ou está ausente.');

  if (payload.objective) {
    const allowedOutcomes = outcomeMap[payload.objective] ?? [];
    if (strict && !payload.expectedOutcome) errors.push('O resultado esperado é obrigatório.');
    if (payload.expectedOutcome && !allowedOutcomes.includes(payload.expectedOutcome)) {
      errors.push('O resultado esperado não é compatível com o objetivo selecionado.');
    }
  }

  if (!hasValue(payload.promotedEntityType)) errors.push('O tipo de entidade promovida é obrigatório.');
  if (!hasValue(payload.promotedEntityId) && !hasValue(payload.promotedEntityName)) {
    errors.push('A entidade promovida deve ser selecionada ou nomeada.');
  }

  if ((payload.objective === 'TRAFFIC' || payload.objective === 'CONVERSIONS') && !hasValue(payload.destinationUrl)) {
    errors.push('Campanhas de tráfego e conversão exigem uma URL de destino.');
  }

  if (payload.objective === 'CONVERSIONS' && !hasValue(payload.expectedOutcome)) {
    errors.push('Campanhas de conversão exigem um resultado esperado.');
  }

  const platforms = payload.platforms ?? [];
  if (strict && platforms.length === 0) errors.push('Selecione ao menos uma plataforma.');

  for (const platform of platforms) {
    const capability = platformMap[platform];
    if (!capability) {
      errors.push(`A plataforma ${platform} é inválida.`);
      continue;
    }
    if (payload.objective && !capability.objectives.includes(payload.objective)) {
      errors.push(`O objetivo ${payload.objective} não é compatível com ${platform}.`);
    }
  }

  for (const placement of payload.placements ?? []) {
    const compatible = platforms.some((platform) => platformMap[platform]?.placements.includes(placement));
    if (!compatible) errors.push(`O posicionamento ${placement} não é compatível com as plataformas selecionadas.`);
  }

  if (strict && (payload.creatives ?? []).length === 0) errors.push('É necessário ao menos um criativo.');
  if (payload.expectedOutcome === 'VIDEO_VIEWS' && !hasCreative(payload, 'VIDEO')) {
    errors.push('Visualizações de vídeo exigem um criativo de vídeo.');
  }
  if ((payload.platforms ?? []).includes('SPOTIFY_ADS') && !hasCreative(payload, 'AUDIO') && !hasCreative(payload, 'VIDEO')) {
    errors.push('O Spotify Ads exige um criativo de áudio ou vídeo.');
  }
  if ((payload.placements ?? []).some((placement) => placement.startsWith('YOUTUBE_')) && !hasCreative(payload, 'VIDEO')) {
    errors.push('Os posicionamentos de vídeo do YouTube exigem um criativo de vídeo.');
  }

  const totalBudget = Number(payload.totalBudget ?? 0);
  const dailyBudget = Number(payload.dailyBudget ?? 0);
  if (strict && totalBudget <= 0 && dailyBudget <= 0) errors.push('O orçamento é obrigatório antes de publicar.');
  if (!payload.startDate || !payload.endDate) warnings.push('O período da campanha está incompleto.');
  if (!payload.utm && (payload.objective === 'TRAFFIC' || payload.objective === 'CONVERSIONS')) warnings.push('Recomenda-se o rastreamento UTM.');

  return { valid: errors.length === 0, errors, warnings };
}

function buildBlueprint(payload: CampaignBuilderPayload): CampaignBlueprint {
  const platforms = payload.platforms ?? [];
  const recommendedPlatforms = platforms.length > 0
    ? platforms
    : Object.entries(campaignBuilderConfig.platforms)
        .filter(([, capability]) => payload.objective && capability.objectives.includes(payload.objective))
        .map(([platform]) => platform);

  const defaultRecommendations = campaignBuilderConfig.defaultRecommendations as Record<string, string[]>;
  const requiredActions = [
    ...(payload.objective ? defaultRecommendations[payload.objective] ?? [] : []),
    ...(payload.expectedOutcome === 'PRE_SAVE' ? ['Smart link required', 'Pre-save event required'] : []),
    ...(payload.expectedOutcome === 'VIDEO_VIEWS' ? ['Video creative required'] : []),
  ];

  return {
    recommendedPlatforms,
    requiredActions,
    suggestedCtas: payload.objective === 'CONVERSIONS' ? ['Comprar agora', 'Fazer pre-save', 'Inscrever-se'] : ['Saiba mais', 'Ouvir agora', 'Acessar link'],
    notes: [
      'Blueprint generated from Campaign Builder rules.',
      'Provider-side publishing is not executed by this stub endpoint.',
    ],
  };
}

@ApiTags('Marketing')
@ApiBearerAuth()
@Controller('marketing/campaigns')
export class MarketingCampaignBuilderController {
  constructor(
    private readonly service: MarketingCampaignBuilderService,
    private readonly insights: CampaignBuilderInsightsAutomation,
  ) {}

  @Get()
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List Campaign Builder campaigns' })
  list(@CurrentTenant() tenant: { id: string }) {
    return this.service.list(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get Campaign Builder campaign' })
  get(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.service.find(tenant.id, id);
  }

  @Post('draft')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create Campaign Builder draft' })
  createDraft(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() body: CampaignBuilderPayload,
  ) {
    return this.service.create(tenant.id, user?.userId ?? '', body, validateCampaign(body, false));
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update Campaign Builder campaign' })
  async update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
    @Body() body: CampaignBuilderPayload,
  ) {
    const current = await this.service.find(tenant.id, id);
    return this.service.update(
      tenant.id,
      user?.userId ?? '',
      id,
      body,
      validateCampaign({ ...current, ...body }, false),
    );
  }

  @Post(':id/validate')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Validate Campaign Builder campaign' })
  async validate(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    const campaign = await this.service.find(tenant.id, id);
    const validation = validateCampaign(campaign, true);
    await this.service.setState(
      tenant.id,
      user?.userId ?? '',
      id,
      validation.valid ? 'READY' : 'DRAFT',
      validation,
    );
    return validation;
  }

  @Post(':id/blueprint')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Generate Campaign Builder blueprint' })
  async blueprint(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    const campaign = await this.service.find(tenant.id, id);
    const blueprint = buildBlueprint(campaign);
    await this.service.setState(
      tenant.id,
      user?.userId ?? '',
      id,
      campaign.status,
      campaign.validation,
      blueprint,
    );
    return blueprint;
  }

  @Post(':id/publish')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Publish Campaign Builder campaign' })
  async publish(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    const campaign = await this.service.find(tenant.id, id);
    const validation = validateCampaign(campaign, true);
    return this.service.setState(
      tenant.id,
      user?.userId ?? '',
      id,
      validation.valid ? 'PENDING_REVIEW' : 'DRAFT',
      validation,
    );
  }

  @Post(':id/pause')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Pause Campaign Builder campaign' })
  async pause(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    const campaign = await this.service.find(tenant.id, id);
    return this.service.setState(
      tenant.id,
      user?.userId ?? '',
      id,
      'PAUSED',
      campaign.validation,
    );
  }

  @Post(':id/archive')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Archive Campaign Builder campaign' })
  archive(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    return this.service.archive(tenant.id, user?.userId ?? '', id);
  }

  @Post(':id/ai/ad-creative')
  @RequireRole('editor')
  @ApiOperation({ summary: 'AI Skill ad-creative — sugestões de headline/copy/CTA para uma plataforma+posicionamento da campanha' })
  runAdCreative(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
    @Query('platform') platform: string,
    @Query('placement') placement: string,
  ) {
    return this.insights.runAdCreative(tenant.id, user?.userId ?? '', id, platform, placement);
  }

  @Post(':id/ai/paid-ads-strategy')
  @RequireRole('editor')
  @ApiOperation({ summary: 'AI Skill paid-ads — sugestão de alocação de orçamento e posicionamento entre as plataformas já selecionadas' })
  runPaidAdsStrategy(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Param('id') id: string,
  ) {
    return this.insights.runPaidAdsStrategy(tenant.id, user?.userId ?? '', id);
  }
}
