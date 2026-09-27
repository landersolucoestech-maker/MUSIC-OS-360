import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAuditLogDto extends PaginationDto {
  /** Filter by action prefix/substring (e.g. "contract.updated") */
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;

  /** Filter by actor user ID */
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;

  /** Filter by entity type (e.g. "contract", "artist") */
  @ApiPropertyOptional() @IsOptional() @IsString() entity?: string;

  /** Filter by specific entity ID (UUID) */
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;

  /** Filter by actor role (e.g. "owner", "admin") */
  @ApiPropertyOptional() @IsOptional() @IsString() actorRole?: string;

  /** Filter by correlation ID (links to domain events from PHASE 3) */
  @ApiPropertyOptional() @IsOptional() @IsString() correlationId?: string;

  /** Start of date range (ISO 8601) */
  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z' })
  @IsOptional() @IsDateString() fromDate?: string;

  /** End of date range (ISO 8601) */
  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsOptional() @IsDateString() toDate?: string;
}

export class AdminListAuditLogsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entity?: string;
}
