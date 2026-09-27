/**
 * Minimal authentication types used by the app.
 *
 * We keep only the contract expected by the existing code:
 * id/email on the user, access_token on the session and `message` on the error.
 * Authentication is managed exclusively by the NestJS backend via JWT.
 *
 * ARCHITECTURE: AppRole is derived from AnyRole (SystemRole | FunctionalRole)
 * from @music-os-360/types — single source of truth for every role.
 */

import type { SystemRole, FunctionalRole } from '@music-os-360/types';

/**
 * AppRole — union of every role recognized by the MUSIC OS 360 system.
 * Derived from SystemRole | FunctionalRole via template literal types.
 * Backward compatible: the string values are identical to the previous ones.
 */
export type AppRole = `${SystemRole}` | `${FunctionalRole}`;

export interface User {
  id: string;
  email?: string;
  role?: AppRole | string;
  org_id?: string;
  /** app_metadata.must_change_password from the JWT — pending mandatory password change (Part 74). */
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
