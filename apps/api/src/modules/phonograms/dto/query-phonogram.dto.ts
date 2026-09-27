import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryPhonogramDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artist_id?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias. Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  work_id?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias. Use "work_id".' })
  @IsOptional()
  @IsUUID()
  workId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isrc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  music_genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: ['com-obra', 'sem-obra'] })
  @IsOptional()
  @IsIn(['com-obra', 'sem-obra'])
  obra_vinculada?: string;

  @ApiPropertyOptional({ enum: ['com-ecad', 'sem-ecad'] })
  @IsOptional()
  @IsIn(['com-ecad', 'sem-ecad'])
  ecad?: string;
}
