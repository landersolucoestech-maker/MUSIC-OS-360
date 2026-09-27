import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

// Form fields (EXACT keys of ContractImportWorkspace.tsx) —
// product rule: each form field has its own physical column.
export class CreateContractTemplateDto {
  @ApiProperty({ example: 'Template Contrato de Exclusividade' })
  @IsString() @MaxLength(500)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  tipo_servico?: string;

  @ApiProperty()
  @IsString()
  conteudo!: string;

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
