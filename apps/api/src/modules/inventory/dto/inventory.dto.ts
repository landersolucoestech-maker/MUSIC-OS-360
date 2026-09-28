import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ACCEPTED_INVENTORY_STATUSES, INVENTORY_STATUSES } from '../inventory-legacy-fields';

export class CreateInventoryItemDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) unit_price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) storage_location?: string;
  // Deprecated PT status slugs are also accepted and mapped (inventory-legacy-fields.ts).
  @ApiPropertyOptional({ enum: INVENTORY_STATUSES }) @IsOptional() @IsIn(ACCEPTED_INVENTORY_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) responsible_person?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) sector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entry_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) purchase_location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) numero_nota_fiscal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  // ── Deprecated aliases (CZ-032 deploy-skew window; see INVENTORY_DEPRECATED_FIELDS) ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "quantity".' })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) quantidade?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "storage_location".' })
  @IsOptional() @IsString() @MaxLength(255) localizacao?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "responsible_person".' })
  @IsOptional() @IsString() @MaxLength(255) responsavel?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "sector".' })
  @IsOptional() @IsString() @MaxLength(100) setor?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "entry_date".' })
  @IsOptional() @IsString() data_entrada?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "purchase_location".' })
  @IsOptional() @IsString() @MaxLength(255) local_compra?: string;
}

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryInventoryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storage_location?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "storage_location".' }) @IsOptional() @IsString() localizacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
