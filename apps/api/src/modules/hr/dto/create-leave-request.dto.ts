import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsInt, ValidateIf } from 'class-validator';
import { IsHttpOrStorageUrl } from '../../../common/validators/safe-url.validation';

export class CreateLeaveRequestDto {
  @ValidateIf((o: CreateLeaveRequestDto) => o.funcionario_id === undefined)
  @IsString()
  employee_id?: string;

  @ApiPropertyOptional({ description: 'vacation | sick_leave | maternity_leave | paternity_leave | excused_absence | unexcused_absence | day_off | compensatory_time_off (deprecated PT labels are mapped)' })
  @IsString()
  type: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional() @IsInt() total_days?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() approved_by?: string;
  @IsOptional() @IsHttpOrStorageUrl() document_url?: string;
  @IsOptional() metadata?: Record<string, unknown>;

  // ── Deprecated names (CZ-030), moved to the canonical ones by hr-legacy-fields.ts ──
  @ApiPropertyOptional({ deprecated: true, description: 'Use "employee_id".' }) @IsOptional() @IsString() funcionario_id?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "total_days".' }) @IsOptional() @IsInt() dias_totais?: number;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "reason".' }) @IsOptional() @IsString() motivo?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "approved_by".' }) @IsOptional() @IsString() aprovado_por?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "document_url".' }) @IsOptional() @IsHttpOrStorageUrl() documento_url?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "notes".' }) @IsOptional() @IsString() observacoes?: string;
}
