import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload of the atomic mandatory password change endpoint (Part 74).
 * Password strength is validated in the service (password-policy.ts), not here —
 * we want rule-specific violation messages, not a generic
 * class-validator error.
 */
export class ChangeRequiredPasswordDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) newPassword!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) confirmPassword!: string;
}
