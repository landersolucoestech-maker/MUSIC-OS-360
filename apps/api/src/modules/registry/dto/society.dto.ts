import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SocietyAccountStatus,
  SocietyDriver,
  SocietyName,
  SocietySubmissionStatus,
} from '@music-os-360/types';

export class CreateSocietyAccountDto {
  @IsEnum(SocietyName)
  society!: SocietyName;

  @IsEnum(SocietyDriver)
  driver!: SocietyDriver;

  @IsString() @MaxLength(255)
  account_name!: string;

  @IsOptional() @IsString() @MaxLength(100)
  member_code?: string;

  /** Pointer into the secrets store — NEVER raw credentials. */
  @IsOptional() @IsString() @MaxLength(255)
  credentials_ref?: string;

  @IsOptional() @IsEnum(SocietyAccountStatus)
  status?: SocietyAccountStatus;
}

export class UpdateSocietyAccountDto {
  @IsOptional() @IsString() @MaxLength(255)
  account_name?: string;

  @IsOptional() @IsString() @MaxLength(100)
  member_code?: string;

  @IsOptional() @IsString() @MaxLength(255)
  credentials_ref?: string;

  @IsOptional() @IsEnum(SocietyAccountStatus)
  status?: SocietyAccountStatus;

  @IsOptional() @IsEnum(SocietyDriver)
  driver?: SocietyDriver;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @IsOptional() @IsString()
  expectedUpdatedAt?: string;
}

export class UpdateSubmissionStatusDto {
  @IsEnum(SocietySubmissionStatus)
  status!: SocietySubmissionStatus;

  @IsOptional() @IsString() @MaxLength(2000)
  message?: string;

  /** Optional external protocol assigned by the society. */
  @IsOptional() @IsString() @MaxLength(100)
  protocol?: string;

  @IsOptional() @IsString() @MaxLength(255)
  external_id?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  failure_reason?: string;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @IsOptional() @IsString()
  expectedUpdatedAt?: string;
}

export class QuerySubmissionDto {
  @IsOptional() @IsEnum(SocietySubmissionStatus)
  status?: SocietySubmissionStatus;

  @IsOptional() @IsEnum(SocietyName)
  society?: SocietyName;

  @IsOptional() @IsUUID()
  entity_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;
}
