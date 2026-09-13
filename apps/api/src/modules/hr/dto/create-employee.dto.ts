import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { EmployeeStatus } from '@music-os-360/types';

export class CreateEmployeeDto {
  @IsString() nome: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() tipo_contrato?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() salario?: string;
  @IsOptional() @IsDateString() data_admissao?: string;
  @IsOptional() @IsDateString() data_demissao?: string;
  @IsOptional() documents?: unknown[];
  @IsOptional() metadata?: Record<string, unknown>;
}
