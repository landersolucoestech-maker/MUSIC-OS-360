export type AudiovisualProjectType =
  | "music_video" | "visualizer" | "lyric_video" | "teaser" | "reels" | "backstage"
  | "documentary" | "live_session" | "aftermovie" | "promo" | "commercial" | "social_content" | "other";

export type AudiovisualProjectStatus =
  | "draft" | "briefing" | "pre_production" | "production" | "post_production"
  | "approval" | "delivered" | "published" | "cancelled";

export type AudiovisualFormat = "16:9" | "9:16" | "1:1" | "4:5" | string;
export type CaptureStatus = "scheduled" | "recording" | "recorded" | "pending";
export type EditingStatus = "not_started" | "editing" | "finished";
// Project-level approval_status (free string column; owner decision pending on "review"). Unchanged.
export type ApprovalStatus = "pending" | "review" | "approved" | "rejected";
// Approval decision statuses accepted by the API decision endpoint (APPROVAL_STATUSES). Never includes "review".
export const APPROVAL_DECISION_STATUSES = ["pending", "approved", "rejected", "revision_requested"] as const;
export type ApprovalDecisionStatus = typeof APPROVAL_DECISION_STATUSES[number];
export type FinalStatus = "planned" | "production" | "finished" | "published" | "archived";
export type DeliverableType = "master" | "cutdown" | "reels" | "thumbnail" | "teaser" | "other";
export type TeamRole = "director" | "producer" | "camera" | "editor" | "colorist" | "motion_designer" | "photographer" | "stylist" | "makeup" | "actor" | "assistant" | "drone_operator" | "other";
export type TaskStatus = "pending" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type AssetKind = "reference" | "moodboard" | "raw" | "edit" | "final" | "document" | "other";

export interface AudiovisualMusicCatalogItem { id: string; title: string; primaryArtist: string; isrc?: string | null; version?: string | null; }

export interface AudiovisualScriptScene {
  id: string;
  scene: string;
  environment: string;
  description: string;
  participants: string;
  shot_type: string;
  camera_movement: string;
  estimated_duration: string;
  status: string;
}

export interface AudiovisualShotPlan {
  id: string;
  shot: string;
  shot_type: string;
  movement: string;
  duration: string;
  status: string;
}

export interface AudiovisualChecklistItem { id: string; label: string; checked: boolean; }

export interface AudiovisualProject {
  id: string;
  code?: string | null;
  title?: string | null;
  name?: string | null;
  music_title?: string | null;
  artist_name?: string | null;
  campaign_name?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
  cover_url?: string | null;
  preview_image?: string | null;
  type: AudiovisualProjectType;
  project_type?: AudiovisualProjectType | null;
  phonogram_id?: string | null;
  format?: AudiovisualFormat | null;
  shooting_date?: string | null;
  recording_date?: string | null;
  release_date?: string | null;
  pre_release_date?: string | null;
  location?: string | null;
  director?: string | null;
  videographer?: string | null;
  editor?: string | null;
  budget?: string | number | null;
  real_cost?: string | number | null;
  budget_estimated?: string | number | null;
  budget_actual?: string | number | null;
  status: AudiovisualProjectStatus;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  final_status?: FinalStatus | null;
  capture_status?: CaptureStatus | null;
  editing_status?: EditingStatus | null;
  approval_status?: ApprovalStatus | null;
  concept?: string | null;
  objective?: string | null;
  observations?: string | null;
  references?: string[];
  moodboard?: string[];
  scenes?: AudiovisualScriptScene[];
  shot_list?: AudiovisualShotPlan[];
  checklist?: AudiovisualChecklistItem[];
  artist?: { id?: string; name?: string | null } | null;
  [key: string]: unknown;
}

export interface AudiovisualBriefing { id: string; audiovisual_project_id?: string; concept?: string; objective?: string; references?: string[]; moodboard?: string[]; notes?: string; }
export interface AudiovisualDeliverable { id: string; title: string; type?: DeliverableType; status?: string; file_url?: string; }
export interface AudiovisualApproval { id: string; status: ApprovalDecisionStatus; comments?: string; created_at?: string; }
export interface AudiovisualDashboard { total_projects?: number; in_production?: number; delivered?: number; pending_approval?: number; upcoming_publish_7d?: number; approvals_pending?: number; overdue_deliverables?: number; budget_estimated_total?: number; budget_actual_total?: number; by_status: Partial<Record<AudiovisualProjectStatus, number>>; }
export interface AudiovisualShot { id: string; shot?: string; shot_type?: string; movement?: string; duration?: string; status?: string; }
export interface AudiovisualProductionDay { id: string; shooting_date: string; location?: string; call_time?: string; wrap_time?: string; }
export interface AudiovisualTeamMember { id: string; name?: string; role: TeamRole; email?: string; phone?: string; }
export interface AudiovisualTask { id: string; title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigned_to?: string; due_date?: string; }
export interface AudiovisualAsset { id: string; name: string; file_url: string; kind?: AssetKind; thumbnail_url?: string; mime_type?: string; size_bytes?: number; description?: string; tags?: string[]; }

