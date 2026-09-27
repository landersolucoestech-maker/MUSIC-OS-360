import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsEnum, IsArray, ArrayMinSize, ArrayMaxSize,
  IsNotEmpty, MaxLength, ValidateNested, IsUrl,
} from 'class-validator';

export enum InternalConversationType { DIRECT = 'direct', GROUP = 'group' }

export class CreateInternalConversationDto {
  @ApiProperty({ enum: InternalConversationType })
  @IsEnum(InternalConversationType)
  type: InternalConversationType;

  @ApiPropertyOptional({ description: 'Group name (type=group only)' })
  @IsOptional() @IsString() @MaxLength(255)
  name?: string;

  @ApiProperty({ type: [String], description: 'auth_user_id of the other participants (without the creator, who is added automatically)' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true })
  participantAuthUserIds: string[];
}

export class InternalMessageAttachmentDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  mimeType?: string;
}

export class CreateInternalMessageDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(10000)
  body: string;

  @ApiPropertyOptional({ type: [InternalMessageAttachmentDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => InternalMessageAttachmentDto)
  attachments?: InternalMessageAttachmentDto[];
}

export class QueryInternalMembersDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(255)
  search?: string;
}
