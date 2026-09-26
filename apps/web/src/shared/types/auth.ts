/**
 * Tipos mínimos de autenticação usados pelo app.
 *
 * Mantemos apenas o contrato esperado pelo código existente:
 * id/email no usuário, access_token na sessão e `message` no erro.
 * A autenticação é gerida exclusivamente pelo backend NestJS via JWT.
 *
 * ARQUITECTURA: AppRole é derivado de AnyRole (SystemRole | FunctionalRole)
 * de @music-os-360/types — fonte única de verdade para todos os roles.
 */

import type { SystemRole, FunctionalRole } from '@music-os-360/types';

/**
 * AppRole — union de todos os roles reconhecidos pelo sistema MUSIC OS 360.
 * Derivado de SystemRole | FunctionalRole via template literal types.
 * Retrocompatível: os valores string são idênticos aos anteriores.
 */
export type AppRole = `${SystemRole}` | `${FunctionalRole}`;

export interface User {
  id: string;
  email?: string;
  role?: AppRole | string;
  org_id?: string;
  /** app_metadata.must_change_password do JWT — troca de senha obrigatória pendente (Parte 74). */
  mustChangePassword?: boolean;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: User;
  [key: string]: unknown;
}

export interface AuthError {
  /** Internal diagnostic (raw Supabase/API text). Never rendered directly. */
  message: string;
  status?: number;
  /** End-user copy (PT-BR) when the producer wrote one (e.g. API errors). */
  userMessage?: string;
}
