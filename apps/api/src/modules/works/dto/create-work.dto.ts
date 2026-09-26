import { IsString, IsOptional, IsArray, IsObject, IsBoolean, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkDto {
  @ApiProperty({ example: 'Noite Estrelada' })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'composicao' })
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
  compositor?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  compositores?: Record<string, unknown>[];

  @ApiPropertyOptional({ example: 'Editora XYZ' })
  @IsOptional()
  @IsString()
  editora?: string;

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

  // ── Work form fields (EXACT keys of formToObraPayload) ───────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) idioma?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  // Renamed from `cod_abramus` (20260718000017) — code at any collective
  // management society (ABRAMUS, UBC, SOCINPRO, ...), not only ABRAMUS.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_entidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) duration_text?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) instrumental?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() criada_por_ia?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) tipo_ia?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() ia_harmonia?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() ia_melodia?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() ia_letra?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsArray() outros_titulos?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() referencias_conexas?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() letra_completa?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() participantes?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() letristas?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) tipo_obra?: string;
}
