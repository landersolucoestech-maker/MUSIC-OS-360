import { IsString, IsOptional, IsInt, IsObject, IsUUID, IsArray, IsBoolean, IsIn, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LEGACY_PHONOGRAM_VALUES, PHONOGRAM_MEDIA_TYPES, PHONOGRAM_RECORDING_CLASSIFICATIONS } from '../phonogram-legacy-fields';
import { IsHttpOrStorageUrl, MAX_URL_LENGTH } from '../../../common/validators/safe-url.validation';

const DEPRECATED = (canonical: string) => ({ deprecated: true, description: `Deprecated (CZ-040): use "${canonical}".` });
// Legacy Portuguese values are still accepted and mapped by the service (phonogram-legacy-fields.ts).
const MEDIA_TYPE_INPUT = [...PHONOGRAM_MEDIA_TYPES, ...Object.keys(LEGACY_PHONOGRAM_VALUES.media_type)];
const CLASSIFICATION_INPUT = [...PHONOGRAM_RECORDING_CLASSIFICATIONS, ...Object.keys(LEGACY_PHONOGRAM_VALUES.recording_classification)];

/**
 * A participant within a `participation` category (phonographic
 * producer / performer / session musician). Real shape produced by
 * PhonogramFormModal.tsx -- confirmed by direct inspection of the component.
 */
export class ParticipantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() percentage?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional(DEPRECATED('percentage')) @IsOptional() @IsString() percentual?: string;
}

/**
 * Real shape of `participation`: an OBJECT with three array categories
 * (phonographic_producers/performers/session_musicians; before CZ-040
 * produtorFonografico/interprete/musicoAcompanhante) -- confirmed by direct
 * inspection of PhonogramFormModal.tsx. (A former `@IsArray()` rejected this
 * real object on every submit — naming-closure Phase 2.)
 */
