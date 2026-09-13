import { IsArray, IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AICompletionDto {
  @ApiProperty({ description: 'Skill / feature context (biografia, campaign_copy, ...)' })
  @IsString() @IsNotEmpty()
  skill!: string;

  @ApiProperty({ description: 'Prompt do utilizador' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ description: 'System prompt (instrução de contexto)' })
  @IsOptional() @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Máximo de tokens na resposta', default: 2048 })
  @IsOptional() @IsNumber() @Min(1) @Max(16000)
  maxTokens?: number;

  @ApiPropertyOptional({ description: 'Temperature (criatividade 0-2)', default: 0.7 })
  @IsOptional() @IsNumber() @Min(0) @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Forçar resposta em JSON' })
  @IsOptional() @IsBoolean()
  jsonMode?: boolean;
}

export class GenerateBiographyDto {
  @ApiProperty({ description: 'Nome do artista' })
  @IsString() @IsNotEmpty()
  artistName!: string;

  @ApiProperty({ description: 'Contexto (estilo, história, conquistas)' })
  @IsString() @IsNotEmpty()
  context!: string;
}

export class GenerateCampaignCopyDto {
  @ApiProperty({ description: 'Nome da campanha' })
  @IsString() @IsNotEmpty()
  campaign!: string;

  @ApiProperty({ description: 'Plataforma (Instagram, TikTok, YouTube, ...)' })
  @IsString() @IsNotEmpty()
  platform!: string;

  @ApiProperty({ description: 'Objetivo da campanha' })
  @IsString() @IsNotEmpty()
  goal!: string;
}

export class AnalyzeContractDto {
  @ApiProperty({ description: 'Texto completo do contrato a analisar' })
  @IsString() @IsNotEmpty()
  contractText!: string;
}

/**
 * Marketing suggestion generation. Every field here is untrusted
 * tenant/user-controlled content -- the JSON-only task framing lives
 * exclusively in AIService.generateMarketingSuggestion's fixed, server-side
 * systemPrompt (never client-suppliable through this endpoint, unlike
 * /ai/generate's systemPrompt), so it can never be overridden by anything
 * submitted here (find-62e6b1b1).
 */
export class GenerateMarketingSuggestionDto {
  @ApiProperty({ description: 'Tipo de tarefa de IA (ex: sugestao_conteudo, legenda, roteiro)' })
  @IsString() @IsNotEmpty()
  kind!: string;

  @ApiProperty({ description: 'Tipo do alvo (artista, empresa, projeto_musical)' })
  @IsString() @IsNotEmpty()
  targetType!: string;

  @ApiProperty({ description: 'Nome do alvo' })
  @IsString() @IsNotEmpty()
  targetName!: string;

  @ApiProperty({ description: 'Instrução/prompt do usuário para a tarefa' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ description: 'Letra da música, quando relevante' })
  @IsOptional() @IsString()
  lyricText?: string;

  @ApiPropertyOptional({ description: 'Público-alvo' })
  @IsOptional() @IsString()
  audience?: string;

  @ApiPropertyOptional({ description: 'Canais/plataformas de destino', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  channels?: string[];
}
