import { IsString, IsOptional, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { IsSafeUrlText, MAX_URL_LENGTH } from '../../../common/validators/safe-url.validation';

export class CreateContentDetectionDto {
  @IsString()
  platform: string;

  @IsOptional()
  @IsUUID()
  work_id?: string;

  @IsOptional()
  @IsUUID()
  artist_id?: string;

  @IsOptional()
  @IsString()
  detected_title?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(MAX_URL_LENGTH)
  @IsSafeUrlText()
  url?: string;

  @IsOptional()
  @IsString()
  score?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
