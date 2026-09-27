import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const FINANCIAL_CATEGORY_NATURES = [
  'revenue',
  'revenue_deduction',
  'direct_cost',
  'operating_expense',
  'non_operational',
] as const;

export type FinancialCategoryNature = typeof FINANCIAL_CATEGORY_NATURES[number];

function optionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}

export class CreateFinancialCategoryDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  template_id?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: FINANCIAL_CATEGORY_NATURES })
  @IsIn(FINANCIAL_CATEGORY_NATURES)
  nature!: FinancialCategoryNature;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includes_in_pnl?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateFinancialCategoryDto extends PartialType(CreateFinancialCategoryDto) {
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;
}

export class QueryFinancialCategoryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: FINANCIAL_CATEGORY_NATURES })
  @IsOptional()
  @IsIn(FINANCIAL_CATEGORY_NATURES)
  nature?: FinancialCategoryNature;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Filters root categories only.' })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  root?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  includes_in_pnl?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  level?: number;
}

export class MoveFinancialCategoryDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class ReorderFinancialCategoryDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  sort_order!: number;
}
