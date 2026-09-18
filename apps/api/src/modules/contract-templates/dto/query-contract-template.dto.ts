import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// find-8229f49e: `status` was declared here but ContractTemplatesService.list()
// never reads it (silently-ignored-filter anti-pattern, see events.dto.ts's
// own fix for the same bug class) -- removed. `active` is a real filter the
// service already implements but had no DTO field to reach it through
// (search/ascending/offset/limit already come from PaginationDto).
export class QueryContractTemplateDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;
}
