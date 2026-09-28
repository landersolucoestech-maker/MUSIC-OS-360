import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsIn, IsBoolean, IsUUID, IsArray, ArrayMinSize } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// Same vocabulary as financial_categories.transaction_types (CZ-041). A
// pre-CZ-041 web build sends RECEITA/DESPESA — mapped before validation.
export const RULE_TRANSACTION_TYPES = ['REVENUE', 'EXPENSE'] as const;
const LEGACY_RULE_TRANSACTION_TYPES: Readonly<Record<string, string>> = { RECEITA: 'REVENUE', DESPESA: 'EXPENSE' };
const canonicalRuleTransactionType = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (LEGACY_RULE_TRANSACTION_TYPES[value.toUpperCase()] ?? value) : value;

export class CreateFinanceCategoryRuleDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) keywords!: string[];
  @ApiProperty({ enum: RULE_TRANSACTION_TYPES }) @Transform(canonicalRuleTransactionType) @IsIn(RULE_TRANSACTION_TYPES) transaction_type!: string;
  @ApiProperty() @IsUUID() category_id!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateFinanceCategoryRuleDto extends PartialType(CreateFinanceCategoryRuleDto) {
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryFinanceCategoryRuleDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RULE_TRANSACTION_TYPES }) @IsOptional() @Transform(canonicalRuleTransactionType) @IsString() transaction_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
