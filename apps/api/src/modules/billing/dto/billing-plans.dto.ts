import {
  IsString, IsInt, IsIn, IsOptional, IsBoolean, IsArray, IsObject, Min, Matches, Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'professional' })
  @IsString() @Length(2, 60)
  slug: string;

  @ApiProperty({ example: 'Professional' })
  @IsString() @Length(2, 120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ example: 29900, description: 'Valor em centavos (> 0)' })
  @IsInt() @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'brl', default: 'brl' })
  @IsOptional() @IsString() @Matches(/^[a-z]{3}$/, { message: 'A moeda deve ser um código ISO de 3 letras minúsculas (ex.: brl).' })
  currency?: string;

  @ApiPropertyOptional({ enum: ['month', 'year'], default: 'month' })
  @IsOptional() @IsIn(['month', 'year'])
  interval?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional() @IsArray()
  features?: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional() @IsObject()
  limits?: Record<string, unknown>;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

/**
 * Decision Gate item 1 (product-completion audit): shape exposed by the
 * public, unauthenticated `/billing/plans/public` endpoint consumed by the
 * marketing Landing page. Deliberately excludes `id`, `stripe_product_id`,
 * `stripe_price_id`, `limits`, `created_at`/`updated_at` — no internal
 * billing/administrative data ever leaves this route. Allow-list, not a
 * deny-list, on purpose: a new column added to BillingPlanEntity later never
 * becomes publicly exposed by accident.
 */
export class PublicPlanDto {
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty({ description: 'Valor em centavos' }) amount: number;
  @ApiProperty() currency: string;
  @ApiProperty({ enum: ['month', 'year'] }) interval: string;
  @ApiProperty({ type: 'array', items: { type: 'string' } }) features: unknown[];
}
