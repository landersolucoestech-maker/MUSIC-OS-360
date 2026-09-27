/**
 * shared/integrations/contracts/auth.contract.ts
 *
 * Authentication contract — implementation: NestJS JWT.
 *
 * Any component that needs auth data must depend on IAuthProvider, never
 * directly on a third-party auth SDK.
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: "owner" | "admin" | "manager" | "viewer";
  tenantId: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  tenantId: string;
  expiresAt: string;
  token: string;
}

export interface AuthSignInParams {
  email: string;
  password: string;
}

export interface AuthSignUpParams {
  email: string;
  password: string;
  name: string;
  tenantId?: string;
}

export interface AuthInviteParams {
  email: string;
  role: AuthUser["role"];
  tenantId: string;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * IAuthProvider — contract every authentication provider must implement.
 *
 * Implementations:
 *   - MockAuthProvider  (standalone, already in use)
 *   - NestAuthProvider  (production, JWT via NestJS)
 */
export interface IAuthProvider {
  /** Active session, or null when not authenticated */
  readonly session: AuthSession | null;
  /** Active user, or null when not authenticated */
  readonly user: AuthUser | null;
  /** True while the session is being verified */
  readonly isLoading: boolean;

  signIn(params: AuthSignInParams): Promise<AuthSession>;
  signUp(params: AuthSignUpParams): Promise<AuthSession>;
  signOut(): Promise<void>;

  /** Invites a new user to the tenant */
  inviteUser(params: AuthInviteParams): Promise<void>;
  /** Revokes a user's access */
  revokeUser(userId: string): Promise<void>;

  /** Checks whether the active token is still valid */
  verifySession(): Promise<boolean>;
  /** Refreshes the access token */
  refreshSession(): Promise<AuthSession>;
}

// ─── Feature flags de auth ───────────────────────────────────────────────────

/**
 * Capabilities the auth provider may or may not support.
 * Used to gate the UI without coupling it to the concrete provider.
 */
export interface AuthProviderCapabilities {
  supportsSSO: boolean;
  supportsMFA: boolean;
  supportsPasswordReset: boolean;
  supportsInvites: boolean;
  supportsAuditLog: boolean;
}

export const SUPABASE_AUTH_CAPABILITIES: AuthProviderCapabilities = {
  supportsSSO: false,
  supportsMFA: false,
  supportsPasswordReset: true,
  supportsInvites: true,
  supportsAuditLog: true,
};

export const JWT_AUTH_CAPABILITIES: AuthProviderCapabilities = {
  supportsSSO: false,
  supportsMFA: false,
  supportsPasswordReset: true,
  supportsInvites: true,
  supportsAuditLog: true,
};

