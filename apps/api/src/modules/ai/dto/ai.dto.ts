import { IsArray, IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { canonicalMarketingAiKind, canonicalMarketingTarget } from '../../marketing/marketing-vocabulary';

export class AiCompletionDto {
  @ApiProperty({ description: 'Skill / feature context (biography, campaign_copy, ...)' })
  @IsString() @IsNotEmpty()
  skill!: string;

  @ApiProperty({ description: 'User prompt' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ description: 'System prompt (context instruction)' })
  @IsOptional() @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Maximum tokens in the response', default: 2048 })
  @IsOptional() @IsNumber() @Min(1) @Max(16000)
  maxTokens?: number;

  @ApiPropertyOptional({ description: 'Temperature (creativity 0-2)', default: 0.7 })
  @IsOptional() @IsNumber() @Min(0) @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Force a JSON response' })
  @IsOptional() @IsBoolean()
  jsonMode?: boolean;
}

export class GenerateBiographyDto {
  @ApiProperty({ description: 'Artist name' })
  @IsString() @IsNotEmpty()
  artistName!: string;

  @ApiProperty({ description: 'Context (style, history, achievements)' })
  @IsString() @IsNotEmpty()
  context!: string;
}

export class GenerateCampaignCopyDto {
  @ApiProperty({ description: 'Campaign name' })
  @IsString() @IsNotEmpty()
  campaign!: string;

  @ApiProperty({ description: 'Platform (Instagram, TikTok, YouTube, ...)' })
  @IsString() @IsNotEmpty()
  platform!: string;

  @ApiProperty({ description: 'Campaign goal' })
  @IsString() @IsNotEmpty()
  goal!: string;
}

export class AnalyzeContractDto {
  @ApiProperty({ description: 'Full contract text to analyze' })
  @IsString() @IsNotEmpty()
  contractText!: string;
}

/**
 * Marketing suggestion generation. Every field here is untrusted
 * tenant/user-controlled content -- the JSON-only task framing lives
 * exclusively in AiService.generateMarketingSuggestion's fixed, server-side
 * systemPrompt (never client-suppliable through this endpoint, unlike
 * /ai/generate's systemPrompt), so it can never be overridden by anything
 * submitted here (find-62e6b1b1).
 */
export class GenerateMarketingSuggestionDto {
  @ApiProperty({ description: 'AI task type (e.g. content_suggestion, caption, script). Deprecated Portuguese values (sugestao_conteudo, legenda, roteiro, ...) are mapped to the canonical English ones.' })
  @Transform(canonicalMarketingAiKind)
  @IsString() @IsNotEmpty()
  kind!: string;

  @ApiProperty({ description: 'Target type (artist, company, music_project). Deprecated artista/empresa/projeto_musical are mapped.' })
  @Transform(canonicalMarketingTarget)
  @IsString() @IsNotEmpty()
  targetType!: string;

  @ApiProperty({ description: 'Target name' })
  @IsString() @IsNotEmpty()
  targetName!: string;

  @ApiProperty({ description: 'User instruction/prompt for the task' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ description: 'Song lyrics, when relevant' })
  @IsOptional() @IsString()
  lyricText?: string;

  @ApiPropertyOptional({ description: 'Target audience' })
  @IsOptional() @IsString()
  audience?: string;

  @ApiPropertyOptional({ description: 'Target channels/platforms', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  channels?: string[];
}
