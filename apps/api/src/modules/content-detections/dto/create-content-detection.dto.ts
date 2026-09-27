import { IsString, IsOptional, IsUrl, IsUUID } from 'class-validator';

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
