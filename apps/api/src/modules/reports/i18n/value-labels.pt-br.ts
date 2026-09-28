/**
 * value-labels.pt-br.ts — PT-BR labels of persisted enum VALUES in report
 * spreadsheets (technical value = English, spreadsheet cell = PT-BR).
 *
 * Export writes the label instead of the raw value (never `revenue`,
 * `credit_card`, `pending` in a PT-BR spreadsheet); import maps the label back
 * to the canonical value, so an exported file round-trips. Labels come from
 * @music-os-360/types (single source shared with the web).
 */
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
  works: { work_origin: WORK_ORIGIN_LABELS_PT_BR, ai_usage_level: WORK_AI_USAGE_LEVEL_LABELS_PT_BR },
  phonograms: {
    media_type: PHONOGRAM_MEDIA_TYPE_LABELS_PT_BR,
    recording_classification: PHONOGRAM_RECORDING_CLASSIFICATION_LABELS_PT_BR,
  },
  clients: { person_type: CLIENT_PERSON_TYPE_LABELS_PT_BR, priority: CLIENT_PRIORITY_LABELS_PT_BR },
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

function labelsFor(table: string, column: string): Labels | null {
  if (column === 'status') {
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
