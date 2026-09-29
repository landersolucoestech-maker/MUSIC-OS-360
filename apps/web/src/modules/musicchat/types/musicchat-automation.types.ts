export type MusicChatPriority = "low" | "medium" | "high" | "critical";
export type MusicChatNotificationChannel = "in_app" | "whatsapp" | "sms";

export interface MusicChatMenuOption {
  id: string;
  order: number;
  label: string;
  responseTemplateId: string;
  queue: string;
  sector: string;
  defaultAssignee?: string | null;
  tags: string[];
  priority: MusicChatPriority;
  active: boolean;
  required_fields?: string[];
  optional_fields?: string[];
}

export interface MusicChatTemplate {
  id: string;
  title: string;
  body: string;
}

export interface MusicChatEscalationRule {
  id: string;
  afterMinutes: number;
  level: string;
  recipientRole: "supervisor" | "manager" | string;
  recipientUserId?: string | null;
  channels: MusicChatNotificationChannel[];
  active: boolean;
}

export interface MusicChatAutomationSettings {
  id: string;
  tenant_id: string;
  enabled: boolean;
  welcome_message: string;
  main_menu_message: string;
  menu_options: MusicChatMenuOption[];
  templates: MusicChatTemplate[];
  required_fields: string[];
  optional_fields: string[];
  invalid_option_message: string;
  absence_message: string;
  out_of_hours_message: string;
  closing_message: string;
  return_to_menu_rule: {
    enabled?: boolean;
    commands?: string[];
  };
  escalation_rules: MusicChatEscalationRule[];
  notification_channels: Record<string, unknown>;
  supervisor_user_id?: string | null;
  manager_user_id?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicChatInboundMessagePayload {
  externalContactId: string;
  customerName: string;
  channel: string;
  body: string;
  phone?: string;
  instagram?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface MusicChatAutomationEvent {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  event_type: string;
  summary: string | null;
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}
