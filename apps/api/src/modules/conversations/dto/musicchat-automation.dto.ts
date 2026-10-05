import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { blankToNull } from './conversations.dto';
import { ROUTING_KEY_PATTERN } from '../musicchat-vocabulary';

export class MusicChatMenuOptionDto {
  @ApiProperty() @IsString() @IsNotEmpty() id: string;
  @ApiProperty() @IsNumber() order: number;
  @ApiProperty() @IsString() @IsNotEmpty() label: string;
  @ApiProperty() @IsString() @IsNotEmpty() responseTemplateId: string;
  @ApiProperty() @IsString() @IsNotEmpty() queue: string;
  @ApiProperty() @IsString() @IsNotEmpty() sector: string;
  /** Canonical machine keys of the queue/sector labels (additive; the labels stay tenant-editable display text). */
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(ROUTING_KEY_PATTERN) queueKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(ROUTING_KEY_PATTERN) sectorKey?: string;
  @ApiPropertyOptional() @Transform(blankToNull) @IsOptional() @IsString() @MaxLength(255) defaultAssignee?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() required_fields?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() optional_fields?: string[];
}

export class MusicChatTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() id: string;
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() body: string;
}

export class MusicChatEscalationRuleDto {
  @ApiProperty() @IsString() @IsNotEmpty() id: string;
  @ApiProperty() @IsNumber() afterMinutes: number;
  @ApiProperty() @IsString() @IsNotEmpty() level: string;
  @ApiProperty() @IsString() @IsNotEmpty() recipientRole: string;
  @ApiPropertyOptional() @Transform(blankToNull) @IsOptional() @IsString() @MaxLength(255) recipientUserId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsArray() channels?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateMusicChatAutomationSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() welcome_message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() main_menu_message?: string;
  @ApiPropertyOptional({ type: [MusicChatMenuOptionDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MusicChatMenuOptionDto) menu_options?: MusicChatMenuOptionDto[];
  @ApiPropertyOptional({ type: [MusicChatTemplateDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MusicChatTemplateDto) templates?: MusicChatTemplateDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() required_fields?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() optional_fields?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() invalid_option_message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() absence_message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() out_of_hours_message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() closing_message?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() return_to_menu_rule?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [MusicChatEscalationRuleDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MusicChatEscalationRuleDto) escalation_rules?: MusicChatEscalationRuleDto[];
  @ApiPropertyOptional() @IsOptional() @IsObject() notification_channels?: Record<string, unknown>;
  @ApiPropertyOptional() @Transform(blankToNull) @IsOptional() @IsString() @MaxLength(255) supervisor_user_id?: string | null;
  @ApiPropertyOptional() @Transform(blankToNull) @IsOptional() @IsString() @MaxLength(255) manager_user_id?: string | null;
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class MusicChatInboundMessageDto {
  @ApiProperty() @IsString() @IsNotEmpty() externalContactId: string;
  @ApiProperty() @IsString() @IsNotEmpty() customerName: string;
  @ApiProperty() @IsString() @IsNotEmpty() channel: string;
  @ApiProperty() @IsString() @IsNotEmpty() body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class RunMusicChatEscalationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() conversationId?: string;
}

export class SendMusicChatNotificationDto {
  @ApiProperty() @IsUUID() conversationId: string;
  @ApiProperty() @IsString() @IsNotEmpty() level: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) recipientUserId: string;
  @ApiProperty() @IsIn(['in_app', 'whatsapp', 'sms']) channel: 'in_app' | 'whatsapp' | 'sms';
  @ApiProperty() @IsString() @MaxLength(255) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
