import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SyncPlatformProfileDto {
  @ApiPropertyOptional({ description: 'URL do perfil externo a sincronizar' })
  @IsOptional() @IsString() @IsUrl()
  profileUrl?: string;

  @ApiPropertyOptional({ description: 'Origem do dado de sync (único valor suportado hoje)', enum: ['profile_url'] })
  @IsOptional() @IsIn(['profile_url'])
  source?: 'profile_url';
}
