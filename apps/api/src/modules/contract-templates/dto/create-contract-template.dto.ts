import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

// Campos do formulário (chaves EXATAS do ContractImportWorkspace.tsx) —
// regra de produto: cada campo do form tem a sua coluna física.
export class CreateContractTemplateDto {
  @ApiProperty({ example: 'Template Contrato de Exclusividade' })
  @IsString() @MaxLength(500)
  nome!: string;

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
  descricao?: string;

  @ApiPropertyOptional({ description: 'Manifesto de variáveis detectadas (JSON serializado)' })
  @IsOptional() @IsString()
  variables_manifest?: string;

  @ApiPropertyOptional({ description: 'Imagem de cabeçalho (data URL base64)' })
  @IsOptional() @IsString()
  header_image?: string | null;

  @ApiPropertyOptional({ description: 'Imagem de rodapé (data URL base64)' })
  @IsOptional() @IsString()
  footer_image?: string | null;
}
