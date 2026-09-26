import { IsString, IsOptional, IsInt, IsObject, IsUUID, IsArray, IsBoolean, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A participant within a `participacao` category (phonographic
 * producer / performer / accompanying musician). Real shape produced by
 * FonogramaFormModal.tsx (`Participante` interface) -- confirmed by
 * direct inspection of the component, not assumed.
 */
export class ParticipanteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() percentual?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
}

/**
 * Real shape of `participacao`: an OBJECT with three array categories
 * (produtorFonografico/interprete/musicoAcompanhante) -- confirmed by
 * direct inspection of FonogramaFormModal.tsx (`ParticipacaoCategoria`
 * interface, `participacao: participacao as unknown as Json` on submit).
 * The PREVIOUS physical field was `@IsArray() participacao?: unknown[]` --
 * `@IsArray()` rejects this real object with "participacao must be an
 * array" on EVERY real submit with participants filled in (verified
 * empirically: plainToInstance + validate() with the real frontend
 * payload produces that error). The naming-closure Phase 2 audit found this
 * bug while investigating the legacy `interpretes` column (dropped for having no
 * writer -- this is the root reason: the live field that should have
 * replaced it never accepted real data).
 */
export class ParticipacaoDto {
  @ApiPropertyOptional({ type: [ParticipanteDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipanteDto)
  produtorFonografico?: ParticipanteDto[];

  @ApiPropertyOptional({ type: [ParticipanteDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipanteDto)
  interprete?: ParticipanteDto[];

  @ApiPropertyOptional({ type: [ParticipanteDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipanteDto)
  musicoAcompanhante?: ParticipanteDto[];
}

export class CreatePhonogramDto {
  // Title: `title` is the canonical field (naming normalization,
  // 2026-09-05); `titulo` is the legacy PT alias, temporarily accepted
  // (C2 — deprecated, not removed in this phase). The service requires at
  // least one of the two.
  @ApiPropertyOptional({ example: 'Noite Estrelada (Ao Vivo)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'Noite Estrelada (Ao Vivo)', deprecated: true, description: 'Alias legado. Use "title".' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titulo?: string;

  @ApiPropertyOptional({ example: 'uuid-da-obra', deprecated: true, description: 'Alias legado. Use "work_id".' })
  @IsOptional()
  @IsUUID()
  workId?: string;

  @ApiPropertyOptional({ example: 'uuid-do-artista', deprecated: true, description: 'Alias legado. Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional({ example: 'BR-MSC-24-00001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isrc?: string;

  @ApiPropertyOptional({ example: 'Pop' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  music_genre?: string | null;

  @ApiPropertyOptional({ example: 312, description: 'Duração em segundos' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string = 'active';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // ── Phonogram form fields (EXACT keys of buildPayload) ───────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  // Renamed from `cod_abramus` (20260718000017) — code at any collective
  // management society (ABRAMUS, UBC, SOCINPRO, ...), not only ABRAMUS.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_entidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) agregadora?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) isrc_pais?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) isrc_registrante?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4) isrc_ano?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) isrc_designacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() criada_por_ia?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_instrumental?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nacional?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pub_simultanea?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() emissao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravacao_original?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() data_lancamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) duration_text?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() duracao_min?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() duracao_seg?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) midia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) classificacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) pais_origem?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) pais_publicacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) gravadora?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional({ type: ParticipacaoDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ParticipacaoDto)
  participacao?: ParticipacaoDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() arquivo_audio?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() audio_file_id?: string;
}
