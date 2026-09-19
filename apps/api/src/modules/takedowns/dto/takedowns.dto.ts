import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsUUID, MaxLength, IsObject } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIPOS = ['enviado', 'recebido'] as const;
const PRIORIDADES = ['alta', 'media', 'baixa'] as const;
const STATUSES = ['pendente', 'em_andamento', 'concluido', 'rejeitado'] as const;

/**
 * Contrato canônico do modal TakedownFormModal.
 *
 * O DTO anterior descrevia outro produto (`platform`, `trackId`, `reason`,
 * `requestedAt`) e fazia o ValidationPipe rejeitar o payload real em
 * snake_case enviado pela interface. Estes campos correspondem 1:1 aos inputs
 * persistidos pelo formulário e às colunas físicas de `takedowns`.
 */
export class CreateTakedownDto {
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiPropertyOptional({ enum: TIPOS }) @IsOptional() @IsIn(TIPOS) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) obra_afetada?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artista?: string;
  @ApiProperty() @IsString() @MaxLength(100) plataforma!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() url_infracao?: string;
  @ApiProperty() @IsString() motivo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: PRIORIDADES }) @IsOptional() @IsIn(PRIORIDADES) prioridade?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() data_identificacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() evidencias?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;

  // Relações opcionais preenchidas por fluxos internos, sem substituir os
  // campos legíveis exibidos no formulário.
  @ApiPropertyOptional() @IsOptional() @IsUUID() work_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateTakedownDto extends PartialType(CreateTakedownDto) {
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryTakedownDto extends PaginationDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plataforma?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
