import { BadRequestException } from '@nestjs/common';

/**
 * Resolution of legacy EN aliases to the canonical pt-BR Contracts fields
 * (Phase 5 / C1). Pure: does not log, knows nothing of tenant/operation, does not access
 * a repository, does not import Swagger, does not apply business defaults (e.g.
 * tipo='outro') — that is ContractsService's responsibility.
 *
 * Presence rule: `hasOwnProperty` decides presence; `undefined` is treated
 * as absent; `null` is treated as provided (it takes part in conflicts, but
 * never becomes a content error for optional fields — only the title rejects
 * null). Removing `null` keys before persistence (so the current PATCH
 * semantics do not change) is done by the caller, not here.
 */

export interface ContractFieldRef {
  canonical: string;
  legacy?: string;
}

export type ContractAliasErrorCode =
  | 'CONTRACT_ALIAS_CONFLICT'
  | 'CONTRACT_TITLE_INVALID'
  | 'CONTRACT_VALUE_INVALID'
  | 'CONTRACT_DATE_INVALID'
  | 'CONTRACT_UUID_INVALID';

export interface ContractAliasErrorBody {
  code: ContractAliasErrorCode;
  message: string;
  fields?: ContractFieldRef[];
}

export interface ResolvedContractWriteFields {
  title?: string;
  type?: string | null;
  artist_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  arquivo_url?: string | null;
  fixed_value?: string | null;
}

export interface ResolvedContractQueryFields {
  type?: string | null;
  artist_id?: string | null;
}

export interface ContractAliasResolution<T> {
  normalized: T;
  legacyAliasesUsed: string[];
}

// ── Presence/value helpers ───────────────────────────────────────────────────

function isAbsent(input: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(input, key)) return true;
  return input[key] === undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converts to the final canonical representation (string) used by the entity, or 'invalid'. */
function parseCanonicalValue(v: unknown): string | 'invalid' {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'invalid';
  if (typeof v === 'string') {
    if (v.trim() === '') return 'invalid';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : 'invalid';
  }
  return 'invalid';
}

/** Validates only the format (finite getTime()) — never throws RangeError, never converts null to epoch. */
function parseStrictDate(v: unknown): string | 'invalid' {
  if (typeof v !== 'string') return 'invalid';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'invalid' : d.toISOString();
}

function throwConflict(canonical: string, legacy: string): never {
  const body: ContractAliasErrorBody = {
    code: 'CONTRACT_ALIAS_CONFLICT',
    message: `Campos conflitantes: "${canonical}" e o alias legado "${legacy}".`,
    fields: [{ canonical, legacy }],
  };
  throw new BadRequestException(body);
}

function throwInvalid(code: ContractAliasErrorCode, canonical: string, field: string): never {
  const body: ContractAliasErrorBody = {
    code,
    message: `Campo "${field}" inválido.`,
    fields: [{ canonical, legacy: field !== canonical ? field : undefined }],
  };
  throw new BadRequestException(body);
}

// ── Generic pair resolution (optional fields: type, artist_id, dates, value) ─

interface PairSpec {
  canonical: string;
  /**
   * One or more accepted legacy aliases. An array is used when a field historically had
   * more than one legacy name accepted simultaneously (e.g.
   * data_inicio -> start_date kept both the old PT name and the already existing EN alias
   * `startsAt` — neither of them can stop being accepted
   * without breaking real callers).
   */
  legacy: string | string[];
  invalidCode?: ContractAliasErrorCode;
  /** true when the non-null value is acceptable; absent = any value is accepted. */
  validate?: (v: unknown) => boolean;
  /** compares two already validated non-null values. */
  isEquivalent: (a: unknown, b: unknown) => boolean;
  /** maps an already validated non-null value to the final persisted form. */
  transform: (v: unknown) => unknown;
}

