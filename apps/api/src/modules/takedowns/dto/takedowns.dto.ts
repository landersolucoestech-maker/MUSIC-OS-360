import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, MaxLength, IsObject, ValidateIf } from 'class-validator';
import { TakedownStatus } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  ACCEPTED_TAKEDOWN_PRIORITIES,
  ACCEPTED_TAKEDOWN_TYPES,
  TAKEDOWN_PRIORITIES,
  TAKEDOWN_TYPES,
} from '../takedown-legacy-fields';
import { IsSafeUrlText, MAX_URL_LENGTH } from '../../../common/validators/safe-url.validation';

// The CHECK constraint chk_takedowns_status only allows TakedownStatus. Before
// CZ-034 this DTO only accepted Portuguese statuses, so every save and every
// status filter from the web (which sends TakedownStatus) was rejected.
const STATUSES = Object.values(TakedownStatus) as string[];

/**
 * Canonical contract of the TakedownFormModal modal (English since CZ-034).
 * The pre-CZ-034 field names and type/priority slugs are accepted as
 * deprecated input (takedown-legacy-fields.ts). A required field can be sent
 * under either name, hence the `ValidateIf` on the canonical required fields.
 */
export class CreateTakedownDto {
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiPropertyOptional({ enum: TAKEDOWN_TYPES }) @IsOptional() @IsIn(ACCEPTED_TAKEDOWN_TYPES) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) affected_work?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artist_name?: string;
  @ApiProperty() @ValidateIf((o: CreateTakedownDto) => o.plataforma === undefined) @IsString() @MaxLength(100) platform!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(MAX_URL_LENGTH) @IsSafeUrlText() infringing_url?: string;
  @ApiProperty() @ValidateIf((o: CreateTakedownDto) => o.motivo === undefined) @IsString() reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: TAKEDOWN_PRIORITIES }) @IsOptional() @IsIn(ACCEPTED_TAKEDOWN_PRIORITIES) priority?: string;
  @ApiPropertyOptional({ enum: TakedownStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() identified_at?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() evidence?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Deprecated aliases (CZ-034 deploy-skew window; see TAKEDOWN_DEPRECATED_FIELDS) ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "affected_work".' }) @IsOptional() @IsString() @MaxLength(500) obra_afetada?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "artist_name".' }) @IsOptional() @IsString() @MaxLength(255) artista?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "platform".' }) @IsOptional() @IsString() @MaxLength(100) plataforma?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "infringing_url".' }) @IsOptional() @IsString() @MaxLength(MAX_URL_LENGTH) @IsSafeUrlText() url_infracao?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "reason".' }) @IsOptional() @IsString() motivo?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "priority".' }) @IsOptional() @IsIn(ACCEPTED_TAKEDOWN_PRIORITIES) prioridade?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "identified_at".' }) @IsOptional() @IsString() data_identificacao?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "evidence".' }) @IsOptional() @IsString() evidencias?: string;
}

export class UpdateTakedownDto extends PartialType(CreateTakedownDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryTakedownDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TakedownStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "platform".' }) @IsOptional() @IsString() plataforma?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
