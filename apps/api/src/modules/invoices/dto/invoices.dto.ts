import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsNumber, IsBoolean, IsArray, IsUUID,
  IsEmail, MaxLength, Min, Max, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const FISCAL_DOCUMENT_TYPES = ['nfse', 'nfe', 'nfce'] as const;

export class InvoiceItemDto {
  @ApiProperty() @IsString() @MaxLength(2000) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) codigo_servico?: string;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) quantidade!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) unit_price!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) total_amount!: number;
}

/**
 * Canonical contract of NotaFiscalFormModal.
 *
 * The old DTO described a Stripe/English object (`type`, `amount`,
 * `issuerName`, `recipientDoc`) that did not match the screen's real payload.
 * With whitelist/forbidNonWhitelisted, the full form was rejected or
 * had fields discarded. This DTO follows the names actually displayed,
 * validated and persisted by the interface.
 */
export class CreateInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) numero?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) serie?: string;
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) tipo_nota?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() venda_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) natureza_operacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) codigo_servico_municipal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) codigo_municipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cfop?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) service_description?: string;

  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() data_emissao?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() vencimento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) tomador_cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) tomador_razao_social?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) tomador_inscricao_estadual?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) tomador_inscricao_municipal?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(100) tomador_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) tomador_address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) tomador_city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) tomador_uf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) tomador_cep?: string;

  /** Legacy column still used by events and old screens; mirrors service_amount. */
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) legacy_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) service_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) deductions_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) base_calculo?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) aliquota_iss?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) iss_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() iss_retido?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) pis_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) cofins_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) inss_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) ir_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) csll_amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) net_amount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) forma_pagamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) condicao_pagamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) url_pdf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ type: [InvoiceItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  itens?: InvoiceItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) tipo_nota?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  // Legacy aliases kept only for old clients; the service must
  // prioritize the canonical fields above.
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
}
