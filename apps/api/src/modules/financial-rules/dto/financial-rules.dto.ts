import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIPOS    = ['imposto', 'comissao', 'external_rights_fee', 'desconto', 'taxa', 'outros'] as const;
const CALCULOS = ['percentual', 'fixo', 'faixa'] as const;

export class CreateFinancialRuleDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiProperty({ enum: TIPOS }) @IsIn(TIPOS) type!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiProperty({ enum: CALCULOS }) @IsIn(CALCULOS) calculo!: string;
  @ApiProperty() @IsNumber() @Type(() => Number) valor!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() condicoes?: Record<string, unknown>;
}

export class UpdateFinancialRuleDto extends PartialType(CreateFinancialRuleDto) {
  @ApiPropertyOptional({ description: 'updated_at lido pelo cliente antes de editar — detecta edição concorrente (409 se divergir)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryFinancialRuleDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
