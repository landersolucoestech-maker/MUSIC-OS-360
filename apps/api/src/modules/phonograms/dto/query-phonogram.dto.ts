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

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Phonograms with (true) or without (false) a linked work.' })
  @IsOptional()
  @IsIn(['true', 'false'])
  has_work?: string;

  @ApiPropertyOptional({ deprecated: true, enum: ['com-obra', 'sem-obra'], description: 'Deprecated (CZ-040): use "has_work".' })
  @IsOptional()
  @IsIn(['com-obra', 'sem-obra'])
  obra_vinculada?: string;

  @ApiPropertyOptional({ enum: ['with_code', 'without_code'], description: 'Legacy values com-ecad/sem-ecad are still accepted.' })
  @IsOptional()
  @IsIn(['with_code', 'without_code', 'com-ecad', 'sem-ecad'])
  ecad?: string;
}
