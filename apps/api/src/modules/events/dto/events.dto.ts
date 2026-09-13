import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEnum, IsNumber, IsDate, IsDateString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
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

  // ── Campos do formulário (chaves EXATAS do SchedulerFormModal) ───────────────
  // Regra de produto 2026-07-12: cada campo do form tem a sua coluna física.
  @ApiPropertyOptional() @IsOptional() @IsString() endereco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contato_local?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) valor_cache?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) publico_esperado?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional() @IsOptional() participantes?: unknown[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ enum: EventStatus }) @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryEventDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;

  // Nomes efetivamente lidos por EventsService.list(). "type"/"artistId" (aliases
  // em inglês) existiam aqui sem nenhum caller real e sem leitura no service —
  // removidos (eram um filtro 200-mas-silenciosamente-ignorado à espera de acontecer).
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artist_id?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @IsDateString() dateTo?: string;
}
