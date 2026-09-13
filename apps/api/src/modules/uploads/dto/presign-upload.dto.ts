/**
 * modules/uploads/dto/presign-upload.dto.ts
 *
 * DTO para requisição de URL pré-assinada de upload directo ao R2.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsIn, IsNumber, IsPositive, IsOptional, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UploadCategory } from '../../../storage/storage.service';

const UPLOAD_CATEGORIES: UploadCategory[] = [
  'documents', 'images', 'audio', 'spreadsheets', 'videos',
];

export class PresignUploadDto {
  @ApiProperty({ example: 'contrato-artista.pdf' })
  @IsString()
  @MaxLength(500)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(255)
  mimeType!: string;

  @ApiProperty({ example: 2048000, description: 'Tamanho do arquivo em bytes' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  sizeBytes!: number;

  @ApiProperty({
    enum: UPLOAD_CATEGORIES,
    example: 'documents',
    description: 'Categoria do upload — determina regras de MIME e tamanho',
  })
  @IsIn(UPLOAD_CATEGORIES)
  category!: UploadCategory;

  @ApiPropertyOptional({ example: 'contract', description: 'Entidade relacionada ao arquivo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entity?: string;

  @ApiPropertyOptional({ example: 'uuid-do-contrato' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  entityId?: string;
}
