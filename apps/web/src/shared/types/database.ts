/**
 * Base database types.
 *
 * Base types introduced for the standalone mode (MOCK_DATA in
 * localStorage). Each domain hook declares the concrete fields
 * in its own interface by intersecting with these aliases
 * (e.g. `Tables<"artistas"> & { stage_name?: string }`).
 *
 * `Tables<T>` is an empty base type (`object`) that, when intersected
 * with the hook-specific fields, results in exactly those fields
 * without leaking `unknown` into property access. This removes the need for
 * `any` and keeps type safety in the consuming components.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Tables<_T extends string = string> = object;
export type TablesInsert<_T extends string = string> = object;
export type TablesUpdate<_T extends string = string> = object;

/**
 * Base type for MOCK_DATA rows — used in the CRUD hook generics.
 * Provides the index signature needed internally without leaking it into
 * the domain types.
 */
export type MockRow = { [key: string]: unknown };
