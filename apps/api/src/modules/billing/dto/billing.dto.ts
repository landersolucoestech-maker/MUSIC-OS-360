import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiPropertyOptional({ description: 'Plan ID (uuid) in the database' })
  @IsOptional() @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Plan slug in the database (e.g. professional)' })
  @IsOptional() @IsString()
  planSlug?: string;

  /** Legacy alias (slug). Kept for frontend compatibility. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional() @IsString()
  plan?: string;

  @ApiProperty({ example: 'https://app.example.com/settings/billing?success=1' })
  @IsString()
  successUrl: string;

  @ApiProperty({ example: 'https://app.example.com/settings/billing?canceled=1' })
  @IsString()
  cancelUrl: string;
}

export class CreatePortalDto {
  @ApiProperty({ example: 'https://app.example.com/settings/billing' })
  @IsString()
  returnUrl: string;
}
