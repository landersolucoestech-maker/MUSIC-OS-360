/**
 * shared/types/refs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * EntityRef — lightweight reference types for cross-domain relations.
 * Used in the *WithRelations fields of every module instead of
 * `{ id: string; campo?: string; [key: string]: unknown }`.
 *
 * Rule: EntityRef never has an index signature — only explicit fields.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lightweight reference to an Artist (used in relations of other modules).
 * Keys are the canonical artist wire keys (CZ-042). The contracts/releases API
 * embed it as `artist` with ONLY `{ id, stage_name }` (S1 — never the raw
 * artist row); the optional extra fields exist only on rows fetched from
 * /artists or on other modules' embeds.
 */
export interface ArtistRef {
  id: string;
  stage_name?: string | null;
  photo_url?: string | null;
  /** Decrypted contact — present only on rows read from /artists. */
  email?: string | null;
  phone?: string | null;
  music_genre?: string | null;
  status?: string | null;
}

/**
 * Lightweight reference to a Client (CZ-043 canonical English keys). The
 * contracts API embeds it as `client` with exactly `{ id, name }`.
 */
export interface ClientRef {
  id: string;
  name?: string | null;
}

/** Lightweight reference to a musical Work. */
export interface WorkRef {
  id: string;
  title: string;
  status?: string | null;
  genero?: string | null;
  isrc?: string | null;
}

/** Lightweight reference to a sound recording. */
export interface PhonogramRef {
  id: string;
  title?: string | null;
  isrc?: string | null;
  status?: string | null;
}

/** Lightweight reference to a Release. */
export interface ReleaseRef {
  id: string;
  title: string;
  type?: string | null;
  status?: string | null;
}

/** Lightweight reference to a Project. */
export interface ProjectRef {
  id: string;
  title: string;
  status?: string | null;
  type?: string | null;
}

/** Lightweight reference to a Contract. */
export interface ContractRef {
  id: string;
  title?: string | null;
  type?: string | null;
  status?: string | null;
}

/** Lightweight reference to an Employee. */
export interface EmployeeRef {
  id: string;
  nome: string;
  cargo?: string | null;
}

