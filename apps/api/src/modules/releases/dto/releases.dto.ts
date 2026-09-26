import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsIn, IsDate, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReleaseStatus } from '@music-os-360/types';

const TYPES = ['album', 'ep', 'single', 'compilacao', 'live', 'outro'] as const;
type ReleaseType = typeof TYPES[number];

export class CreateReleaseDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: ReleaseType;
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

  // ── Form fields (EXACT keys of LancamentoFormModal) ─────────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) isrc_global?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notas_internas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) gravadora?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) copyright?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) music_genre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) idioma?: string;
  @ApiPropertyOptional() @IsOptional() assets?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() cronograma?: Record<string, unknown>;
}

export class UpdateReleaseDto extends PartialType(CreateReleaseDto) {
  @ApiPropertyOptional({ enum: ReleaseStatus })
  @IsOptional()
  @IsEnum(ReleaseStatus)
  status?: ReleaseStatus;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryReleaseDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReleaseStatus }) @IsOptional() @IsEnum(ReleaseStatus) status?: ReleaseStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() distributor?: string;
}
