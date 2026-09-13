import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArtistRelationshipType } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryArtistDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'MPB' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: ArtistRelationshipType })
  @IsOptional()
  @IsEnum(ArtistRelationshipType)
  vinculo?: ArtistRelationshipType;
}
