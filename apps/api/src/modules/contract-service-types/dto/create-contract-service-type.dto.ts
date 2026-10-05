import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import type { DeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import {
  CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS,
  canonicalContractServiceTypeClientTypes,
  canonicalContractServiceTypeFinancialModel,
  canonicalContractServiceTypePaymentFrequency,
} from '../contract-service-type.vocabulary';

/** CZ-026 deploy-skew window: field names a pre-canonical web build still sends (see applyDeprecatedFieldAliases). */
export const CONTRACT_SERVICE_TYPE_DEPRECATED_FIELDS: DeprecatedFieldAliases = { conteudo: 'content' };

export class CreateContractServiceTypeDto {
  @ApiProperty({ example: 'Contrato de Distribuição' })
  @IsString() @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'distribution_contract' })
  @IsString() @MaxLength(255)
  slug!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  category?: string | null;

  @ApiProperty({ enum: CONTRACT_SERVICE_TYPE_CLIENT_TYPES, isArray: true, description: 'Deprecated Portuguese members are still accepted and mapped.' })
  @Transform(canonicalContractServiceTypeClientTypes)
  @IsArray() @IsIn(CONTRACT_SERVICE_TYPE_CLIENT_TYPES, { each: true })
  client_types!: string[];

  @ApiProperty({ enum: CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS, description: 'Deprecated Portuguese values are still accepted and mapped.' })
  @Transform(canonicalContractServiceTypeFinancialModel)
  @IsIn(CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS)
  financial_model!: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requires_external_rights_terms?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requires_fixed_value?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requires_advance?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requires_financial_support?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  allow_installments?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  default_financial_category?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsInt()
  sort_order?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  header_image_url?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  footer_image_url?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  content?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Use "content".' }) @IsOptional() @IsString()
  conteudo?: string;

  // JSON blobs travel over the wire pre-serialized by the frontend
  // (contracts.service.ts serializeJsonFields) — stored as-is in jsonb.
  @ApiPropertyOptional() @IsOptional() @IsString()
  participants?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  variables?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  music_work?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  signature_settings?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  branding_settings?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
  financial_currency?: string;

  @ApiPropertyOptional({ example: 'one_time', description: 'one_time | monthly | quarterly | yearly. Deprecated Portuguese values are still accepted and mapped.' })
  @Transform(canonicalContractServiceTypePaymentFrequency)
  @IsOptional() @IsString() @MaxLength(50)
  financial_payment_frequency?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  financial_penalty_percentage?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  financial_interest_percentage?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  financial_due_days?: number | null;

  // Sent by the frontend (ContractServiceTypeInsert) but ignored on the
  // server — the real created_at/updated_at come from @CreateDateColumn /
  // @UpdateDateColumn, never from the client (never trust an input timestamp).
  @ApiPropertyOptional() @IsOptional() @IsString()
  created_at?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  updated_at?: string;
}
