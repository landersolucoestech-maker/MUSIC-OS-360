import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateEcadReportDto {
  @IsString()
  period: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  work_id?: string;

  @IsOptional()
  @IsString()
  gross_amount?: string;

  @IsOptional()
  @IsString()
  net_amount?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUrl()
  file_url?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
