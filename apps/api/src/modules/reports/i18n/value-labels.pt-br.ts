/**
 * value-labels.pt-br.ts — PT-BR labels of persisted enum VALUES in report
 * spreadsheets (technical value = English, spreadsheet cell = PT-BR).
 *
 * Export writes the label instead of the raw value (never `revenue`,
 * `credit_card`, `pending` in a PT-BR spreadsheet); import maps the label back
 * to the canonical value, so an exported file round-trips. Labels come from
 * @music-os-360/types (single source shared with the web).
 */
import { PROJECT_TYPE_LABELS_PT_BR } from '../../projects/project-track-vocabulary';
import {
  STATUS_LABELS_PT_BR_BY_DOMAIN,
  TRANSACTION_TYPE_LABELS_PT_BR,
  TRANSACTION_COUNTERPARTY_TYPE_LABELS_PT_BR,
  TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR,
  TRANSACTION_PAYMENT_TYPE_LABELS_PT_BR,
  TRANSACTION_INSTALLMENT_INTERVAL_LABELS_PT_BR,
  WORK_ORIGIN_LABELS_PT_BR,
  WORK_AI_USAGE_LEVEL_LABELS_PT_BR,
  PHONOGRAM_MEDIA_TYPE_LABELS_PT_BR,
  PHONOGRAM_RECORDING_CLASSIFICATION_LABELS_PT_BR,
} from '@music-os-360/types';

type Labels = Readonly<Record<string, string>>;

// ── API-local label maps (not yet in @music-os-360/types; same wording as the
// web option lists: crm-relationships/constants, artist/services/artist.mapper) ──

/** shares.share_type (financial discriminator; NULL = registry split is not labelled). Same wording as web share-format.tsx SHARE_TYPE_OPTIONS. */
export const SHARE_TYPE_LABELS_PT_BR: Labels = {
  internal_release: 'Lançamento interno',
  external_receivable: 'Share externo a receber',
};

/** clients.person_type (CZ-043). */
export const CLIENT_PERSON_TYPE_LABELS_PT_BR: Labels = {
  individual: 'Pessoa física',
  company: 'Pessoa jurídica',
};

/** clients.priority. */
export const CLIENT_PRIORITY_LABELS_PT_BR: Labels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  strategic: 'Estratégica',
};

/** artists.profile_type (CZ-042). */
export const ARTIST_PROFILE_TYPE_LABELS_PT_BR: Labels = {
  independent: 'Independente',
  managed: 'Com empresário',
  record_label: 'Com gravadora',
  publisher: 'Com editora',
};

/** artists.specialties items (CZ-042; multi-valued jsonb list). */
export const ARTIST_SPECIALTY_LABELS_PT_BR: Labels = {
  dj: 'DJ',
  dj_producer: 'DJ/Produtor',
  songwriter: 'Compositor/Autor',
  performer: 'Intérprete',
  producer: 'Produtor',
};

/** artists metadata `gender` (CZ-042). */
export const ARTIST_GENDER_LABELS_PT_BR: Labels = {
  male: 'Masculino',
  female: 'Feminino',
};

/** artists.registration_status (ArtistRegistrationStatus). */
export const ARTIST_REGISTRATION_STATUS_LABELS_PT_BR: Labels = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso',
};