export class ParticipationDto {
  @ApiPropertyOptional({ type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  phonographic_producers?: ParticipantDto[];

  @ApiPropertyOptional({ type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  performers?: ParticipantDto[];

  @ApiPropertyOptional({ type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  session_musicians?: ParticipantDto[];

  @ApiPropertyOptional({ ...DEPRECATED('phonographic_producers'), type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  produtorFonografico?: ParticipantDto[];

  @ApiPropertyOptional({ ...DEPRECATED('performers'), type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  interprete?: ParticipantDto[];

  @ApiPropertyOptional({ ...DEPRECATED('session_musicians'), type: [ParticipantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  musicoAcompanhante?: ParticipantDto[];
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

  @ApiPropertyOptional({ example: 'Noite Estrelada (Ao Vivo)', deprecated: true, description: 'Legacy alias. Use "title".' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titulo?: string;

  @ApiPropertyOptional({ example: 'uuid-da-obra', deprecated: true, description: 'Legacy alias. Use "work_id".' })
  @IsOptional()
  @IsUUID()
  workId?: string;

  @ApiPropertyOptional({ example: 'uuid-do-artista', deprecated: true, description: 'Legacy alias. Use "artist_id".' })
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

  @ApiPropertyOptional({ example: 312, description: 'Duration in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_URL_LENGTH)
  @IsHttpOrStorageUrl()
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string = 'active';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // ── Phonogram form fields (CZ-040: canonical English) ─────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) ecad_code?: string;
  // Code at any collective management society (ABRAMUS, UBC, SOCINPRO, ...).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) society_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) aggregator?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) isrc_country_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) isrc_registrant_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4) isrc_year?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) isrc_designation_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ai_used?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_instrumental?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_national?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_simultaneous_publication?: boolean;
  @ApiPropertyOptional({ example: '2026-01-31' }) @IsOptional() @IsString() issue_date?: string;
  @ApiPropertyOptional({ example: '2026-01-31' }) @IsOptional() @IsString() recording_date?: string;
  @ApiPropertyOptional({ example: '2026-01-31' }) @IsOptional() @IsString() release_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) duration_text?: string;
  @ApiPropertyOptional({ description: 'Total duration in seconds.' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration_seconds?: number;
  @ApiPropertyOptional({ enum: PHONOGRAM_MEDIA_TYPES }) @IsOptional() @IsIn(MEDIA_TYPE_INPUT) media_type?: string;
  @ApiPropertyOptional({ enum: PHONOGRAM_RECORDING_CLASSIFICATIONS }) @IsOptional() @IsIn(CLASSIFICATION_INPUT) recording_classification?: string;
  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2; ZZ = other/unknown.' }) @IsOptional() @IsString() @MaxLength(100) country_of_recording?: string;
  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2; ZZ = other/unknown.' }) @IsOptional() @IsString() @MaxLength(100) publication_country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) record_label_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional({ type: ParticipationDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ParticipationDto)
  participation?: ParticipationDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() audio_file?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() audio_file_id?: string;

  // ── Deprecated Portuguese names (CZ-040, PHONOGRAM_DEPRECATED_FIELDS) ────────
  @ApiPropertyOptional(DEPRECATED('ecad_code')) @IsOptional() @IsString() @MaxLength(100) cod_ecad?: string;
  @ApiPropertyOptional(DEPRECATED('society_code')) @IsOptional() @IsString() @MaxLength(100) cod_entidade?: string;
  @ApiPropertyOptional(DEPRECATED('aggregator')) @IsOptional() @IsString() @MaxLength(100) agregadora?: string;
  @ApiPropertyOptional(DEPRECATED('isrc_country_code')) @IsOptional() @IsString() @MaxLength(5) isrc_pais?: string;
  @ApiPropertyOptional(DEPRECATED('isrc_registrant_code')) @IsOptional() @IsString() @MaxLength(10) isrc_registrante?: string;
  @ApiPropertyOptional(DEPRECATED('isrc_year')) @IsOptional() @IsString() @MaxLength(4) isrc_ano?: string;
  @ApiPropertyOptional(DEPRECATED('isrc_designation_code')) @IsOptional() @IsString() @MaxLength(10) isrc_designacao?: string;
  @ApiPropertyOptional(DEPRECATED('ai_used')) @IsOptional() @IsBoolean() criada_por_ia?: boolean;
  @ApiPropertyOptional(DEPRECATED('is_national')) @IsOptional() @IsBoolean() nacional?: boolean;
  @ApiPropertyOptional(DEPRECATED('is_simultaneous_publication')) @IsOptional() @IsBoolean() pub_simultanea?: boolean;
  @ApiPropertyOptional(DEPRECATED('issue_date')) @IsOptional() @IsString() emissao?: string;
  @ApiPropertyOptional(DEPRECATED('recording_date')) @IsOptional() @IsString() gravacao_original?: string;
  @ApiPropertyOptional(DEPRECATED('release_date')) @IsOptional() @IsString() data_lancamento?: string;
  @ApiPropertyOptional(DEPRECATED('duration_seconds')) @IsOptional() @Type(() => Number) @IsInt() duracao_min?: number;
  @ApiPropertyOptional(DEPRECATED('duration_seconds')) @IsOptional() @Type(() => Number) @IsInt() duracao_seg?: number;
  @ApiPropertyOptional(DEPRECATED('media_type')) @IsOptional() @IsIn(MEDIA_TYPE_INPUT) midia?: string;
  @ApiPropertyOptional(DEPRECATED('recording_classification')) @IsOptional() @IsIn(CLASSIFICATION_INPUT) classificacao?: string;
  @ApiPropertyOptional(DEPRECATED('country_of_recording')) @IsOptional() @IsString() @MaxLength(100) pais_origem?: string;
  @ApiPropertyOptional(DEPRECATED('publication_country')) @IsOptional() @IsString() @MaxLength(100) pais_publicacao?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_name')) @IsOptional() @IsString() @MaxLength(255) gravadora?: string;
  @ApiPropertyOptional({ ...DEPRECATED('participation'), type: ParticipationDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ParticipationDto)
  participacao?: ParticipationDto;
  @ApiPropertyOptional(DEPRECATED('audio_file')) @IsOptional() @IsObject() arquivo_audio?: Record<string, unknown>;
}
