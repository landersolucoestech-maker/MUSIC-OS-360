import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString, IsOptional, IsUUID, IsEnum, IsNotEmpty, MaxLength, IsArray, IsObject,
  ArrayMaxSize, ValidateNested, IsUrl,
} from 'class-validator';
import { canonicalServiceStatus } from '../musicchat-vocabulary';

export enum ConversationStatus  { OPEN = 'open', PENDING = 'pending', CLOSED = 'closed', SPAM = 'spam' }
export enum ConversationChannel {
  INTERNAL = 'internal',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  SMS = 'sms',
  DISCORD = 'discord',
  CUSTOM = 'custom',
}
export enum MessageSenderType  { USER = 'user', CONTACT = 'contact', SYSTEM = 'system', AI = 'ai' }
// CZ-045: a pre-CZ-045 web build sends the Portuguese values — mapped before
// validation by canonicalServiceStatus (musicchat-vocabulary.ts).
export enum ConversationServiceStatus {
  NEW = 'new',
  WAITING_AGENT = 'waiting_agent',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}
export enum ConversationDistributionMode {
  MANUAL = 'manual',
  ROUND_ROBIN = 'round_robin',
  LEAST_LOAD = 'least_load',
}

export class CreateConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()   contact_id?: string;
  @ApiProperty()         @IsString()  @MaxLength(500) subject:    string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(ConversationChannel) channel?: ConversationChannel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assigned_to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() queue_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sector_id?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(canonicalServiceStatus) @IsEnum(ConversationServiceStatus) service_status?: ConversationServiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(ConversationStatus)  status?:      ConversationStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)  subject?:     string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(ConversationChannel) channel?:     ConversationChannel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assigned_to?:   string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() queue_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sector_id?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(canonicalServiceStatus) @IsEnum(ConversationServiceStatus) service_status?: ConversationServiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(ConversationStatus)  status?:      ConversationStatus;
  @ApiPropertyOptional() @IsOptional() @IsEnum(ConversationChannel) channel?:     ConversationChannel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assigned_to?:   string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() queue_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sector_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tag_id?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(canonicalServiceStatus) @IsEnum(ConversationServiceStatus) service_status?: ConversationServiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() sla_state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?:         string;
  @ApiPropertyOptional() @IsOptional() limit?:  number;
  @ApiPropertyOptional() @IsOptional() offset?: number;
}

export enum MessageAttachmentKind { AUDIO = 'audio', IMAGE = 'image', DOCUMENT = 'document' }

// Mirrors the frontend's ChatAttachmentData (shared/components/ChatAttachment.tsx). Every
// attachment reaching here already went through useUploadToR2 (presign -> PUT to R2 -> confirm),
// so `url` is always a backend-issued publicUrl, never client-supplied storage — validating shape
// here just stops a malformed/incomplete payload from being persisted and echoed back to other
// participants, matching the same nested-DTO validation internal-chat already has (see
// InternalMessageAttachmentDto in modules/internal-chat/dto/internal-chat.dto.ts).
export class MessageAttachmentDto {
  @ApiProperty({ enum: MessageAttachmentKind })
  @IsEnum(MessageAttachmentKind)
  kind: MessageAttachmentKind;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  mime: string;
}

export class CreateMessageDto {
  @ApiProperty()         @IsString() @IsNotEmpty() @MaxLength(50000) body: string;
  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

export class CreateNoteDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(10000) body: string;
}

export class AssignConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assignee_id?: string | null;
}

export class TransferConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() queue_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sector_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assignee_id?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  /** Optimistic concurrency (Task M) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class CloseConversationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiPropertyOptional() @IsOptional() @Transform(canonicalServiceStatus) @IsEnum(ConversationServiceStatus) service_status?: ConversationServiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsObject() crm_actions?: Record<string, unknown>;
}

export class ReopenConversationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

