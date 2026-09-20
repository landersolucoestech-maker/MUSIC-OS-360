import { BadRequestException } from '@nestjs/common';

/**
 * Resolução de aliases EN legados para os campos canônicos pt-BR de Contracts
 * (Fase 5 / C1). Puro: não loga, não conhece tenant/operação, não acessa
 * repository, não importa Swagger, não aplica defaults de negócio (ex.:
 * tipo='outro') — isso é responsabilidade do ContractsService.
 *
 * Regra de presença: `hasOwnProperty` decide presença; `undefined` é tratado
 * como ausente; `null` é tratado como fornecido (participa de conflito, mas
 * nunca vira erro de conteúdo para os campos opcionais — só título rejeita
 * null). A remoção de chaves `null` antes da persistência (para não alterar
 * a semântica atual de PATCH) é feita pelo chamador, não aqui.
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

// ── Helpers de presença/valor ────────────────────────────────────────────────

function isAbsent(input: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(input, key)) return true;
  return input[key] === undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converte para a representação canônica final (string) usada pela entity, ou 'invalid'. */
function parseCanonicalValue(v: unknown): string | 'invalid' {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'invalid';
  if (typeof v === 'string') {
    if (v.trim() === '') return 'invalid';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : 'invalid';
  }
  return 'invalid';
}

/** Só valida formato (getTime() finito) — nunca lança RangeError, nunca converte null em epoch. */
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

// ── Resolução genérica de par (campos opcionais: type, artist_id, datas, valor) ─

interface PairSpec {
  canonical: string;
  /**
   * Um ou mais aliases legados aceitos. Array usado quando um campo já teve
   * mais de um nome legado historicamente aceito simultaneamente (ex.:
   * data_inicio -> start_date manteve tanto o nome PT antigo quanto o alias
   * EN `startsAt` já existente — nenhum dos dois pode deixar de ser aceito
   * sem quebrar chamadores reais).
   */
  legacy: string | string[];
  invalidCode?: ContractAliasErrorCode;
  /** true se o valor não-null é aceitável; ausente = qualquer valor é aceito. */
  validate?: (v: unknown) => boolean;
  /** compara dois valores não-null já validados. */
  isEquivalent: (a: unknown, b: unknown) => boolean;
  /** mapeia um valor não-null já validado para a forma final persistida. */
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

// Normalização de nomenclatura (2026-09-05): a coluna física passou de
// data_inicio/data_fim para start_date/end_date. Ambos os aliases legados
// pré-existentes (o nome PT antigo e o alias EN `startsAt`/`expiresAt` já
// aceito antes da migração física) continuam aceitos — nenhum caller real
// pode deixar de ser reconhecido só porque o nome canônico mudou de novo.
const START_DATE_SPEC: PairSpec = {
  canonical: 'start_date',
  legacy: ['data_inicio', 'startsAt'],
  invalidCode: 'CONTRACT_DATE_INVALID',
  validate: (v) => parseStrictDate(v) !== 'invalid',
  isEquivalent: (a, b) => parseStrictDate(a) === parseStrictDate(b),
  transform: (v) => v, // persiste o valor original, não o ISO normalizado
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
  transform: (v) => parseCanonicalValue(v), // única responsabilidade de coerção do valor
};

// ── Título — obrigatoriedade tratada pelo chamador; aqui só conteúdo/conflito ──

function assertTitleContent(v: unknown, field: string): asserts v is string {
  if (v === null || typeof v !== 'string' || v.trim() === '') {
    throwInvalid('CONTRACT_TITLE_INVALID', 'title', field);
  }
}

/**
 * Após a normalização de nomenclatura (2026-09-05), a coluna física passou
 * de `titulo` para `title`. `titulo` agora é o alias legado PT aceito para
 * chamadores antigos — mesma estrutura de antes, papéis invertidos.
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

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Resolve os 7 aliases de escrita (create/update). Não valida obrigatoriedade
 * de título (isso é decisão de create-vs-update, portanto do service) — só
 * conteúdo/conflito quando um valor é efetivamente enviado.
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
 * Resolve exclusivamente os 2 aliases de consulta (type/tipo, artist_id/artistId).
 * Não conhece nem processa title/value/datas — impossível vazarem pela query.
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