function resolvePair(input: Record<string, unknown>, spec: PairSpec, legacyUsed: Set<string>): unknown {
  const legacyKeys = Array.isArray(spec.legacy) ? spec.legacy : [spec.legacy];
  const allKeys = [spec.canonical, ...legacyKeys];
  const present = allKeys.filter((k) => !isAbsent(input, k));

  if (present.length === 0) return undefined;

  if (present.length === 1) {
    const key = present[0];
    if (key !== spec.canonical) legacyUsed.add(key);
    const v = input[key];
    if (v === null) return null;
    if (spec.validate && !spec.validate(v)) throwInvalid(spec.invalidCode!, spec.canonical, key);
    return spec.transform(v);
  }

  // 2+ chaves presentes
  const values = present.map((k) => input[k]);
  const firstLegacyPresent = present.find((k) => k !== spec.canonical)!;

  if (values.every((v) => v === null)) {
    for (const k of present) if (k !== spec.canonical) legacyUsed.add(k);
    return null;
  }
  if (values.some((v) => v === null)) {
    throwConflict(spec.canonical, firstLegacyPresent);
  }

  if (spec.validate) {
    present.forEach((k, i) => {
      if (!spec.validate!(values[i])) throwInvalid(spec.invalidCode!, spec.canonical, k);
    });
  }

  if (values.every((v) => spec.isEquivalent(v, values[0]))) {
    for (const k of present) if (k !== spec.canonical) legacyUsed.add(k);
    const preferred = present.includes(spec.canonical) ? input[spec.canonical] : values[0];
    return spec.transform(preferred);
  }
  throwConflict(spec.canonical, firstLegacyPresent);
}

const TYPE_SPEC: PairSpec = {
  canonical: 'type',
  legacy: 'tipo',
  isEquivalent: (a, b) => a === b,
  transform: (v) => v,
};

