import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ORGANIZATION_INDUSTRIES, transformOrganizationIndustry } from '../organization-industry';

export class CompleteOnboardingDto {
  @ApiProperty() @IsString() @MaxLength(255) companyName!: string;

  @ApiProperty({ enum: ORGANIZATION_INDUSTRIES })
  @Transform(transformOrganizationIndustry)
  @IsIn(ORGANIZATION_INDUSTRIES)
  segment!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
