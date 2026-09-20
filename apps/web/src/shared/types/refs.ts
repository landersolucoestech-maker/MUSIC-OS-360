/**
 * shared/types/refs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * EntityRef — tipos de referência leve para relações cross-domain.
 * Usados nos campos *WithRelations de todos os módulos em vez de
 * `{ id: string; campo?: string; [key: string]: unknown }`.
 *
 * Regra: EntityRef nunca tem index signature — só campos explícitos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Referência leve a um Artista (usada em relações de outros módulos). */
export interface ArtistaRef {
  id: string;
  nome_artistico?: string | null;
  foto_url?: string | null;
  music_genre?: string | null;
  status?: string | null;
}

/** Referência leve a um Cliente / Contact. */
export interface ClienteRef {
  id: string;
  nome?: string | null;
  email?: string | null;
  empresa?: string | null;
}

/** Referência leve a uma Obra musical. */
export interface ObraRef {
  id: string;
  title: string;
  status?: string | null;
  genero?: string | null;
  isrc?: string | null;
}

/** Referência leve a um Fonograma. */
export interface FonogramaRef {
  id: string;
  title?: string | null;
  isrc?: string | null;
  status?: string | null;
}

/** Referência leve a um Lançamento. */
export interface LancamentoRef {
  id: string;
  title: string;
  type?: string | null;
  status?: string | null;
}

/** Referência leve a um Projeto. */
export interface ProjetoRef {
  id: string;
  title: string;
  status?: string | null;
  type?: string | null;
}

/** Referência leve a um Contrato. */
export interface ContratoRef {
  id: string;
  title?: string | null;
  type?: string | null;
  status?: string | null;
}

/** Referência leve a um Funcionário. */
export interface FuncionarioRef {
  id: string;
  nome: string;
  cargo?: string | null;
}

