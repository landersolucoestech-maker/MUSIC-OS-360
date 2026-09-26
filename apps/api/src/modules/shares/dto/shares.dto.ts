import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, Min, Max, MaxLength, IsUUID, IsArray, IsInt, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const ROLES = ['author', 'composer', 'producer', 'performer', 'publisher', 'master-owner', 'other'] as const;

export class CreateShareDto {
  // ── Legacy EN aliases (integrations/registry) — optional ────────────────────
  // holderName is the only input that feeds holder_name (toColumns() in
  // shares.service.ts) — there is no direct `holder_name` field in the DTO.
  // Rejects empty/whitespace-only instead of accepting and persisting a blank holder.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  @Matches(/\S/, { message: 'holderName não pode ser vazio ou conter apenas espaços' })
  holderName?: string;
  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trackId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) holderDoc?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // ── Form fields (EXACT keys of SharePendenteFormModal) ───────────────────────
  // Product rule 2026-07-12: each form field has its own physical column.
  // `percentage` also covers the old legacy EN alias (same name, same
  // column since 2026-09-13/RenameSharePartyFieldsToEnglish — see toColumns()).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) share_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) percentage?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() acordo_notas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() acordo_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) direction?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() release_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) music_title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) holder?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) recipient?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artista_externo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artista_project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) pagador?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) pagador_contato?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) origem_acordo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() data_prevista?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documents?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() versao?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() historico?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) total_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) settled_amount?: number;
}

export class UpdateShareDto extends PartialType(CreateShareDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryShareDto extends PaginationDto {
  @ApiPropertyOptional({ deprecated: true, description: 'Alias legado, não lido pelo service. Use "work_id".' })
  @IsOptional() @IsString() workId?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Alias legado, não lido pelo service. Use "phonogram_id".' })
  @IsOptional() @IsString() trackId?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Alias legado, não lido pelo service. Use "party_role".' })
  @IsOptional() @IsString() role?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phonogram_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() party_role?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['a_receber', 'a_enviar']) direction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() share_type?: string;
}
