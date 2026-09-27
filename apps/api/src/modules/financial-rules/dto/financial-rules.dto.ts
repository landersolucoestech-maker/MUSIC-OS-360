import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, IsBoolean, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  ACCEPTED_CALCULATION_METHODS,
  ACCEPTED_RULE_TYPES,
  CALCULATION_METHODS,
  RULE_TYPES,
} from '../financial-rule-legacy.mapper';

export class CreateFinancialRuleDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiProperty({ enum: RULE_TYPES, description: 'Deprecated Portuguese values are still accepted and mapped.' })
  @IsIn(ACCEPTED_RULE_TYPES) type!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiProperty({ enum: CALCULATION_METHODS })
  @ValidateIf((o: CreateFinancialRuleDto) => o.calculo === undefined)
  @IsIn(ACCEPTED_CALCULATION_METHODS) calculation_method?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of calculation_method.' })
  @IsOptional() @IsIn(ACCEPTED_CALCULATION_METHODS) calculo?: string;
  @ApiProperty() @IsNumber() @Type(() => Number) value!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() conditions?: Record<string, unknown>;
  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of conditions.' })
  @IsOptional() condicoes?: Record<string, unknown>;
}

export class UpdateFinancialRuleDto extends PartialType(CreateFinancialRuleDto) {
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryFinancialRuleDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
