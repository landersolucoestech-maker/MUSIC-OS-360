import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, IsUUID, IsArray, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TYPES = ['album', 'ep', 'single', 'video', 'tour', 'podcast', 'other'] as const;
const STATUSES = Object.values(ProjectStatus) as string[];

/**
 * Contrato canônico (auditoria 2026-07-18): nomes EXATOS do formulário real
 * ativo (ProjetoFormModal.tsx / bulk-import em Projetos.tsx), não os nomes em
 * inglês do DTO anterior (title/type/artistId/budget/currency/startsAt/
 * deadlineAt/releasedAt) — que nunca tinham writer real e, mesmo se
 * aceitos, não batiam com as colunas físicas (title/type/status/description).
 */
export class CreateProjectDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: typeof TYPES[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) orcamento?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) genero?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // Lista de faixas em desenvolvimento — normalizada em project_tracks pelo
  // service (não é mais serializada em `description`).
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() musicas?: Record<string, unknown>[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ProjectStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryProjectDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() genero?: string;
}
