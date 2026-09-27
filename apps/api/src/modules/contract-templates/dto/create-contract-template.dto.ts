import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, ValidateIf } from 'class-validator';
import type { DeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';

/** CZ-026 deploy-skew window: field names a pre-canonical web build still sends (see applyDeprecatedFieldAliases). */
export const CONTRACT_TEMPLATE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  tipo_servico: 'service_type',
  conteudo: 'content',
};

// Form fields (EXACT keys of ContractImportWorkspace.tsx) —
// product rule: each form field has its own physical column.
export class CreateContractTemplateDto {
  @ApiProperty({ example: 'Template Contrato de Exclusividade' })
  @IsString() @MaxLength(500)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  service_type?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Use "service_type".' })
  @IsOptional() @IsString() @MaxLength(100)
  tipo_servico?: string;

  @ApiProperty()
  @ValidateIf((o: CreateContractTemplateDto) => o.conteudo === undefined)
  @IsString()
  content?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Use "content".' })
  @IsOptional() @IsString()
  conteudo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Manifest of detected variables (serialized JSON)' })
  @IsOptional() @IsString()
  variables_manifest?: string;

  @ApiPropertyOptional({ description: 'Header image (base64 data URL)' })
  @IsOptional() @IsString()
  header_image?: string | null;

  @ApiPropertyOptional({ description: 'Footer image (base64 data URL)' })
  @IsOptional() @IsString()
  footer_image?: string | null;
}
