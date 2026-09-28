/**
 * modules/dashboard/lib/audit-activity.ts
 *
 * PT-BR presentation of audit-log rows for the Dashboard activity feed.
 * Audit actions are written by the API as "<entity>.<verb>" (AuditInterceptor,
 * e.g. "contract.updated") or "workflow.transition" (WorkflowEventsHandler,
 * after = { status }). Nothing technical (raw action/entity, entity_id/UUID,
 * status enum value) is ever returned for display: unknown values fall back to
 * generic PT-BR text.
 */
import { statusLabelPtBr } from "@music-os-360/types";

type Gender = "m" | "f";

export interface AuditEntityMeta {
  /** Canonical (singular, English) entity key — used by the UI to pick an icon. */
  key: string;
  noun: string;
  gender: Gender;
  badge: string;
  /** Domain for statusLabelPtBr (packages/types), when the entity has a status enum. */
  statusDomain?: string;
}

const ENTITIES: readonly AuditEntityMeta[] = [
  { key: "artist", noun: "Artista", gender: "m", badge: "Artista", statusDomain: "artist" },
  { key: "contract", noun: "Contrato", gender: "m", badge: "Contrato", statusDomain: "contract" },
  { key: "release", noun: "Lançamento", gender: "m", badge: "Lançamento", statusDomain: "release" },
  { key: "work", noun: "Obra", gender: "f", badge: "Obra", statusDomain: "work" },
  { key: "phonogram", noun: "Fonograma", gender: "m", badge: "Fonograma", statusDomain: "phonogram" },
  { key: "share", noun: "Participação", gender: "f", badge: "Catálogo", statusDomain: "share" },
  { key: "lead", noun: "Lead", gender: "m", badge: "CRM", statusDomain: "lead" },
  { key: "client", noun: "Cliente", gender: "m", badge: "CRM", statusDomain: "client" },
  { key: "contact", noun: "Contato", gender: "m", badge: "CRM" },
  { key: "transaction", noun: "Transação", gender: "f", badge: "Contabilidade", statusDomain: "transaction" },
  { key: "invoice", noun: "Fatura", gender: "f", badge: "Contabilidade", statusDomain: "invoice" },
  { key: "financial_category", noun: "Categoria financeira", gender: "f", badge: "Contabilidade" },
  { key: "financial_category_rule", noun: "Regra de categoria", gender: "f", badge: "Contabilidade" },
  { key: "financial_rule", noun: "Regra financeira", gender: "f", badge: "Contabilidade" },
  { key: "event", noun: "Agenda", gender: "f", badge: "Agenda", statusDomain: "event" },
  { key: "project", noun: "Projeto", gender: "m", badge: "Projetos", statusDomain: "project" },
  { key: "campaign", noun: "Campanha", gender: "f", badge: "Marketing", statusDomain: "campaign" },
  { key: "employee", noun: "Colaborador", gender: "m", badge: "Equipe", statusDomain: "employee" },
  { key: "user", noun: "Usuário", gender: "m", badge: "Equipe" },
  { key: "license", noun: "Licença", gender: "f", badge: "Catálogo", statusDomain: "license" },
  { key: "support_ticket", noun: "Chamado", gender: "m", badge: "Suporte", statusDomain: "support_ticket" },
];

/** Entity keys as persisted: singular (current API) plus legacy plural/PT-BR keys of older rows. */
const ENTITY_ALIASES: Readonly<Record<string, string>> = {
  artists: "artist", artistas: "artist",
  contracts: "contract", contratos: "contract",
  releases: "release", lancamentos: "release",
  works: "work", obras: "work",
  phonograms: "phonogram", fonogramas: "phonogram",
  shares: "share",
  leads: "lead",
  clients: "client", clientes: "client",
  contacts: "contact",
  transactions: "transaction", transacoes: "transaction",
  invoices: "invoice",
  events: "event", eventos: "event",
  projects: "project",
  campaigns: "campaign",
  employees: "employee",
  users: "user",
  licenses: "license",
  ticket: "support_ticket", tickets: "support_ticket", support_tickets: "support_ticket",
};

const ENTITY_BY_KEY = new Map(ENTITIES.map((meta) => [meta.key, meta]));

