import { IsString, IsOptional, IsArray, IsObject, IsBoolean, IsUUID, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LEGACY_WORK_VALUES, WORK_AI_USAGE_LEVELS, WORK_ORIGINS } from '../work-legacy-fields';

const DEPRECATED = (canonical: string) => ({ deprecated: true, description: `Deprecated (CZ-039): use "${canonical}".` });
// Legacy Portuguese values are still accepted and mapped by the service (work-legacy-fields.ts).
const WORK_ORIGIN_INPUT = [...WORK_ORIGINS, ...Object.keys(LEGACY_WORK_VALUES.work_origin)];
const AI_USAGE_LEVEL_INPUT = [...WORK_AI_USAGE_LEVELS, ...Object.keys(LEGACY_WORK_VALUES.ai_usage_level)];

export class CreateWorkDto {
  @ApiProperty({ example: 'Noite Estrelada' })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'composition' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'T-034.521.489-2' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  iswc?: string;

  @ApiPropertyOptional({ example: 'BR-AB1-24-00001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isrc?: string;

  @ApiPropertyOptional({ example: 'MPB' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  music_genre?: string;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  composer_name?: string;

  @ApiPropertyOptional({ type: [String], description: 'Derived from participants with role composer_author.' })
  @IsOptional()
  @IsArray()
  composer_names?: unknown[];

  @ApiPropertyOptional({ example: 'Editora XYZ' })
  @IsOptional()
  @IsString()
  publisher_name?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  authors?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  shares?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // ── Work form fields (CZ-039: canonical English) ─────────────────────────────
  // ISO 639 code; `zxx` = no lyrics (instrumental), `und` = other/undetermined.
  @ApiPropertyOptional({ example: 'pt' }) @IsOptional() @IsString() @MaxLength(10) language?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) ecad_code?: string;
  // Code at any collective management society (ABRAMUS, UBC, SOCINPRO, ...).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) society_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) duration_text?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_instrumental?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ai_used?: boolean;
  @ApiPropertyOptional({ enum: WORK_AI_USAGE_LEVELS }) @IsOptional() @IsIn(AI_USAGE_LEVEL_INPUT) ai_usage_level?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() ai_harmony?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() ai_melody?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() ai_lyrics?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsArray() alternative_titles?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() related_references?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() lyrics?: string;
  @ApiPropertyOptional({ description: 'Items {id, name, role, link, percentage}; role: publisher | administrator | composer_author | translator | unspecified.' })
  @IsOptional() @IsArray() participants?: unknown[];
  @ApiPropertyOptional({ type: [String], description: 'Derived from participants with role translator.' })
  @IsOptional() @IsArray() translator_names?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional({ enum: WORK_ORIGINS }) @IsOptional() @IsIn(WORK_ORIGIN_INPUT) work_origin?: string;

  // ── Deprecated Portuguese names (CZ-039, WORK_DEPRECATED_FIELDS) ────────────
  @ApiPropertyOptional(DEPRECATED('composer_name')) @IsOptional() @IsString() compositor?: string;
  @ApiPropertyOptional(DEPRECATED('composer_names')) @IsOptional() @IsArray() compositores?: unknown[];
  @ApiPropertyOptional(DEPRECATED('publisher_name')) @IsOptional() @IsString() editora?: string;
  @ApiPropertyOptional(DEPRECATED('language')) @IsOptional() @IsString() @MaxLength(50) idioma?: string;
  @ApiPropertyOptional(DEPRECATED('ecad_code')) @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  @ApiPropertyOptional(DEPRECATED('society_code')) @IsOptional() @IsString() @MaxLength(100) cod_entidade?: string;
  @ApiPropertyOptional(DEPRECATED('is_instrumental')) @IsOptional() @IsString() @MaxLength(10) instrumental?: string;
  @ApiPropertyOptional(DEPRECATED('ai_used')) @IsOptional() @IsBoolean() criada_por_ia?: boolean;
  @ApiPropertyOptional(DEPRECATED('ai_usage_level')) @IsOptional() @IsIn(AI_USAGE_LEVEL_INPUT) tipo_ia?: string;
  @ApiPropertyOptional(DEPRECATED('ai_harmony')) @IsOptional() @IsObject() ia_harmonia?: Record<string, unknown>;
  @ApiPropertyOptional(DEPRECATED('ai_melody')) @IsOptional() @IsObject() ia_melodia?: Record<string, unknown>;
  @ApiPropertyOptional(DEPRECATED('ai_lyrics')) @IsOptional() @IsObject() ia_letra?: Record<string, unknown>;
  @ApiPropertyOptional(DEPRECATED('alternative_titles')) @IsOptional() @IsArray() outros_titulos?: unknown[];
  @ApiPropertyOptional(DEPRECATED('related_references')) @IsOptional() @IsArray() referencias_conexas?: unknown[];
  @ApiPropertyOptional(DEPRECATED('lyrics')) @IsOptional() @IsString() letra_completa?: string;
  @ApiPropertyOptional(DEPRECATED('participants')) @IsOptional() @IsArray() participantes?: unknown[];
  @ApiPropertyOptional(DEPRECATED('translator_names')) @IsOptional() @IsArray() letristas?: unknown[];
  @ApiPropertyOptional(DEPRECATED('work_origin')) @IsOptional() @IsIn(WORK_ORIGIN_INPUT) tipo_obra?: string;
}
