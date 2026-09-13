import {
  IsString, IsOptional, IsUUID, IsArray, IsObject, IsIn, IsBoolean,
  IsInt, IsNumber, MaxLength, Min, IsNotEmpty, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const PROJECT_TYPES = [
  'music_video', 'visualizer', 'lyric_video', 'teaser', 'reels', 'backstage',
  'documentary', 'live_session', 'aftermovie', 'promo', 'commercial',
  'social_content', 'other',
] as const;

export const PROJECT_STATUSES = [
  'draft', 'briefing', 'pre_production', 'production', 'post_production',
  'approval', 'delivered', 'published', 'cancelled',
] as const;

export const PROJECT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const DELIVERABLE_TYPES = [
  'youtube_master', 'vertical_reels', 'tiktok_cut', 'teaser', 'thumbnail',
  'subtitles', 'backstage_cut', 'trailer', 'stories', 'ads', 'short_clip', 'other',
] as const;

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revision_requested'] as const;

export const TEAM_ROLES = [
  'director', 'producer', 'camera', 'editor', 'colorist', 'motion_designer',
  'photographer', 'stylist', 'makeup', 'actor', 'assistant', 'drone_operator', 'other',
] as const;

// ── Projects ──────────────────────────────────────────────────────────────────
export class CreateAudiovisualProjectDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) slug?: string;
  @ApiProperty({ enum: PROJECT_TYPES }) @IsIn(PROJECT_TYPES) type!: typeof PROJECT_TYPES[number];
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional({ enum: PROJECT_STATUSES })
  @IsOptional() @IsIn(PROJECT_STATUSES) status?: typeof PROJECT_STATUSES[number];
  @ApiPropertyOptional({ enum: PROJECT_PRIORITIES })
  @IsOptional() @IsIn(PROJECT_PRIORITIES) priority?: typeof PROJECT_PRIORITIES[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budget_estimated?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budget_actual?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) production_company?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) director?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) producer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() start_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recording_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() delivery_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() publish_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() release_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phonogram_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() campaign_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() event_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Campos do formulário (chaves EXATAS de AudiovisualProjectFormModal) ──────
  // Regra de produto: cada campo do form tem a sua coluna física
  // (migration 20260718000012). music_id/budget/real_cost usam os nomes
  // reais já existentes (phonogram_id/budget_estimated/budget_actual).
  //
  // find (Wave 13): estes campos estavam declarados em QueryAudiovisualProjectDto
  // (um DTO de query params de listagem) em vez de aqui -- o corpo real de
  // create/update era rejeitado inteiro por forbidNonWhitelisted, exatamente o
  // bug que audiovisual.dto.spec.ts's "regressao do bug real" foi escrito para
  // prevenir. Movidos para o DTO correto.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) music_title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) artist_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) format?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) videomaker?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) editor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shooting_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) capture_status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) editing_status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) approval_status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pre_release_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() release_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() concept?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) final_status?: string;
}

export class UpdateAudiovisualProjectDto extends PartialType(CreateAudiovisualProjectDto) {
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class TransitionProjectStatusDto {
  @ApiProperty({ enum: PROJECT_STATUSES }) @IsIn(PROJECT_STATUSES) status!: typeof PROJECT_STATUSES[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryAudiovisualProjectDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: PROJECT_STATUSES })
  @IsOptional() @IsIn(PROJECT_STATUSES) status?: typeof PROJECT_STATUSES[number];
  @ApiPropertyOptional({ enum: PROJECT_TYPES })
  @IsOptional() @IsIn(PROJECT_TYPES) type?: typeof PROJECT_TYPES[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() artist_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() release_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() campaign_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() event_id?: string;
}

// ── Briefings ─────────────────────────────────────────────────────────────────
export class UpsertBriefingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() concept?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() visual_style?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() references_list?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() target_audience?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() platforms?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() format_requirements?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() aspect_ratios?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() color_palette?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() moodboard_links?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() inspiration_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() campaign_alignment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artist_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manager_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() technical_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

// ── Deliverables ──────────────────────────────────────────────────────────────
export class CreateDeliverableDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @ApiProperty({ enum: DELIVERABLE_TYPES }) @IsIn(DELIVERABLE_TYPES) type!: typeof DELIVERABLE_TYPES[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) platform?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) format?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) resolution?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) duration_sec?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() file_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnail_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() delivery_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateDeliverableDto extends PartialType(CreateDeliverableDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approved?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryDeliverableDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() audiovisual_project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

// ── Approvals ─────────────────────────────────────────────────────────────────
export class RequestApprovalDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() deliverable_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) comments?: string;
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: APPROVAL_STATUSES }) @IsIn(APPROVAL_STATUSES) status!: typeof APPROVAL_STATUSES[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) comments?: string;
  /** Concorrência otimista (Task K) — ver optimistic-update.util.ts. Opcional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryApprovalDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() audiovisual_project_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() deliverable_id?: string;
  @ApiPropertyOptional({ enum: APPROVAL_STATUSES })
  @IsOptional() @IsIn(APPROVAL_STATUSES) status?: typeof APPROVAL_STATUSES[number];
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export class QueryDashboardDto {
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
}

// ── Shots ─────────────────────────────────────────────────────────────────────
// Only 2 values are evidenced by this repo (DB default 'pending' + the DTO
// test's one asserted-valid value 'recording'). This is almost certainly an
// incomplete real-world shot-capture lifecycle (no terminal/completed state)
// — if the product needs more states, that requires a product decision on
// their names; do not add speculative values here without that input.
export const CAPTURE_STATUSES = ['pending', 'recording'] as const;

export class CreateShotDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) scene_title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() actors?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() props?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() wardrobe?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsArray() equipment?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) estimated_duration_sec?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) ordering?: number;
}

export class UpdateShotDto extends PartialType(CreateShotDto) {
  @ApiPropertyOptional({ enum: CAPTURE_STATUSES })
  @IsOptional() @IsIn(CAPTURE_STATUSES) shooting_status?: typeof CAPTURE_STATUSES[number];
}

export class ReorderShotsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMaxSize(500) @IsUUID('4', { each: true }) ids!: string[];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const TASK_STATUSES = ['pending', 'in_progress', 'blocked', 'done', 'cancelled'] as const;

export class CreateTaskDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional() @IsIn(TASK_STATUSES) status?: typeof TASK_STATUSES[number];
  @ApiPropertyOptional({ enum: PROJECT_PRIORITIES })
  @IsOptional() @IsIn(PROJECT_PRIORITIES) priority?: typeof PROJECT_PRIORITIES[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigned_to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() due_date?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

// ── Team members ──────────────────────────────────────────────────────────────
export class CreateTeamMemberDto {
  @ApiProperty({ enum: TEAM_ROLES }) @IsIn(TEAM_ROLES) role!: typeof TEAM_ROLES[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() user_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) external_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) payment_amount?: number;
}
