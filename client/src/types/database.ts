/**
 * Tipos genéricos de banco de dados.
 *
 * Substituem os tipos gerados pelo Supabase. Como o app agora opera
 * 100% com dados mockados em memória/localStorage (`MOCK_DATA`), não há
 * mais um schema concreto — usamos catch-alls para que os hooks legados
 * continuem compilando sem perder demais a forma das linhas.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Tables<_T extends string = string> = Record<string, unknown>;
export type TablesInsert<_T extends string = string> = Record<string, unknown>;
export type TablesUpdate<_T extends string = string> = Record<string, unknown>;
