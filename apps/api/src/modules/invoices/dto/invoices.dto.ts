import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsNumber, IsBoolean, IsArray, IsUUID,
  IsEmail, MaxLength, Min, Max, ValidateNested, IsObject, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { INVOICE_PAYMENT_METHODS } from '../invoice-legacy-fields';

const FISCAL_DOCUMENT_TYPES = ['nfse', 'nfe', 'nfce'] as const;

export class InvoiceItemDto {
  @ApiProperty() @IsString() @MaxLength(2000) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) service_code?: string;
  @ApiProperty() @ValidateIf((o: InvoiceItemDto) => o.quantidade === undefined) @IsNumber() @Min(1) @Type(() => Number) quantity!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) unit_price!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) total_amount!: number;

  // ── Deprecated aliases (CZ-036; see INVOICE_ITEM_DEPRECATED_FIELDS) ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "service_code".' }) @IsOptional() @IsString() @MaxLength(100) codigo_servico?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "quantity".' }) @IsOptional() @IsNumber() @Min(1) @Type(() => Number) quantidade?: number;
}

/**
 * Canonical contract of the invoice form (InvoiceFormModal; English generic
 * names since CZ-036, NFS-e fiscal terms kept). The pre-CZ-036 names are
 * accepted as deprecated input (invoice-legacy-fields.ts).
 *
 * The old DTO described a Stripe/English object (`type`, `amount`,
 * `issuerName`, `recipientDoc`) that did not match the screen's real payload.
 * With whitelist/forbidNonWhitelisted, the full form was rejected or
 * had fields discarded. This DTO follows the names actually displayed,
 * validated and persisted by the interface.
 */
export class CreateInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) invoice_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) serie?: string;
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES, description: 'Fiscal document kind (nfse | nfe | nfce). Persisted in the column invoices.tipo_nota.' }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) fiscal_document_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sale_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) natureza_operacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) codigo_servico_municipal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) codigo_municipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cfop?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) service_description?: string;

  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() issued_at?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @IsString() due_at?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) tomador_cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) tomador_legal_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) tomador_inscricao_estadual?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) tomador_inscricao_municipal?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(100) tomador_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) tomador_address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) tomador_city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) tomador_uf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) tomador_cep?: string;

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

  @ApiPropertyOptional({ enum: [...INVOICE_PAYMENT_METHODS], description: 'Canonical payment method (same vocabulary as transactions, plus bank_transfer). Deprecated Portuguese values (dinheiro, cartao_credito, cartao_debito, cheque, transferencia) are accepted and mapped; membership is enforced by InvoicesService.' })
  @IsOptional() @IsString() @MaxLength(100) payment_method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) payment_terms?: string;
  @ApiPropertyOptional({ description: 'Document (PDF) URL of the fiscal invoice.' }) @IsOptional() @IsString() @MaxLength(1000) file_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ type: [InvoiceItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Deprecated aliases (CZ-036 deploy-skew window; see INVOICE_DEPRECATED_FIELDS) ──
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES, deprecated: true, description: 'Use "fiscal_document_type".' }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) tipo_nota?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "invoice_number".' }) @IsOptional() @IsString() @MaxLength(100) numero?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "sale_id".' }) @IsOptional() @IsUUID() venda_id?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "issued_at".' }) @IsOptional() @IsString() data_emissao?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "due_at".' }) @IsOptional() @IsString() vencimento?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "tomador_legal_name".' }) @IsOptional() @IsString() @MaxLength(200) tomador_razao_social?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "payment_method".' }) @IsOptional() @IsString() @MaxLength(100) forma_pagamento?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "payment_terms".' }) @IsOptional() @IsString() @MaxLength(200) condicao_pagamento?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "service_amount".' }) @IsOptional() @IsNumber() @Min(0) @Type(() => Number) legacy_amount?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "file_url".' }) @IsOptional() @IsString() @MaxLength(1000) url_pdf?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "items".', type: [InvoiceItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  itens?: InvoiceItemDto[];
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) fiscal_document_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  // Legacy aliases kept only for old clients; the service must
  // prioritize the canonical fields above.
  @ApiPropertyOptional({ enum: FISCAL_DOCUMENT_TYPES, deprecated: true, description: 'Use "fiscal_document_type".' }) @IsOptional() @IsIn(FISCAL_DOCUMENT_TYPES) tipo_nota?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
}
