import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = ['disponivel', 'em_uso', 'manutencao', 'descartado', 'reservado'] as const;

export class CreateInventoryItemDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) quantidade?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valor_unitario?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) localizacao?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) responsavel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) setor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() data_entrada?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) local_compra?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) numero_nota_fiscal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryInventoryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() localizacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
