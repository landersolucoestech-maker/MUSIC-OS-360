import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateContractTemplateDto } from './create-contract-template.dto';

export class UpdateContractTemplateDto extends PartialType(CreateContractTemplateDto) {
  /** Optimistic concurrency — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional({ description: 'updated_at lido pelo cliente antes de editar — detecta edição concorrente (409 se divergir)' })
  @IsOptional() @IsString()
  expectedUpdatedAt?: string;
}
