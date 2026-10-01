import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, IsUUID, IsArray, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import type { DeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { HasSafeUrlValues } from '../../../common/validators/safe-url.validation';

/** Deploy-skew window: field names a pre-canonical web build still sends (see applyDeprecatedFieldAliases). */
export const PROJECT_DEPRECATED_FIELDS: DeprecatedFieldAliases = { orcamento: 'budget', musicas: 'tracks' };

/** Same window, for each item of `tracks` (pre-canonical names of the track fields). */
export const PROJECT_TRACK_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  duracaoMin: 'durationMinutes',
  duracaoSeg: 'durationSeconds',
  genero: 'genre',
  idioma: 'language',
  letra: 'lyrics',
  compositores: 'composers',
  interpretes: 'performers',
  produtores: 'producers',
};

const TYPES = ['album', 'ep', 'single', 'video', 'tour', 'podcast', 'other'] as const;
const STATUSES = Object.values(ProjectStatus) as string[];

/**
 * Canonical contract (audit 2026-07-18): the EXACT names of the real active form
 * (ProjetoFormModal.tsx / bulk import in Projetos.tsx), not the English names of
 * the previous DTO (title/type/artistId/budget/currency/startsAt/deadlineAt/
 * releasedAt) — which never had a real writer and, even if accepted, did not
 * match the physical columns (title/type/status/description).
 */
export class CreateProjectDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: typeof TYPES[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  // GAP-0001: the production budget is never negative — authoritative server-side validation.
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) budget?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of budget.' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) orcamento?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) music_genre?: string;
  @ApiPropertyOptional() @IsOptional() @HasSafeUrlValues() metadata?: Record<string, unknown>;

  // Tracks under development — normalized into project_tracks by the service
  // (no longer serialized into `description`). Item fields: id, name, soloFeat,
  // originalRemix, instrumental, durationMinutes, durationSeconds, genre,
  // language, lyrics, audioUrl, composers, performers, producers.
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() @HasSafeUrlValues() tracks?: Record<string, unknown>[];
  @ApiPropertyOptional({ type: [Object], deprecated: true, description: 'Deprecated alias of tracks.' })
  @IsOptional() @IsArray() @HasSafeUrlValues() musicas?: Record<string, unknown>[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ProjectStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryProjectDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() music_genre?: string;
}
