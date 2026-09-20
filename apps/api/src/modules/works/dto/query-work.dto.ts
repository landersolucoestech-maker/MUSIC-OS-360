import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryWorkDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'MPB', description: 'Filtro server-side pelo gênero (coluna music_genre).' })
  @IsOptional()
  @IsString()
  music_genre?: string;

  @ApiPropertyOptional({ example: 'autoral' })
  @IsOptional()
  @IsString()
  tipo_obra?: string;

  @ApiPropertyOptional({ description: 'ID do projeto, ou "sem-projeto" para obras sem projeto vinculado.' })
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

  @ApiPropertyOptional({ deprecated: true, description: 'Alias legado. Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;
}
