import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { HolderDocumentType, HolderType } from '@music-os-360/types';

export class CreateRightsHolderDto {
  @IsString() @MaxLength(255)
  legal_name!: string;

  @IsOptional() @IsString() @MaxLength(255)
  artistic_name?: string;

  @IsOptional() @IsEnum(HolderDocumentType)
  document_type?: HolderDocumentType;

  @IsOptional() @IsString() @MaxLength(30)
  document_number?: string;

  @IsOptional() @IsString() @Length(2, 2)
  country?: string;

  @IsOptional() @IsString() @MaxLength(20)
  ipi_cae?: string;

  @IsOptional() @IsString() @MaxLength(50)
  society?: string;

  @IsOptional() @IsString() @MaxLength(100)
  society_member_code?: string;

  @IsOptional() @IsEnum(HolderType)
  holder_type?: HolderType;
}

export class UpdateRightsHolderDto {
  @IsOptional() @IsString() @MaxLength(255)
  legal_name?: string;

  @IsOptional() @IsString() @MaxLength(255)
  artistic_name?: string;

  @IsOptional() @IsEnum(HolderDocumentType)
  document_type?: HolderDocumentType;

  @IsOptional() @IsString() @MaxLength(30)
  document_number?: string;

  @IsOptional() @IsString() @Length(2, 2)
  country?: string;

  @IsOptional() @IsString() @MaxLength(20)
  ipi_cae?: string;

  @IsOptional() @IsString() @MaxLength(50)
  society?: string;

  @IsOptional() @IsString() @MaxLength(100)
  society_member_code?: string;

  @IsOptional() @IsEnum(HolderType)
  holder_type?: HolderType;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @IsOptional() @IsString()
  expectedUpdatedAt?: string;
}

export class QueryRightsHolderDto {
  @IsOptional() @IsString() @MaxLength(255)
  search?: string;

  @IsOptional() @IsEnum(HolderType)
  holder_type?: HolderType;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;
}
