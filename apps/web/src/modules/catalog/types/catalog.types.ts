import type { Json } from "@/shared/types/database";
import type { ArtistaRef, ProjetoRef } from "@/shared/types/refs";
import type { WorkStatusValue, WorkType, PhonogramStatusValue } from "@/shared/types/enums";

export type { WorkStatusValue, WorkType, PhonogramStatusValue };

export interface Obra {
  id: string;
  user_id?: string;
  title: string;
  compositor?: string | null;
  compositores?: string | string[] | null;
  letristas?: string | string[] | null;
  editora?: string | null;
  isrc?: string | null;
  iswc?: string | null;
  cod_ecad?: string | null;
  // Renomeado de `cod_abramus` (20260718000017) — código em qualquer entidade
  // de gestão coletiva (ABRAMUS, UBC, SOCINPRO, ...), não só ABRAMUS.
  cod_entidade?: string | null;
  type?: WorkType | string | null;
  genero?: string | null;
  status?: WorkStatusValue | string | null;
  duracao?: string | null;
  origem_externa?: string | null;
  origem_externa_id?: string | null;
  origem_externa_sincronizado_em?: string | null;
  project_id?: string | null;
  artist_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ObraInsert = Omit<Obra, "id" | "user_id" | "created_at" | "updated_at">;
export type ObraUpdate = Partial<ObraInsert>;

export interface ObraWithRelations extends Obra {
  artistas?: ArtistaRef | null;
  projetos?: ProjetoRef | null;
}

export interface Fonograma {
  id: string;
  user_id?: string;
  title?: string | null;
  work_id?: string | null;
  artist_id?: string | null;
  isrc?: string | null;
  duracao?: string | null;
  type?: string | null;
  status?: PhonogramStatusValue | string | null;
  compositores?: string | null;
  interpretes?: string | null;
  produtores?: string | null;
  gravadora?: string | null;
  agregadora?: string | null;
  cod_ecad?: string | null;
  // Renomeado de `cod_abramus` (20260718000017) — código em qualquer entidade
  // de gestão coletiva (ABRAMUS, UBC, SOCINPRO, ...), não só ABRAMUS.
  cod_entidade?: string | null;
  isrc_pais?: string | null;
  isrc_registrante?: string | null;
  isrc_ano?: string | null;
  isrc_designacao?: string | null;
  criada_por_ia?: boolean | null;
  emissao?: string | null;
  gravacao_original?: string | null;
  data_lancamento?: string | null;
  data_registro?: string | null;
  duracao_min?: string | number | null;
  duracao_seg?: string | number | null;
  instrumental?: boolean | null;
  genero_musical?: string | null;
  classificacao?: string | null;
  midia?: string | null;
  nacional?: boolean | null;
  pub_simultanea?: boolean | null;
  pais_origem?: string | null;
  pais_publicacao?: string | null;
  observacoes?: string | null;
  arquivo_audio?: Json | null;
  participacao?: unknown;
  origem_externa?: string | null;
  origem_externa_id?: string | null;
  origem_externa_sincronizado_em?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type FonogramaInsert = Omit<Fonograma, "id" | "user_id" | "created_at" | "updated_at">;
export type FonogramaUpdate = Partial<FonogramaInsert>;

export interface FonogramaWithRelations extends Fonograma {
  artistas?: ArtistaRef | null;
}

