import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { EmployeeStatus } from '@music-os-360/types';

export class CreateEmployeeDto {
  @IsString() name: string;
  @IsOptional() @IsString() job_title?: string;
  @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ description: 'clt | pj | freelancer | internship | temporary (deprecated PT labels are mapped)' })
  @IsOptional() @IsString() contract_type?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsDateString() hired_at?: string;
  @IsOptional() @IsDateString() terminated_at?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() linked_user_id?: string;
  @IsOptional() documents?: unknown[];
  @IsOptional() metadata?: Record<string, unknown>;

  // ── Deprecated names (CZ-030), moved to the canonical ones by hr-legacy-fields.ts ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "job_title".' }) @IsOptional() @IsString() cargo?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "department".' }) @IsOptional() @IsString() departamento?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "contract_type".' }) @IsOptional() @IsString() tipo_contrato?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "phone".' }) @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "salary".' }) @IsOptional() @IsString() salario?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "hired_at".' }) @IsOptional() @IsDateString() data_admissao?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "terminated_at".' }) @IsOptional() @IsDateString() data_demissao?: string;
}
