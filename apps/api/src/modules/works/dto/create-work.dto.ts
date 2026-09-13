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
  genero?: string;

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

  // ── Campos do formulário de Obra (chaves EXATAS de formToObraPayload) ────────
  // Regra de produto 2026-07-12: cada campo do form tem a sua coluna física.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) idioma?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  // Renomeado de `cod_abramus` (20260718000017) — código em qualquer entidade
  // de gestão coletiva (ABRAMUS, UBC, SOCINPRO, ...), não só ABRAMUS.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_entidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) duracao?: string;
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
