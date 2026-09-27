import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTransactionDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias, not read by the service. Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  // Names actually read by TransactionsService.list().
  @ApiPropertyOptional({ example: 'receita' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'streaming' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artist_id?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
