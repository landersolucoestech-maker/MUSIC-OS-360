import { BadRequestException } from '@nestjs/common';

/**
 * Resolution of legacy EN aliases to the canonical pt-BR Phonograms fields
 * (C2): title/titulo, work_id/workId, artist_id/artistId. Pure: does not log,
 * knows nothing of tenant/operation, does not access a repository, does not import Swagger,
 * does not apply business defaults (e.g. type='master') — that is
 * PhonogramsService's responsibility.
 *
 * Presence rule: `hasOwnProperty` decides presence; `undefined` is treated
 * as absent; `null` is treated as provided (it takes part in conflicts, but
 * never becomes a content error for optional fields — only the title rejects
 * null). Removing `null` keys before persistence (so the current PATCH
 * semantics do not change) is done by the caller, not here.
 */

export interface PhonogramFieldRef {
  canonical: string;
  legacy?: string;
}

export type PhonogramAliasErrorCode =
  | 'PHONOGRAM_ALIAS_CONFLICT'
  | 'PHONOGRAM_TITLE_INVALID'
  | 'PHONOGRAM_UUID_INVALID';

export interface PhonogramAliasErrorBody {
  code: PhonogramAliasErrorCode;
  message: string;
  fields?: PhonogramFieldRef[];
}

export interface ResolvedPhonogramWriteFields {
  title?: string;
  work_id?: string | null;
  artist_id?: string | null;
}

export interface ResolvedPhonogramQueryFields {
  work_id?: string;
  artist_id?: string;
}

export interface PhonogramAliasResolution<T> {
  normalized: T;
  legacyAliasesUsed: string[];
}

// ── Presence/value helpers ───────────────────────────────────────────────────

function isAbsent(input: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(input, key)) return true;
  return input[key] === undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function throwConflict(canonical: string, legacy: string): never {
  const body: PhonogramAliasErrorBody = {
    code: 'PHONOGRAM_ALIAS_CONFLICT',
    message: 'Campos conflitantes.',
    fields: [{ canonical, legacy }],
  };
  throw new BadRequestException(body);
}

function throwInvalidUuid(canonical: string, field: string): never {
  const body: PhonogramAliasErrorBody = {
    code: 'PHONOGRAM_UUID_INVALID',
    message: 'Registro vinculado inválido. Selecione um registro existente.',
    fields: [{ canonical, legacy: field !== canonical ? field : undefined }],
  };
  throw new BadRequestException(body);
}

function throwInvalidTitle(field: string): never {
  const body: PhonogramAliasErrorBody = {
    code: 'PHONOGRAM_TITLE_INVALID',
    message: 'title inválido.',
    fields: [{ canonical: 'title', legacy: field !== 'title' ? field : undefined }],
  };
  throw new BadRequestException(body);
}

// ── Generic UUID pair (work_id/workId, artist_id/artistId) ────────────────────

interface UuidPairSpec {
  canonical: string;
  legacy: string;
}

function resolveUuidPair(
  input: Record<string, unknown>,
  spec: UuidPairSpec,
  legacyUsed: Set<string>,
): string | null | undefined {
  const ptAbsent = isAbsent(input, spec.canonical);
  const enAbsent = isAbsent(input, spec.legacy);

  if (ptAbsent && enAbsent) return undefined;

  if (!ptAbsent && enAbsent) {
    const v = input[spec.canonical];
    if (v === null) return null;
    if (typeof v !== 'string' || !UUID_RE.test(v)) throwInvalidUuid(spec.canonical, spec.canonical);
    return v;
  }

  if (ptAbsent && !enAbsent) {
    legacyUsed.add(spec.legacy);
    const v = input[spec.legacy];
    if (v === null) return null;
    if (typeof v !== 'string' || !UUID_RE.test(v)) throwInvalidUuid(spec.canonical, spec.legacy);
    return v;
  }

  // both present
  const ptV = input[spec.canonical];
  const enV = input[spec.legacy];

  if (ptV === null && enV === null) {
    legacyUsed.add(spec.legacy);
    return null;
  }
  if (ptV === null || enV === null) {
    throwConflict(spec.canonical, spec.legacy);
  }

  if (typeof ptV !== 'string' || !UUID_RE.test(ptV)) throwInvalidUuid(spec.canonical, spec.canonical);
  if (typeof enV !== 'string' || !UUID_RE.test(enV)) throwInvalidUuid(spec.canonical, spec.legacy);

  if (ptV.toLowerCase() === enV.toLowerCase()) {
    legacyUsed.add(spec.legacy);
    return ptV; // persists the original value (casing of the canonical side)
  }
  throwConflict(spec.canonical, spec.legacy);
}

const WORK_ID_SPEC: UuidPairSpec = { canonical: 'work_id', legacy: 'workId' };
const ARTIST_ID_SPEC: UuidPairSpec = { canonical: 'artist_id', legacy: 'artistId' };

// ── Title — mandatory-ness handled by the caller; here only content/conflict ─

function assertTitleContent(v: unknown, field: string): asserts v is string {
  if (v === null || typeof v !== 'string' || v.trim() === '') {
    throwInvalidTitle(field);
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
  if (enV.trim() === ptV.trim()) return enV; // persists the original value of the EN side, without trim
  throwConflict('title', 'titulo');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the 3 write aliases (create/update). Does not validate that the title is
 * mandatory (that is a create-vs-update decision, hence the service's) — only
 * content/conflict when a value is actually sent.
 */
export function resolvePhonogramAliases(
  input: Record<string, unknown>,
): PhonogramAliasResolution<ResolvedPhonogramWriteFields> {
  const legacyUsed = new Set<string>();
  const normalized: ResolvedPhonogramWriteFields = {};

  const title = resolveTitle(input, legacyUsed);
  if (title !== undefined) normalized.title = title;

  const workId = resolveUuidPair(input, WORK_ID_SPEC, legacyUsed);
  if (workId !== undefined) normalized.work_id = workId;

  const artistId = resolveUuidPair(input, ARTIST_ID_SPEC, legacyUsed);
  if (artistId !== undefined) normalized.artist_id = artistId;

  return { normalized, legacyAliasesUsed: Array.from(legacyUsed) };
}

/**
 * Resolves exclusively the 2 query aliases (work_id/workId,
 * artist_id/artistId). Knows nothing of and does not process titulo/title — they cannot
 * leak through the query.
 */
export function resolvePhonogramQueryAliases(
  input: Record<string, unknown>,
): PhonogramAliasResolution<ResolvedPhonogramQueryFields> {
  const legacyUsed = new Set<string>();
  const normalized: ResolvedPhonogramQueryFields = {};

  const workId = resolveUuidPair(input, WORK_ID_SPEC, legacyUsed);
  if (workId !== undefined && workId !== null) normalized.work_id = workId;

  const artistId = resolveUuidPair(input, ARTIST_ID_SPEC, legacyUsed);
  if (artistId !== undefined && artistId !== null) normalized.artist_id = artistId;

  return { normalized, legacyAliasesUsed: Array.from(legacyUsed) };
}
