import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsUUID, MaxLength, IsObject } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TYPES = ['enviado', 'recebido'] as const;
const PRIORITIES = ['alta', 'media', 'baixa'] as const;
const STATUSES = ['pendente', 'em_andamento', 'concluido', 'rejeitado'] as const;

/**
 * Canonical contract of the TakedownFormModal modal.
 *
 * The previous DTO described another product (`platform`, `trackId`, `reason`,
 * `requestedAt`) and made the ValidationPipe reject the real snake_case payload
 * sent by the interface. These fields correspond 1:1 to the inputs
 * persisted by the form and to the physical columns of `takedowns`.
 */
export class CreateTakedownDto {
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiPropertyOptional({ enum: TYPES }) @IsOptional() @IsIn(TYPES) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) obra_afetada?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artista?: string;
  @ApiProperty() @IsString() @MaxLength(100) plataforma!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() url_infracao?: string;
  @ApiProperty() @IsString() motivo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) prioridade?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() data_identificacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() evidencias?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  // Optional relations filled by internal flows, without replacing the
  // readable fields displayed in the form.
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateTakedownDto extends PartialType(CreateTakedownDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryTakedownDto extends PaginationDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plataforma?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
