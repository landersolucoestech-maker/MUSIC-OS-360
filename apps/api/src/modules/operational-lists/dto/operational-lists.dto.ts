import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * EXACT keys of the `useOperationalSettings` hook (frontend) — product
 * rule: 1 form field = 1 identical name across every layer.
 */
export class CreateOperationalListItemDto {
  @ApiProperty() @IsString() @MaxLength(50) kind!: string;
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiProperty() @IsString() @MaxLength(100) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) group?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class UpdateOperationalListItemDto extends PartialType(CreateOperationalListItemDto) {}

export class QueryOperationalListItemDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() kind?: string;
  /** Matches the slug or the legacy slug (pre-OL1 Portuguese alias) of a platform default. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Type(() => Boolean) active?: boolean;
}
