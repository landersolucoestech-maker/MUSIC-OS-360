/**
 * share-legacy-fields.ts — CZ-037 deploy-skew compatibility for the share
 * contract.
 *
 * A web build released before CZ-036/CZ-037 sends the Portuguese field names
 * and values below; they are accepted as deprecated input and moved/mapped
 * here before persistence. Responses are canonical (English).
 *
 * `artista_project_id` was a mirror of `artist_id` (the web always wrote the
 * same value to both), so it folds into `artist_id`; the physical column
 * `legacy_artist_project_id` remains in the database without an entity
 * declaration until its approved drop.
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
  // Former English aliases of the registry-share columns (integrations/registry writers).
  holderName: 'holder_name',
  holderDoc: 'holder_document',
  workId: 'work_id',
  trackId: 'phonogram_id', // a Phonogram (shares.phonogram_id), not a ReleaseTrack/ProjectTrack
  role: 'party_role',
};

/** EN aliases whose explicit null clears the canonical column (pre-existing write behavior). */
export const SHARE_NULLABLE_ALIAS_KEYS: readonly string[] = ['holderName', 'holderDoc', 'workId', 'trackId', 'role'];

/**
 * Deprecated QUERY-string keys (list/stats filters) → canonical filter keys.
 * Applied by SharesService.baseQb before any filter is read, so an old web
 * build's filtered list is filtered, never silently returned unfiltered.
 */
export const SHARE_QUERY_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  workId: 'work_id',
  trackId: 'phonogram_id',
  role: 'party_role',
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
    entrada: 'receivable',
    saida: 'payable',
    a_pagar: 'payable',
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
    outro: 'other',
  },
};

export const SHARE_DIRECTIONS = ['receivable', 'payable'] as const;

/**
 * Closed value set of the FINANCIAL share discriminator `shares.share_type`.
 * `share_type` is optional: registry/integration writers omit it and the column
 * stays NULL (NULL = registry split, see share-eligibility.util.ts). There is no
 * DB default and no CHECK constraint; the set is enforced at the API (DTO) only.
 */
export const SHARE_TYPES = ['internal_release', 'external_receivable'] as const;

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
