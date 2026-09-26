import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, IsUUID, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = ['ativa', 'negociacao', 'proposta', 'expirada'] as const;
const REMUNERATION_TYPES = ['FIXED', 'PERCENTAGE', 'FIXED_PLUS_PERCENTAGE'] as const;

/** Contrato canônico do formulário LicencaFormModal. */
export class CreateLicenseDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) obra_musical?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artista?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) cliente?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) projeto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) tipo_uso?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) midia_destino?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) territorio?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() start_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() end_date?: string;

  @ApiPropertyOptional({ enum: REMUNERATION_TYPES })
  @IsOptional() @IsIn(REMUNERATION_TYPES)
  remuneration_type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) percentage?: number;

  /** Legacy physical fields, accepted only for interoperability. */
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) moeda?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateLicenseDto extends PartialType(CreateLicenseDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryLicenseDto extends PaginationDto {
  /** Accepts a single status ("ativa") or several separated by commas
   * ("negociacao,proposta") — the "Propostas" tab of Licenciamento.tsx
   * spans two statuses (Task H). */
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() midia_destino?: string;
}
