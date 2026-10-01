import { IsString, IsOptional } from 'class-validator';
import { IsHttpOrStorageUrl } from '../../../common/validators/safe-url.validation';

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
  @IsHttpOrStorageUrl()
  file_url?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