export function auditEntityMeta(entity: string | null | undefined): AuditEntityMeta | undefined {
  if (typeof entity !== "string") return undefined;
  const raw = entity.trim().toLowerCase();
  return ENTITY_BY_KEY.get(ENTITY_ALIASES[raw] ?? raw);
}

/** Participle stems: stem + "o"/"a" agrees with the entity's gender. */
const VERB_STEMS: Readonly<Record<string, string>> = {
  create: "criad", created: "criad",
  update: "atualizad", updated: "atualizad", upserted: "atualizad",
  delete: "removid", deleted: "removid",
  cancel: "cancelad", cancelled: "cancelad",
  sign: "assinad", signed: "assinad",
  archived: "arquivad",
  restored: "restaurad",
  approved: "aprovad",
  confirmed: "confirmad",
  closed: "encerrad",
  reopened: "reabert",
  submitted: "enviad",
  invited: "convidad",
};

/** Whole actions whose meaning is not "<entity> <participle>". */
const SPECIFIC_ACTION_LABELS: Readonly<Record<string, string>> = {
  "workflow.transition": "Status alterado",
  "client.attachment_added": "Anexo enviado",
  "client.attachment_removed": "Anexo removido",
  "client.timeline_entry_added": "Interação registrada",
  "user.status_changed": "Status alterado",
  "user.role_changed": "Perfil de acesso alterado",
  "registry.submission.status_changed": "Status alterado",
};

const GENERIC_LABEL = "Registro atualizado";

/** PT-BR headline of an audit action, gender-agreed ("Obra criada", "Contrato atualizado"). */
export function describeAuditAction(action: string | null | undefined, entity?: string | null): string {
  const normalizedAction = typeof action === "string" ? action.trim().toLowerCase() : "";
  const specific = SPECIFIC_ACTION_LABELS[normalizedAction];
  if (specific) return specific;

  const segments = normalizedAction.split(".").filter(Boolean);
  const verbKey = segments.length > 0 ? segments[segments.length - 1] : "";
  const stem = VERB_STEMS[verbKey];
  // "contract.updated" → the action prefix names the entity; the row's entity column is the fallback.
  const meta = (segments.length > 1 ? auditEntityMeta(segments[0]) : undefined) ?? auditEntityMeta(entity);

  if (!stem) return GENERIC_LABEL;
  if (!meta) return `Registro ${stem}o`;
  return `${meta.noun} ${stem}${meta.gender === "f" ? "a" : "o"}`;
}

/** Row shape consumed here (subset of the API audit_logs row). */
export interface AuditActivitySource {
  action: string;
  entity: string;
  after?: Record<string, unknown> | null;
}

function firstText(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

const NAME_KEYS = [
  "title",
  "stage_name",
  // DADO_HISTORICO: audit rows written before CZ-042/CZ-043 snapshot artists/clients
  // with their old column names; they are immutable history, never rewritten.
  "nome_artistico",
  "name",
  "nome",
] as const;

export interface AuditActivityView {
  label: string;
  description: string;
  badge: string;
  entityKey?: string;
}

/** Full PT-BR view of an audit row for the activity feed. Never exposes entity_id or raw values. */
export function describeAuditRow(row: AuditActivitySource): AuditActivityView {
  const segments = (row.action ?? "").toLowerCase().split(".");
  const meta = auditEntityMeta(row.entity) ?? (segments.length > 1 ? auditEntityMeta(segments[0]) : undefined);
  const after = (row.after ?? {}) as Record<string, unknown>;
  const label = describeAuditAction(row.action, row.entity);
  const badge = meta?.badge ?? "Sistema";

  if ((row.action ?? "").toLowerCase() === "workflow.transition") {
    const statusLabel = statusLabelPtBr(meta?.statusDomain, after.status) ?? "Status não reconhecido";
    return {
      label,
      description: meta ? `${meta.noun}: ${statusLabel}` : statusLabel,
      badge,
      entityKey: meta?.key,
    };
  }

  const name = firstText(after, NAME_KEYS);
  return {
    label,
    description: name ?? (meta ? meta.noun : "Detalhes não informados"),
    badge,
    entityKey: meta?.key,
  };
}