/** marketing_tasks.kind (metadata-independent column; web catalog TASK_TYPE_OPTIONS, same wording). A kind outside the catalog exports as-is. */
export const MARKETING_TASK_KIND_LABELS_PT_BR: Labels = {
  design: 'Design',
  audiovisual: 'Audiovisual',
  copywriting: 'Copywriting',
  publishing: 'Publicação',
  campaign: 'Campanha',
  planning: 'Planejamento',
  approval: 'Aprovação',
  review: 'Revisão',
  analysis: 'Análise',
  meeting: 'Reunião',
  behind_the_scenes_shot: 'Bastidor',
  institutional_content: 'Conteúdo Institucional',
  commercial_content: 'Conteúdo Comercial',
  artistic_content: 'Conteúdo Artístico',
  portal: 'Portal',
  crm: 'CRM',
  paid_traffic: 'Tráfego Pago',
  cover: 'Capa',
  banner: 'Banner',
  press_kit: 'Press Kit',
  flyer: 'Flyer',
  social_media_art: 'Arte para Redes Sociais',
  visual_identity: 'Identidade Visual',
  thumbnail: 'Thumbnail',
  promotional_material: 'Material Promocional',
  music_video: 'Videoclipe',
  social_media_video: 'Vídeo para Redes Sociais',
  making_of: 'Making Of',
  behind_the_scenes: 'Bastidores',
  lyric_video: 'Lyric Video',
  visualizer: 'Visualizer',
  interview: 'Entrevista',
  podcast_video: 'Podcast em Vídeo',
  event_coverage: 'Captação de Evento',
  prospecting: 'Prospecção',
  negotiation: 'Negociação',
  follow_up: 'Follow-up',
  relationship: 'Relacionamento',
  release_planning: 'Planejamento de Lançamento',
  institutional_material: 'Material Institucional',
  commercial_presentation: 'Apresentação Comercial',
  folder: 'Folder',
  institutional_video: 'Vídeo Institucional',
  company_behind_the_scenes: 'Bastidores da Empresa',
  corporate_event_coverage: 'Cobertura de Evento Corporativo',
  corporate_interview: 'Entrevista Corporativa',
  institutional_campaign: 'Campanha Institucional',
  branding: 'Branding',
  brand_positioning: 'Posicionamento de Marca',
  announcements: 'Comunicados',
  partner_relationship: 'Relacionamento com Parceiros',
  partnerships: 'Parcerias',
  career_planning: 'Planejamento de Carreira',
  schedule_management: 'Gestão de Agenda',
  strategic_planning: 'Planejamento Estratégico',
  press_relations: 'Assessoria de Imprensa',
  release: 'Release',
  personal_branding: 'Branding Pessoal',
  positioning: 'Posicionamento',
  growth_strategies: 'Estratégias de Crescimento',
  photo_session: 'Sessão de Fotos',
  social_media_content: 'Conteúdo para Redes Sociais',
  contracting: 'Contratações',
  shows: 'Shows',
  motion_cover: 'Motion Cover',
  promotional_art: 'Arte de Divulgação',
  teaser: 'Teaser',
  release_content: 'Conteúdo de Lançamento',
  distribution: 'Distribuição',
  metadata: 'Metadados',
  pitching: 'Pitching',
  pre_save: 'Pré-save',
  release_campaign: 'Campanha de Lançamento',
  promotion: 'Divulgação',
  influencers: 'Influenciadores',
  content_approval: 'Aprovação de Conteúdo',
};

/** marketing_tasks.targetType (jsonb field of the task form; canonical MarketingTarget). */
export const MARKETING_TARGET_LABELS_PT_BR: Labels = {
  music_project: 'Projeto Musical',
  artist: 'Artista',
  company: 'Empresa',
};

/** Separator of a multi-valued enum cell (same as the repeatable-group multi fields). */
export const MULTI_VALUE_LABEL_SEPARATOR = ' | ';

/** Report table -> status domain of @music-os-360/types. */
const STATUS_DOMAIN_BY_TABLE: Readonly<Record<string, keyof typeof STATUS_LABELS_PT_BR_BY_DOMAIN>> = {
  artists: 'artist', contracts: 'contract', works: 'work', phonograms: 'phonogram', releases: 'release',
  shares: 'share', transactions: 'transaction', invoices: 'invoice', leads: 'lead', clients: 'client',
  campaigns: 'campaign', briefings: 'briefing', takedowns: 'takedown', content_detections: 'content_detection',
  projects: 'project', events: 'event', employees: 'employee', payroll_entries: 'payroll',
  leave_requests: 'leave_request', ecad_reports: 'ecad_report', inventory_items: 'inventory',
  licenses: 'license', artist_goals: 'artist_goal',
};

