import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEnum, IsNumber, IsDate, IsDateString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import type { DeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';

/** CZ-028 deploy-skew window: field names a pre-canonical web build still sends (see applyDeprecatedFieldAliases). */
export const EVENT_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  endereco: 'address',
  contato_local: 'venue_contact',
  publico_esperado: 'expected_attendance',
  participantes: 'participants',
};
import { EventStatus } from '@music-os-360/types';

const TYPES    = ['show', 'festival', 'recording', 'meeting', 'interview', 'tour', 'other'] as const;

export class CreateEventDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) venue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(()=>Number) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketUrl?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // ── Form fields (EXACT keys of SchedulerFormModal) ──────────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue_contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) fee_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) expected_attendance?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() participants?: unknown[];

  // ── Deprecated names (CZ-028), moved to the canonical ones before persistence ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "address".' }) @IsOptional() @IsString() endereco?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "venue_contact".' }) @IsOptional() @IsString() contato_local?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "expected_attendance".' }) @IsOptional() @IsNumber() @Type(() => Number) publico_esperado?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "participants".' }) @IsOptional() participantes?: unknown[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryEventDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;

  // Names actually read by EventsService.list(). "type"/"artistId" (English
  // aliases) existed here without any real caller and without being read in the service —
  // removed (they were a 200-but-silently-ignored filter waiting to happen).
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artist_id?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @IsDateString() dateTo?: string;
}
