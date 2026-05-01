/**
 * Tipos mínimos de autenticação usados pelo app.
 *
 * Antes vinham do `@supabase/supabase-js`. Como o app agora opera 100%
 * em modo mock (sem backend), só precisamos da forma esperada pelo
 * código legado: id/email no usuário, access_token na sessão e
 * `message` no erro.
 */

export interface User {
  id: string;
  email?: string;
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
  message: string;
  status?: number;
}
