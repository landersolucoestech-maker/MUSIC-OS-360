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

  @ApiPropertyOptional({ enum: ['original', 'reference'] })
  @IsOptional()
  @IsString()
  work_origin?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated (CZ-039): use "work_origin".' })
  @IsOptional()
  @IsString()
  tipo_obra?: string;

  @ApiPropertyOptional({ description: 'Project ID, or "none" for works without a linked project (legacy: "no-projeto").' })
  @IsOptional()
  @IsString()
  project_id?: string;

  @ApiPropertyOptional({ enum: ['with_code', 'without_code'], description: 'Legacy values com-ecad/sem-ecad are still accepted.' })
  @IsOptional()
  @IsIn(['with_code', 'without_code', 'com-ecad', 'sem-ecad'])
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
