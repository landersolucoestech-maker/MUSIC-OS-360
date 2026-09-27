import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsIn, IsBoolean, IsUUID, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TRANSACTION_TYPES = ['RECEITA', 'DESPESA'] as const;

export class CreateFinanceCategoryRuleDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) keywords!: string[];
  @ApiProperty({ enum: TRANSACTION_TYPES }) @IsIn(TRANSACTION_TYPES) transaction_type!: string;
  @ApiProperty() @IsUUID() category_id!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateFinanceCategoryRuleDto extends PartialType(CreateFinanceCategoryRuleDto) {
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryFinanceCategoryRuleDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() transaction_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
