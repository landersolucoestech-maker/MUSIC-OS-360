/**
 * Marketing Module — Status badges.
 *
 * One tone-driven base badge plus typed wrappers per entity status, so colors
 * stay consistent and pages never hand-roll status styling.
 */

import { Badge } from "@/shared/ui/badge";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  BRIEFING_STATUS_LABEL,
  BRIEFING_STATUS_TONE,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_TONE,
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_TONE,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  TONE_VARIANT,
  type Tone,
} from "../constants/marketing.constants";
import type {
  ApprovalStatus,
  BriefingStatus,
  CampaignStatus,
  ContentDisplayStatus,
  ProjectStatus,
  TaskStatus,
} from "../types/marketing.types";

export function MarketingBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={className}>
      {children}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <MarketingBadge tone={PROJECT_STATUS_TONE[status]}>{PROJECT_STATUS_LABEL[status]}</MarketingBadge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <MarketingBadge tone={CAMPAIGN_STATUS_TONE[status]}>{CAMPAIGN_STATUS_LABEL[status]}</MarketingBadge>;
}

export function ContentStatusBadge({ status }: { status: ContentDisplayStatus }) {
  return <MarketingBadge tone={CONTENT_STATUS_TONE[status]}>{CONTENT_STATUS_LABEL[status]}</MarketingBadge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <MarketingBadge tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</MarketingBadge>;
}

export function BriefingStatusBadge({ status }: { status: BriefingStatus }) {
  return <MarketingBadge tone={BRIEFING_STATUS_TONE[status]}>{BRIEFING_STATUS_LABEL[status]}</MarketingBadge>;
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <MarketingBadge tone={APPROVAL_STATUS_TONE[status]}>{APPROVAL_STATUS_LABEL[status]}</MarketingBadge>;
}
