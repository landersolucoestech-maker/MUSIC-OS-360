import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SyncPlatformProfileDto {
  @ApiPropertyOptional({ description: 'External profile URL to sync' })
  @IsOptional() @IsString() @IsUrl()
  profileUrl?: string;

  @ApiPropertyOptional({ description: 'Sync data source (only supported value today)', enum: ['profile_url'] })
  @IsOptional() @IsIn(['profile_url'])
  source?: 'profile_url';
}
