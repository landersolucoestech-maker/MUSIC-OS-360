import {
  Controller, Post, Get, Body,
  HttpCode, HttpStatus, Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { ROLE_HIERARCHY, roleLevel } from '../../core/rbac/role-hierarchy';
import { AIService } from './ai.service';
import {
  AICompletionDto,
  GenerateBiographyDto,
  GenerateCampaignCopyDto,
  AnalyzeContractDto,
  GenerateMarketingSuggestionDto,
} from './dto/ai.dto';

function assertSystemPromptAllowed(req: any, systemPrompt?: string): void {
  if (!systemPrompt) return;
  const role = req.currentMember?.role ?? 'viewer';
  const level = roleLevel(role) ?? 0;
  const required = ROLE_HIERARCHY.manager ?? 70;
  if (level < required) {
    throw new ForbiddenException('Apenas gestores ou superiores podem definir instruções personalizadas para a IA.');
  }
}

@ApiTags('AI Gateway')
@ApiBearerAuth()
@RequireRole('editor')
@Controller('ai')
export class AIController {
  constructor(private readonly ai: AIService) {}

  @Post('complete')
  @ApiOperation({ summary: 'Generic completion with multi-provider fallback' })
  @HttpCode(HttpStatus.OK)
  complete(@Request() req: any, @Body() dto: AICompletionDto) {
    assertSystemPromptAllowed(req, dto.systemPrompt);
    return this.ai.complete({
      tenantId: req.tenant?.id ?? req.tenantId,
      userId: req.auth?.userId ?? req.userId,
      skill: dto.skill,
      prompt: dto.prompt,
      systemPrompt: dto.systemPrompt,
      maxTokens: dto.maxTokens,
      temperature: dto.temperature,
      jsonMode: dto.jsonMode,
    });
  }

  @Post('generate')
  @ApiOperation({ summary: 'Alias of /complete for the frontend (useAI hook)' })
  @HttpCode(HttpStatus.OK)
  async generate(
    @Request() req: any,
    @Body() body: { prompt: string; type?: string; systemPrompt?: string; jsonMode?: boolean; maxTokens?: number },
  ): Promise<{ content: string }> {
    assertSystemPromptAllowed(req, body.systemPrompt);
    const result = await this.ai.complete({
      tenantId: req.tenant?.id ?? req.tenantId,
      userId: req.auth?.userId ?? req.userId,
      skill: body.type ?? 'general',
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      jsonMode: body.jsonMode,
      maxTokens: body.maxTokens,
    });
    return { content: result.content ?? '' };
  }

  @Post('biography')
  @ApiOperation({ summary: 'Generate an artist biography' })
  @HttpCode(HttpStatus.OK)
  async biography(@Request() req: any, @Body() dto: GenerateBiographyDto) {
    const content = await this.ai.generateBiography(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      dto.artistName,
      dto.context,
    );
    return { content };
  }

  @Post('campaign-copy')
  @ApiOperation({ summary: 'Generate copy for a marketing campaign' })
  @HttpCode(HttpStatus.OK)
  async campaignCopy(@Request() req: any, @Body() dto: GenerateCampaignCopyDto) {
    const content = await this.ai.generateCampaignCopy(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      dto,
    );
    return { content };
  }

  @Post('marketing-suggestion')
  @ApiOperation({ summary: 'Generate a marketing content suggestion (structured JSON, server-fixed systemPrompt)' })
  @HttpCode(HttpStatus.OK)
  async marketingSuggestion(@Request() req: any, @Body() dto: GenerateMarketingSuggestionDto) {
    const content = await this.ai.generateMarketingSuggestion(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      dto,
    );
    return { content };
  }

  @Post('analyze-contract')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Analyze a contract and flag problematic clauses (manager+)' })
  @HttpCode(HttpStatus.OK)
  async analyzeContract(@Request() req: any, @Body() dto: AnalyzeContractDto) {
    const content = await this.ai.analyzeContract(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      dto.contractText,
    );
    return { content };
  }

  @Get('cost-summary')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Tenant AI cost summary (admin+)' })
  getCostSummary(@Request() req: any) {
    return this.ai.getCostSummary(req.tenant?.id ?? req.tenantId);
  }
}
