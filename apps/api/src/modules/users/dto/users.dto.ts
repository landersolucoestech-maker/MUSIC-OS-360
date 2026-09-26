import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEmail, Matches, MaxLength, IsObject } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = ['active', 'inactive', 'suspended', 'invited'] as const;

export class CreateUserDto {
  /** User identifier stored in auth_user_id column. */
  @ApiProperty({ description: 'Identificador único do utilizador (JWT sub)' })
  @IsString()
  userId!: string;

  @ApiProperty() @IsEmail() email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;

  @ApiProperty({ description: 'Slug de papel global ou customizado do tenant' })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  role!: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

/**
 * Update of the membership profile.
 *
 * `email` and `userId` do not belong to this endpoint: both live in the
 * authentication provider and require their own confirmation/admin flows.
 *
 * Task L: `status` (is_active) and `role` were REMOVED from this DTO — they were
 * accepted here via `PATCH /users/:id` (gate 'manager' only) without going through
 * the authorization/hierarchy checks the dedicated endpoints have
 * (`PATCH /users/:id/role`, gate 'admin', validates the hierarchy via
 * assertCanAssignRole; `PATCH /users/:id/status`, gate 'owner', protects the
 * last owner via assertNotLastOwner). A 'manager' could
 * self-promote to 'owner' or deactivate the tenant's last owner by bypassing
 * those protections. This DTO now covers only pure profile fields.
 */
export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class AssignRoleDto {
  @ApiProperty({ description: 'Slug do novo papel a atribuir ao utilizador' })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  role!: string;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

/** Task L: dedicated endpoint (PATCH /users/:id/status), separate from UpdateUserDto
 * to keep the same last-owner protection that remove() already had. */
export class SetStatusDto {
  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES) status!: string;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class InviteUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() roleId!: string;
}

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
}
