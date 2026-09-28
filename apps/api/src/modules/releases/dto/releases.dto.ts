import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsIn, IsDate, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReleaseStatus } from '@music-os-360/types';

import { RELEASE_LEGACY_TYPES, RELEASE_TYPES } from '../release-legacy-fields';

// Legacy Portuguese values (compilacao, outro) are still accepted and mapped to
// the canonical type by the service (release-legacy-fields.ts, CZ-038).
const TYPE_INPUT = [...RELEASE_TYPES, ...Object.keys(RELEASE_LEGACY_TYPES)];
type ReleaseType = typeof RELEASE_TYPES[number];
const DEPRECATED = (canonical: string) => ({ deprecated: true, description: `Deprecated (CZ-038): use "${canonical}".` });

export class CreateReleaseDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: RELEASE_TYPES }) @IsIn(TYPE_INPUT) type!: ReleaseType;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) upc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() distributor?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  releasedAt?: Date;
  @ApiPropertyOptional() @IsOptional() platforms?: string[];
  @ApiPropertyOptional() @IsOptional() coverUrl?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // ── Form fields (EXACT keys of ReleaseFormModal) ────────────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) isrc_global?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() internal_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) record_label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) copyright?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) music_genre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) language?: string;
  @ApiPropertyOptional() @IsOptional() assets?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() schedule?: Record<string, unknown>;

  // ── Deprecated Portuguese names (CZ-038, RELEASE_DEPRECATED_FIELDS) ──────────
  @ApiPropertyOptional(DEPRECATED('internal_notes')) @IsOptional() @IsString() notas_internas?: string;
  @ApiPropertyOptional(DEPRECATED('record_label')) @IsOptional() @IsString() @MaxLength(255) gravadora?: string;
  @ApiPropertyOptional(DEPRECATED('language')) @IsOptional() @IsString() @MaxLength(50) idioma?: string;
  @ApiPropertyOptional(DEPRECATED('schedule')) @IsOptional() cronograma?: Record<string, unknown>;
}

export class UpdateReleaseDto extends PartialType(CreateReleaseDto) {
  @ApiPropertyOptional({ enum: ReleaseStatus })
  @IsOptional()
  @IsEnum(ReleaseStatus)
  status?: ReleaseStatus;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

const RELEASE_STATUS_LIST = new RegExp(`^(${Object.values(ReleaseStatus).join('|')})(,(${Object.values(ReleaseStatus).join('|')}))*$`);

export class QueryReleaseDto extends PaginationDto {
  /** One ReleaseStatus or a comma-separated list (a display group of the web covers several statuses). */
  @ApiPropertyOptional({ description: `ReleaseStatus or comma-separated list: ${Object.values(ReleaseStatus).join(', ')}` })
  @IsOptional() @IsString() @Matches(RELEASE_STATUS_LIST) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() distributor?: string;
}

/**
 * Response-only shape of the artist embed on GET /releases and
 * GET /releases/:id (release-artist-ref.ts). Only these fields are ever
 * serialized — never the artist metadata or ciphertext.
 */
export class ReleaseArtistRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) stage_name!: string | null;
}

export class ReleaseArtistEmbedDto {
  @ApiProperty({ type: ReleaseArtistRefDto, nullable: true, description: 'Linked artist (tenant-scoped, not deleted).' })
  artist!: ReleaseArtistRefDto | null;

  @ApiProperty({
    type: ReleaseArtistRefDto,
    nullable: true,
    deprecated: true,
    description: 'Deprecated alias of `artist` for web builds older than the English embed. Removed once every deployed web build reads `artist`.',
  })
  artistas!: ReleaseArtistRefDto | null;
}
