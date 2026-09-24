import { IsString, IsOptional, IsInt, IsObject, IsUUID, IsArray, IsBoolean, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Um participante dentro de uma categoria de `participacao` (produtor
 * fonográfico / intérprete / músico acompanhante). Shape real produzido por
 * FonogramaFormModal.tsx (`Participante` interface) -- confirmado por
 * inspeção direta do componente, não suposto.
 */
export class ParticipanteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() percentual?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
}

/**
 * Shape real de `participacao`: um OBJETO com três categorias de array
 * (produtorFonografico/interprete/musicoAcompanhante) -- confirmado por
 * inspeção direta de FonogramaFormModal.tsx (`ParticipacaoCategoria`
 * interface, `participacao: participacao as unknown as Json` no submit).
 * O campo físico ANTERIOR era `@IsArray() participacao?: unknown[]` --
 * `@IsArray()` rejeita este objeto real com "participacao must be an
 * array" em TODO submit real com participantes preenchidos (verificado
 * empiricamente: plainToInstance + validate() com o payload real do
 * frontend produz esse erro). Naming-closure Phase 2 audit encontrou este
 * bug ao investigar a coluna legada `interpretes` (dropada por não ter
 * writer -- este é o motivo raiz: o campo vivo que deveria tê-la
 * substituído nunca aceitou dados reais).
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
  // Title: `title` é o campo canônico (normalização de nomenclatura,
  // 2026-09-05); `titulo` é o alias PT legado, aceito temporariamente
  // (C2 — deprecated, sem remoção nesta fase). O service exige pelo
  // menos um dos dois.
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

  // ── Campos do formulário de Fonograma (chaves EXATAS do buildPayload) ────────
  // Regra de produto 2026-07-12: cada campo do form tem a sua coluna física.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  // Renomeado de `cod_abramus` (20260718000017) — código em qualquer entidade
  // de gestão coletiva (ABRAMUS, UBC, SOCINPRO, ...), não só ABRAMUS.
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
