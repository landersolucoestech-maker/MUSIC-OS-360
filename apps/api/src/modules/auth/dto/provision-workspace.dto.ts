import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ORGANIZATION_INDUSTRIES, transformOrganizationIndustry } from '../organization-industry';

export class ProvisionWorkspaceDto {
  @ApiProperty() @IsString() @MaxLength(255) organizationName!: string;
  @ApiProperty() @IsString() @MaxLength(255) workspaceName!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]{2,100}$/)
  workspaceSlug!: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_INDUSTRIES })
  @Transform(transformOrganizationIndustry)
  @IsOptional()
  @IsIn(ORGANIZATION_INDUSTRIES)
  segment?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) tradeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) corporateEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) requestedPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() acceptedTerms?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() acceptedLgpd?: boolean;
}
