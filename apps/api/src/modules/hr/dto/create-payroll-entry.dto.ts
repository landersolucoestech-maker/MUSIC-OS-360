import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsDateString, ValidateIf } from 'class-validator';

// Money fields are strings on the wire (entity decimals); the global pipe's
// implicit conversion accepts the web form's numbers.
export class CreatePayrollEntryDto {
  @ValidateIf((o: CreatePayrollEntryDto) => o.funcionario_id === undefined)
  @IsString()
  employee_id?: string;

  @ValidateIf((o: CreatePayrollEntryDto) => o.competencia === undefined && o.mes_referencia === undefined)
  @IsString()
  reference_month?: string;

  @ValidateIf((o: CreatePayrollEntryDto) => o.salario_bruto === undefined)
  @IsString()
  gross_salary?: string;

  @IsOptional() @IsString() deductions?: string;
  @IsOptional() @IsString() bonus?: string;

  @ValidateIf((o: CreatePayrollEntryDto) => o.salario_liquido === undefined)
  @IsString()
  net_salary?: string;

  @IsOptional() @IsDateString() payment_date?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUrl() file_url?: string;
  @IsOptional() @IsDateString() paid_at?: string;
  @IsOptional() metadata?: Record<string, unknown>;

  // ── Deprecated names (CZ-030), moved to the canonical ones by hr-legacy-fields.ts ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "employee_id".' }) @IsOptional() @IsString() funcionario_id?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "reference_month".' }) @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "reference_month".' }) @IsOptional() @IsString() mes_referencia?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "gross_salary".' }) @IsOptional() @IsString() salario_bruto?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "deductions".' }) @IsOptional() @IsString() descontos?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "net_salary".' }) @IsOptional() @IsString() salario_liquido?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "payment_date".' }) @IsOptional() @IsDateString() data_pagamento?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "paid_at".' }) @IsOptional() @IsDateString() pago_em?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "file_url".' }) @IsOptional() @IsUrl() arquivo_url?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "notes".' }) @IsOptional() @IsString() observacoes?: string;
}
