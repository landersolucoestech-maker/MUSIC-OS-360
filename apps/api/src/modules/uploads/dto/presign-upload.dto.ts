/**
 * modules/uploads/dto/presign-upload.dto.ts
 *
 * DTO for requesting a presigned URL for a direct upload to R2.
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

  @ApiProperty({ example: 2048000, description: 'File size in bytes' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  sizeBytes!: number;

  @ApiProperty({
    enum: UPLOAD_CATEGORIES,
    example: 'documents',
    description: 'Upload category — determines MIME and size rules',
  })
  @IsIn(UPLOAD_CATEGORIES)
  category!: UploadCategory;

  @ApiPropertyOptional({ example: 'contract', description: 'Entity related to the file' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entity?: string;

  @ApiPropertyOptional({ example: '00000000-0000-4000-8000-000000000003' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  entityId?: string;
}
