import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, IsUUID, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

import { LicenseStatus } from '@music-os-360/types';
import { ACCEPTED_LICENSE_STATUSES } from '../license-vocabulary';

const REMUNERATION_TYPES = ['FIXED', 'PERCENTAGE', 'FIXED_PLUS_PERCENTAGE'] as const;

/**
 * Canonical contract of the LicenseFormModal form (English since CZ-035).
 * Pre-CZ-035 field names and values are accepted as deprecated input
 * (license-vocabulary.ts).
 */
export class CreateLicenseDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) work_title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artist_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) client_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) project_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) usage_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) target_media?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) territory?: string;
  @ApiPropertyOptional({ enum: LicenseStatus }) @IsOptional() @IsIn(ACCEPTED_LICENSE_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() start_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() end_date?: string;

  @ApiPropertyOptional({ enum: REMUNERATION_TYPES })
  @IsOptional() @IsIn(REMUNERATION_TYPES)
  remuneration_type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) percentage?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  // ── Deprecated aliases (CZ-035 deploy-skew window; see LICENSE_DEPRECATED_FIELDS) ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "amount".' }) @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valor?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "currency".' }) @IsOptional() @IsString() @MaxLength(10) moeda?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "work_title".' }) @IsOptional() @IsString() @MaxLength(255) obra_musical?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "artist_name".' }) @IsOptional() @IsString() @MaxLength(255) artista?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "client_name".' }) @IsOptional() @IsString() @MaxLength(255) cliente?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "project_name".' }) @IsOptional() @IsString() @MaxLength(255) projeto?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "usage_type".' }) @IsOptional() @IsString() @MaxLength(255) tipo_uso?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "target_media".' }) @IsOptional() @IsString() @MaxLength(255) midia_destino?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "territory".' }) @IsOptional() @IsString() @MaxLength(150) territorio?: string;
}

export class UpdateLicenseDto extends PartialType(CreateLicenseDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryLicenseDto extends PaginationDto {
  /** Accepts a single status ("active") or several separated by commas
   * ("negotiation,proposal") — the proposals tab of Licensing.tsx
   * spans two statuses (Task H). */
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() target_media?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "target_media".' }) @IsOptional() @IsString() midia_destino?: string;
}
