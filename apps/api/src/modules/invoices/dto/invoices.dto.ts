import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsNumber, IsBoolean, IsArray, IsUUID,
  IsEmail, MaxLength, Min, Max, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIPOS_NOTA = ['nfse', 'nfe', 'nfce'] as const;

export class InvoiceItemDto {
  @ApiProperty() @IsString() @MaxLength(2000) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) codigo_servico?: string;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) quantidade!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) unit_price!: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) total_amount!: number;
}

/**
 * Contrato canônico do NotaFiscalFormModal.
 *
 * O DTO antigo descrevia um objeto Stripe/inglês (`type`, `amount`,
 * `issuerName`, `recipientDoc`) que não correspondia ao payload real da tela.
 * Com whitelist/forbidNonWhitelisted, o formulário completo era rejeitado ou
 * tinha campos descartados. Este DTO acompanha os nomes efetivamente exibidos,
 * validados e persistidos pela interface.
 */
export class CreateInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) numero?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) serie?: string;
  @ApiPropertyOptional({ enum: TIPOS_NOTA }) @IsOptional() @IsIn(TIPOS_NOTA) tipo_nota?: string;
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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) tomador_endereco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) tomador_cidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) tomador_uf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) tomador_cep?: string;

  /** Coluna legada ainda usada por eventos e telas antigas; espelha service_amount. */
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
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: TIPOS_NOTA }) @IsOptional() @IsIn(TIPOS_NOTA) tipo_nota?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() client_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  // Aliases legados mantidos somente para clientes antigos; o service deve
  // priorizar os campos canônicos acima.
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
}
