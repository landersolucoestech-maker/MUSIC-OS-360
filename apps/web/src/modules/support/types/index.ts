export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus = SupportTicketStatus;
export type TicketPriority = SupportPriority;
export type TicketCategory =
  | 'financeiro'
  | 'analytics'
  | 'distribuicao'
  | 'contratos'
  | 'artistas'
  | 'projetos'
  | 'usuarios'
  | 'permissoes'
  | 'integracoes'
  | 'outro';

export type SystemStatusLevel = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' | 'offline';

export interface SupportTicket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportPriority;
  category: string;
  created_by: string;
  assigned_to?: string;
  sla_deadline?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  tags?: string[];
}

export interface SupportMessage {
  id: string;
  tenant_id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'user' | 'support' | 'admin';
  message: string;
  internal_note: boolean;
  created_at: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  article_count: number;
  color: string;
}

export type KnowledgeArticleType = "article" | "faq" | "tutorial" | "internal_doc";
export type KnowledgeArticleStatus = "draft" | "published" | "archived";

export interface KnowledgeArticle {
  id: string;
  /** Global content (Music OS 360) — not tenant-scoped. */
  category_id: string;
  category_name: string;
  title: string;
  summary: string;
  content: string;
  views: number;
  helpful_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  read_time: number;
  // Administrative fields (Knowledge Base management)
  type?: KnowledgeArticleType;
  published?: boolean;
  status?: KnowledgeArticleStatus; // Draft | Published | Archived
  order?: number;
}

export interface SystemService {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime: number;
  latency: number;
  last_incident?: string;
}

export interface IncidentUpdate {
  message: string;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  services: string[];
  created_at: string;
  resolved_at?: string;
  updates: IncidentUpdate[];
}

export interface SupportRequest {
  id: string;
  tenant_id: string;
  type: 'feature' | 'bug' | 'question' | 'billing' | 'integration';
  title: string;
  description: string;
  status: 'pending' | 'in_review' | 'approved' | 'done' | 'rejected';
  priority: SupportPriority;
  created_at: string;
  updated_at: string;
  votes: number;
}