const ARTIST_ID_SPEC: PairSpec = {
  canonical: 'artist_id',
  legacy: 'artistId',
  invalidCode: 'CONTRACT_UUID_INVALID',
  validate: (v) => typeof v === 'string' && UUID_RE.test(v),
  isEquivalent: (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase(),
  transform: (v) => v,
};

// Naming normalization (2026-09-05): the physical column changed from
// data_inicio/data_fim to start_date/end_date. Both pre-existing legacy aliases
// (the old PT name and the EN alias `startsAt`/`expiresAt` already
// accepted before the physical migration) remain accepted — no real caller
// may stop being recognized just because the canonical name changed again.
const START_DATE_SPEC: PairSpec = {
  canonical: 'start_date',
  legacy: ['data_inicio', 'startsAt'],
  invalidCode: 'CONTRACT_DATE_INVALID',
  validate: (v) => parseStrictDate(v) !== 'invalid',
  isEquivalent: (a, b) => parseStrictDate(a) === parseStrictDate(b),
  transform: (v) => v, // persists the original value, not the normalized ISO
};

const END_DATE_SPEC: PairSpec = {
  canonical: 'end_date',
  legacy: ['data_fim', 'expiresAt'],
  invalidCode: 'CONTRACT_DATE_INVALID',
  validate: (v) => parseStrictDate(v) !== 'invalid',
  isEquivalent: (a, b) => parseStrictDate(a) === parseStrictDate(b),
  transform: (v) => v,
};

const ARQUIVO_URL_SPEC: PairSpec = {
  canonical: 'arquivo_url',
  legacy: 'fileUrl',
  isEquivalent: (a, b) => a === b,
  transform: (v) => v,
};

const VALOR_SPEC: PairSpec = {
  canonical: 'fixed_value',
  // 'value' was the original English alias; 'valor' was this field's own
  // canonical name before naming-normalization (Cluster G) — both are kept
  // as accepted legacy aliases so no existing caller breaks.
  legacy: ['value', 'valor'],
  invalidCode: 'CONTRACT_VALUE_INVALID',
  validate: (v) => parseCanonicalValue(v) !== 'invalid',
  isEquivalent: (a, b) => parseCanonicalValue(a) === parseCanonicalValue(b),
  transform: (v) => parseCanonicalValue(v), // the only value-coercion responsibility
};

// ── Title — mandatory-ness handled by the caller; here only content/conflict ──

function assertTitleContent(v: unknown, field: string): asserts v is string {
  if (v === null || typeof v !== 'string' || v.trim() === '') {
    throwInvalid('CONTRACT_TITLE_INVALID', 'title', field);
  }
}

/**
 * After the naming normalization (2026-09-05), the physical column changed
 * from `titulo` to `title`. `titulo` is now the legacy PT alias accepted for
 * old callers — same structure as before, roles inverted.
 */
function resolveTitle(input: Record<string, unknown>, legacyUsed: Set<string>): string | undefined {
  const enAbsent = isAbsent(input, 'title');
  const ptAbsent = isAbsent(input, 'titulo');

  if (ptAbsent && enAbsent) return undefined;

  if (!enAbsent && ptAbsent) {
    const v = input['title'];
    assertTitleContent(v, 'title');
    return v;
  }

  if (enAbsent && !ptAbsent) {
    legacyUsed.add('titulo');
    const v = input['titulo'];
    assertTitleContent(v, 'titulo');
    return v;
  }

  const enV = input['title'];
  const ptV = input['titulo'];
  assertTitleContent(enV, 'title');
  assertTitleContent(ptV, 'titulo');
  legacyUsed.add('titulo');
  if (enV.trim() === ptV.trim()) return enV;
  throwConflict('title', 'titulo');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the 7 write aliases (create/update). Does not validate that the title is
 * mandatory (that is a create-vs-update decision, hence the service's) — only
 * content/conflict when a value is actually sent.
 */
export function resolveContractAliases(input: Record<string, unknown>): ContractAliasResolution<ResolvedContractWriteFields> {
  const legacyUsed = new Set<string>();
  const normalized: ResolvedContractWriteFields = {};

  const title = resolveTitle(input, legacyUsed);
  if (title !== undefined) normalized.title = title;

  const type = resolvePair(input, TYPE_SPEC, legacyUsed);
  if (type !== undefined) normalized.type = type as string | null;

  const artistId = resolvePair(input, ARTIST_ID_SPEC, legacyUsed);
  if (artistId !== undefined) normalized.artist_id = artistId as string | null;

  const startDate = resolvePair(input, START_DATE_SPEC, legacyUsed);
  if (startDate !== undefined) normalized.start_date = startDate as string | null;

  const endDate = resolvePair(input, END_DATE_SPEC, legacyUsed);
  if (endDate !== undefined) normalized.end_date = endDate as string | null;

  const arquivoUrl = resolvePair(input, ARQUIVO_URL_SPEC, legacyUsed);
  if (arquivoUrl !== undefined) normalized.arquivo_url = arquivoUrl as string | null;

  const valor = resolvePair(input, VALOR_SPEC, legacyUsed);
  if (valor !== undefined) normalized.fixed_value = valor as string | null;

  return { normalized, legacyAliasesUsed: Array.from(legacyUsed) };
}

/**
 * Resolves exclusively the 2 query aliases (type/tipo, artist_id/artistId).
 * Knows nothing of and does not process title/value/dates — they cannot leak through the query.
 */
export function resolveContractQueryAliases(input: Record<string, unknown>): ContractAliasResolution<ResolvedContractQueryFields> {
  const legacyUsed = new Set<string>();
  const normalized: ResolvedContractQueryFields = {};

  const type = resolvePair(input, TYPE_SPEC, legacyUsed);
  if (type !== undefined) normalized.type = type as string | null;

  const artistId = resolvePair(input, ARTIST_ID_SPEC, legacyUsed);
  if (artistId !== undefined) normalized.artist_id = artistId as string | null;

  return { normalized, legacyAliasesUsed: Array.from(legacyUsed) };
}
