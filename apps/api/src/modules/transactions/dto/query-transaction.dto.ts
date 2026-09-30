import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTransactionDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy alias, mapped to "artist_id" by the service (canonical wins when both are sent).' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  // Names actually read by TransactionsService.list().
  @ApiPropertyOptional({ example: 'revenue', description: 'revenue | expense | investment | tax | transfer (legacy receita/despesa/... still mapped)' })
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
