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

/** Lightweight reference to an Artist (used in relations of other modules). */
export interface ArtistaRef {
  id: string;
  nome_artistico?: string | null;
  foto_url?: string | null;
  music_genre?: string | null;
  status?: string | null;
}

/** Lightweight reference to a Client / Contact. */
export interface ClienteRef {
  id: string;
  nome?: string | null;
  email?: string | null;
  empresa?: string | null;
}

/** Lightweight reference to a musical Work. */
export interface ObraRef {
  id: string;
  title: string;
  status?: string | null;
  genero?: string | null;
  isrc?: string | null;
}

/** Lightweight reference to a sound recording. */
export interface FonogramaRef {
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
export interface ProjetoRef {
  id: string;
  title: string;
  status?: string | null;
  type?: string | null;
}

/** Lightweight reference to a Contract. */
export interface ContratoRef {
  id: string;
  title?: string | null;
  type?: string | null;
  status?: string | null;
}

/** Lightweight reference to an Employee. */
export interface FuncionarioRef {
  id: string;
  nome: string;
  cargo?: string | null;
}