/** Non-status enum columns (logical AND physical keys, since export uses the logical one). */
const COLUMN_LABELS: Readonly<Record<string, Readonly<Record<string, Labels>>>> = {
  transactions: {
    type: TRANSACTION_TYPE_LABELS_PT_BR,
    transaction_type: TRANSACTION_TYPE_LABELS_PT_BR,
    counterparty_type: TRANSACTION_COUNTERPARTY_TYPE_LABELS_PT_BR,
    payment_method: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR,
    payment_type: TRANSACTION_PAYMENT_TYPE_LABELS_PT_BR,
    installment_interval: TRANSACTION_INSTALLMENT_INTERVAL_LABELS_PT_BR,
  },
  // projectType is the logical export column of projects.type (the importer resolves the physical `type`).
  projects: { projectType: PROJECT_TYPE_LABELS_PT_BR, type: PROJECT_TYPE_LABELS_PT_BR },
  works: { work_origin: WORK_ORIGIN_LABELS_PT_BR, ai_usage_level: WORK_AI_USAGE_LEVEL_LABELS_PT_BR },
  phonograms: {
    media_type: PHONOGRAM_MEDIA_TYPE_LABELS_PT_BR,
    recording_classification: PHONOGRAM_RECORDING_CLASSIFICATION_LABELS_PT_BR,
  },
  shares: { share_type: SHARE_TYPE_LABELS_PT_BR },
  clients: { person_type: CLIENT_PERSON_TYPE_LABELS_PT_BR, priority: CLIENT_PRIORITY_LABELS_PT_BR },
  marketing_tasks: { kind: MARKETING_TASK_KIND_LABELS_PT_BR, targetType: MARKETING_TARGET_LABELS_PT_BR },
  artists: {
    profile_type: ARTIST_PROFILE_TYPE_LABELS_PT_BR,
    specialties: ARTIST_SPECIALTY_LABELS_PT_BR,
    gender: ARTIST_GENDER_LABELS_PT_BR,
    registration_status: ARTIST_REGISTRATION_STATUS_LABELS_PT_BR,
  },
};

/** Enum columns persisted as a list of values (jsonb array): one cell = labels joined by MULTI_VALUE_LABEL_SEPARATOR. */
const MULTI_VALUE_COLUMNS: Readonly<Record<string, ReadonlySet<string>>> = {
  artists: new Set(['specialties']),
};

export function isMultiValueLabelColumn(table: string, column: string): boolean {
  return MULTI_VALUE_COLUMNS[table]?.has(column) ?? false;
}

/**
 * Logical export/import column that carries the table's status under another name
 * (projects: `projectStatus` -> status). Without it the column falls through to no labels and
 * the sheet shows the raw canonical token (`in_progress`) instead of the PT-BR label.
 */
const LOGICAL_STATUS_COLUMN: Readonly<Record<string, string>> = { projects: 'projectStatus' };

function labelsFor(table: string, column: string): Labels | null {
  if (column === 'status' || LOGICAL_STATUS_COLUMN[table] === column) {
    const domain = STATUS_DOMAIN_BY_TABLE[table];
    return domain ? (STATUS_LABELS_PT_BR_BY_DOMAIN[domain] as Labels) : null;
  }
  return COLUMN_LABELS[table]?.[column] ?? null;
}

const hasOwn = (labels: Labels, key: string): boolean => Object.prototype.hasOwnProperty.call(labels, key);

/**
 * PT-BR label of a persisted enum value for export; null when the cell is not
 * an enum value. A multi-valued enum list exports its labels joined by
 * MULTI_VALUE_LABEL_SEPARATOR (an unknown item is kept as-is, never dropped).
 */
export function exportValueLabel(table: string, column: string, value: unknown): string | null {
  const labels = labelsFor(table, column);
  if (!labels) return null;
  if (Array.isArray(value)) {
    if (!isMultiValueLabelColumn(table, column) || !value.every((item) => typeof item === 'string')) return null;
    return (value as string[]).map((item) => (hasOwn(labels, item) ? labels[item] : item)).join(MULTI_VALUE_LABEL_SEPARATOR);
  }
  if (typeof value !== 'string') return null;
  return hasOwn(labels, value) ? labels[value] : null;
}

/**
 * Canonical value of an exported PT-BR label (trimmed, case-insensitive); null
 * when not a label. A raw canonical value is accepted first (exact match).
 */
export function valueFromExportLabel(table: string, column: string, text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const labels = labelsFor(table, column);
  if (!labels) return null;
  if (hasOwn(labels, text.trim())) return text.trim();
  const wanted = text.trim().toLowerCase();
  for (const [value, label] of Object.entries(labels)) {
    if (label.toLowerCase() === wanted) return value;
  }
  return null;
}
