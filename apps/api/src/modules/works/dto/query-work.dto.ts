import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryWorkDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'MPB', description: 'Server-side filter by genre (music_genre column).' })
  @IsOptional()
  @IsString()
  music_genre?: string;

  @ApiPropertyOptional({ example: 'autoral' })
  @IsOptional()
  @IsString()
  tipo_obra?: string;

  @ApiPropertyOptional({ description: 'Project ID, or "sem-projeto" for works without a linked project.' })
  @IsOptional()
  @IsString()
  project_id?: string;

  @ApiPropertyOptional({ enum: ['com-ecad', 'sem-ecad'] })
  @IsOptional()
  @IsIn(['com-ecad', 'sem-ecad'])
  ecad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artist_id?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias. Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;
}
