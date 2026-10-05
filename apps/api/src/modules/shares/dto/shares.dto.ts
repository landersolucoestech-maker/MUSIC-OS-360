import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, Min, Max, MaxLength, IsUUID, IsArray, IsInt, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SHARE_DIRECTIONS, SHARE_LEGACY_VALUES, SHARE_STATUSES, SHARE_TYPES } from '../share-legacy-fields';

const STATUS_INPUT = [...SHARE_STATUSES, ...Object.keys(SHARE_LEGACY_VALUES.status)];
const DIRECTION_INPUT = [...SHARE_DIRECTIONS, ...Object.keys(SHARE_LEGACY_VALUES.direction)];
const DEPRECATED = (canonical: string) => ({ deprecated: true, description: `Deprecated (CZ-037): use "${canonical}".` });

const ROLES = ['author', 'composer', 'producer', 'performer', 'publisher', 'master-owner', 'other'] as const;

export class CreateShareDto {
  // ── Canonical registry-share inputs (same names as the entity columns and QueryShareDto) ──
  // Rejects empty/whitespace-only instead of accepting and persisting a blank holder.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  @Matches(/\S/, { message: 'O nome do titular não pode ser vazio ou conter apenas espaços.' })
  holder_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) holder_document?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() work_id?: string;
  @ApiPropertyOptional({ description: 'Phonogram (shares.phonogram_id), not a release/project track.' }) @IsOptional() @IsString() phonogram_id?: string;
  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES) party_role?: string;

  // ── Deprecated EN aliases (SHARE_DEPRECATED_FIELDS): canonical wins when both are sent ──
  @ApiPropertyOptional(DEPRECATED('holder_name')) @IsOptional() @IsString() @MaxLength(255)
  @Matches(/\S/, { message: 'O nome do titular não pode ser vazio ou conter apenas espaços.' })
  holderName?: string;
  @ApiPropertyOptional({ ...DEPRECATED('party_role'), enum: ROLES }) @IsOptional() @IsIn(ROLES) role?: string;
  @ApiPropertyOptional(DEPRECATED('work_id')) @IsOptional() @IsString() workId?: string;
  @ApiPropertyOptional(DEPRECATED('phonogram_id')) @IsOptional() @IsString() trackId?: string;
  @ApiPropertyOptional({ ...DEPRECATED('holder_document') }) @IsOptional() @IsString() @MaxLength(50) holderDoc?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // ── Form fields (EXACT keys of the web share form (ShareFormModal)) ───────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  // `percentage` also covers the old legacy EN alias (same name, same
  // column since 2026-09-13/RenameSharePartyFieldsToEnglish — see toColumns()).
  // Closed set (SHARE_TYPES). Omitted stays NULL (registry/integration writers); no default.
  @ApiPropertyOptional({ enum: SHARE_TYPES }) @IsOptional() @IsIn(SHARE_TYPES) share_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) percentage?: number;
  // Legacy Portuguese values (pendente, enviado, ...) are accepted and mapped
  // to the canonical ShareStatus by the service (share-legacy-fields.ts).
  @ApiPropertyOptional({ enum: SHARE_STATUSES }) @IsOptional() @IsIn(STATUS_INPUT) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agreement_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agreement_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(DIRECTION_INPUT) direction?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() release_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) music_title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) holder?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) recipient?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) external_artist_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) payer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) payer_contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) agreement_source?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expected_at?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documents?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() version?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() history?: unknown[];

  // ── Deprecated Portuguese names (CZ-037, SHARE_DEPRECATED_FIELDS) ───────────
  @ApiPropertyOptional(DEPRECATED('external_artist_name')) @IsOptional() @IsString() @MaxLength(255) artista_externo?: string;
  @ApiPropertyOptional(DEPRECATED('artist_id')) @IsOptional() @IsUUID() artista_project_id?: string;
  @ApiPropertyOptional(DEPRECATED('payer')) @IsOptional() @IsString() @MaxLength(255) pagador?: string;
  @ApiPropertyOptional(DEPRECATED('payer_contact')) @IsOptional() @IsString() @MaxLength(255) pagador_contato?: string;
  @ApiPropertyOptional(DEPRECATED('agreement_source')) @IsOptional() @IsString() @MaxLength(255) origem_acordo?: string;
  @ApiPropertyOptional(DEPRECATED('expected_at')) @IsOptional() @IsDateString() data_prevista?: string;
  @ApiPropertyOptional(DEPRECATED('agreement_notes')) @IsOptional() @IsString() acordo_notas?: string;
  @ApiPropertyOptional(DEPRECATED('agreement_url')) @IsOptional() @IsString() acordo_url?: string;
  @ApiPropertyOptional(DEPRECATED('version')) @IsOptional() @Type(() => Number) @IsInt() versao?: number;
  @ApiPropertyOptional(DEPRECATED('history')) @IsOptional() @IsArray() historico?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) total_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) settled_amount?: number;
}

export class UpdateShareDto extends PartialType(CreateShareDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryShareDto extends PaginationDto {
  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias, mapped to "work_id" by the service (canonical wins when both are sent).' })
  @IsOptional() @IsUUID() workId?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias, mapped to "phonogram_id" by the service (canonical wins when both are sent).' })
  @IsOptional() @IsUUID() trackId?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias, mapped to "party_role" by the service (canonical wins when both are sent).' })
  @IsOptional() @IsString() role?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phonogram_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() party_role?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(DIRECTION_INPUT) direction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ enum: SHARE_TYPES }) @IsOptional() @IsIn(SHARE_TYPES) share_type?: string;
}
