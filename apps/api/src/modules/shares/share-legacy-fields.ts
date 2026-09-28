/**
 * share-legacy-fields.ts — CZ-037 deploy-skew compatibility for the share
 * contract.
 *
 * A web build released before CZ-036/CZ-037 sends the Portuguese field names
 * and values below; they are accepted as deprecated input and moved/mapped
 * here before persistence. Responses are canonical (English).
 *
 * `artista_project_id` was a mirror of `artist_id` (the web always wrote the
 * same value to both), so it folds into `artist_id`; the physical column is
 * kept as read-only `legacy_artist_project_id` (canonical map blocker).
 */
import { ShareStatus } from '@music-os-360/types';
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const SHARE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  artista_externo: 'external_artist_name',
  artista_project_id: 'artist_id',
  pagador: 'payer',
  pagador_contato: 'payer_contact',
  origem_acordo: 'agreement_source',
  data_prevista: 'expected_at',
  acordo_notas: 'agreement_notes',
  acordo_url: 'agreement_url',
  versao: 'version',
  historico: 'history',
};

/** Keys of a history[] entry (append-only audit trail). `percentual` in old
 * entries is historical data (readers fall back to it) and is not remapped. */
export const SHARE_HISTORY_ENTRY_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  versao: 'version',
  data: 'date',
  autor: 'author',
  descricao: 'description',
  acao: 'action',
  usuario: 'user',
  observacao: 'note',
  valor_anterior: 'previous_value',
  valor_novo: 'new_value',
};

export const SHARE_STATUSES: readonly string[] = Object.values(ShareStatus);

/** Legacy Portuguese persisted values → canonical value, per column. */
export const SHARE_LEGACY_VALUES: Readonly<Record<'status' | 'direction' | 'type' | 'party_role', Readonly<Record<string, string>>>> = {
  status: {
    ativo: ShareStatus.ACTIVE,
    inativo: ShareStatus.INACTIVE,
    pendente: ShareStatus.PENDING,
    liquidado: ShareStatus.SETTLED,
    parcial: ShareStatus.PARTIAL,
    enviado: ShareStatus.SENT,
    aceito: ShareStatus.ACCEPTED,
    recebido: ShareStatus.RECEIVED,
    recusado: ShareStatus.REFUSED,
    erro: ShareStatus.ERROR,
    cancelado: ShareStatus.CANCELLED,
  },
  direction: {
    a_receber: 'receivable',
    a_enviar: 'payable',
  },
  type: {
    compositor: 'composer',
    interprete: 'performer',
    produtor: 'producer',
    editora: 'publisher',
    gravadora: 'record_label',
    empresario: 'manager',
    outro: 'other',
  },
  party_role: {
    autor: 'author',
    compositor: 'composer',
    interprete: 'performer',
    produtor: 'producer',
    editora: 'publisher',
  },
};

export const SHARE_DIRECTIONS = ['receivable', 'payable'] as const;

/** Maps any legacy Portuguese value of the share vocabularies to its canonical value. */
export function canonicalizeShareValues<T extends object>(input: T): T {
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const [column, map] of Object.entries(SHARE_LEGACY_VALUES)) {
    const value = out[column];
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value)) out[column] = map[value];
  }
  return out as T;
}

/** Maps the deprecated keys of each history[] entry to their canonical names. */
export function canonicalizeShareHistory(history: unknown): unknown {
  if (!Array.isArray(history)) return history;
  return history.map((entry) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? applyDeprecatedFieldAliases(entry as Record<string, unknown>, SHARE_HISTORY_ENTRY_DEPRECATED_FIELDS)
      : entry,
  );
}
