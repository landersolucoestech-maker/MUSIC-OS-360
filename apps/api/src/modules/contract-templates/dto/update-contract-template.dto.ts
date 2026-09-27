import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateContractTemplateDto } from './create-contract-template.dto';

export class UpdateContractTemplateDto extends PartialType(CreateContractTemplateDto) {
  /** Optimistic concurrency — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString()
  expectedUpdatedAt?: string;
}
