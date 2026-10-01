/**
 * app/providers/AuthContext.tsx
 *
 * AuthContext — multi-mode bridge:
 *
 * Real authentication via Supabase (no mock mode).
 *   Real authentication via Supabase Auth.
 *   The SDK manages tokens, automatic refresh and session persistence.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthError, Session, User } from "@/shared/types/auth";
import {
  api,
  clearAuthBackoff,
  setAccessToken,
  setTenantId,
} from "@/shared/lib/api-client";
import { IS_DEV, AUTH_DISABLED, DEV_AUTH_BYPASS } from "@/shared/lib/env";
import { normalizeEmail } from "@/shared/lib/normalize-email";
import { getSupabaseClient } from "@/lib/supabase";
import { UserFacingError, toUserMessage } from "@/shared/lib/errors";

function devLog(label: string, data?: unknown): void {
  if (!IS_DEV) return;
  if (data !== undefined) {
    console.log(`[MUSIC OS 360 Auth] ${label}`, data);
  } else {
    console.log(`[MUSIC OS 360 Auth] ${label}`);
  }
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch { return {}; }
}

function logJwtClaims(token: string, event: string): void {
  if (!IS_DEV) return;
  const claims = decodeJwtClaims(token);
  const appMeta = claims["app_metadata"] as Record<string, unknown> | undefined;
  devLog(`${event} — JWT claims:`, {
    sub: claims["sub"],
    email: claims["email"],
    org_id: appMeta?.["org_id"] ?? claims["org_id"] ?? "(não encontrado — hook ativo?)",
    role: appMeta?.["role"] ?? claims["role"] ?? "(não encontrado)",
    exp: claims["exp"] ? new Date((claims["exp"] as number) * 1000).toISOString() : undefined,
  });
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  /**
   * Atomic change of the first-login mandatory password (Part 74):
   * calls POST /auth/change-required-password (the backend really changes the password
   * in Supabase Auth AND clears must_change_password in the same
   * operation), then forces refreshSession() so the new JWT (without the
   * flag) reaches the app — without it, the user would stay stuck on the
   * change screen even after the backend had already succeeded.
   */
  changeRequiredPassword: (newPassword: string, confirmPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The role comes ONLY from app_metadata (server-set: invite / workspace provisioning / access-token hook).
 * user_metadata is end-user-editable in Supabase, so its `role` is never trusted nor exposed (S1-1);
 * the API authorizes from org_members anyway, this keeps the UI gates honest.
 */
export function mapSupabaseUser(u: SupabaseUser, jwtAppMeta?: Record<string, unknown>): User {
  const meta = u.user_metadata as Record<string, unknown> | undefined;
  const app = u.app_metadata as Record<string, unknown> | undefined;
  const effectiveApp = { ...app, ...jwtAppMeta };
  return {
    id: u.id,
    email: u.email,
    role: effectiveApp?.["role"] as string | undefined,
    org_id: (effectiveApp?.["org_id"] ?? meta?.["org_id"]) as string | undefined,
    mustChangePassword: effectiveApp?.["must_change_password"] === true,
    user_metadata: { ...meta, ...effectiveApp, role: effectiveApp?.["role"] },
  };
}

function mapSupabaseSession(s: SupabaseSession): Session {
  const jwtClaims = decodeJwtClaims(s.access_token);
  const jwtAppMeta = jwtClaims["app_metadata"] as Record<string, unknown> | undefined;
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at ? s.expires_at * 1000 : undefined,
    user: mapSupabaseUser(s.user, jwtAppMeta),
  };
}

function applyApiSessionState(session: SupabaseSession): Session {
  const mapped = mapSupabaseSession(session);
  setAccessToken(session.access_token);
  setTenantId(mapped.user.org_id ?? null);
  return mapped;
}

function clearApiSessionState(): void {
  setAccessToken(null);
  setTenantId(null);
}

function needsWorkspaceProvisioning(session: SupabaseSession): boolean {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
  return !mapSupabaseSession(session).user.org_id
    && typeof metadata?.["workspace_slug"] === "string";
}

async function provisionWorkspaceForSession(
  session: SupabaseSession,
): Promise<SupabaseSession> {
  if (!needsWorkspaceProvisioning(session)) return session;
  const metadata = session.user.user_metadata as Record<string, unknown>;
  setAccessToken(session.access_token);
  setTenantId(null);
  clearAuthBackoff();
  await api.patch("/auth/provision-workspace", {
    organizationName: metadata["org_name"],
    workspaceName: metadata["workspace_name"],
    workspaceSlug: metadata["workspace_slug"],
    segment: metadata["segment"],
    tradeName: metadata["trade_name"],
    corporateEmail: metadata["corporate_email"],
    phone: metadata["phone"],
    address: metadata["address"],
    city: metadata["city"],
    state: metadata["state"],
    requestedPlan: metadata["requested_plan"],
    acceptedTerms: metadata["accepted_terms"],
    acceptedLgpd: metadata["accepted_lgpd"],
  });
  const { data, error } = await getSupabaseClient().auth.refreshSession();
  if (error || !data.session) {
    throw new UserFacingError(`Session refresh after workspace provisioning failed: ${error?.message ?? "no session returned"}`, "Não foi possível atualizar a sessão.");
  }
  return data.session;
}

let activeProvisioning: Promise<SupabaseSession> | null = null;

function ensureWorkspaceProvisioned(
  session: SupabaseSession,
): Promise<SupabaseSession> {
  if (!needsWorkspaceProvisioning(session)) return Promise.resolve(session);
  if (!activeProvisioning) {
    activeProvisioning = provisionWorkspaceForSession(session)
      .finally(() => { activeProvisioning = null; });
  }
  return activeProvisioning;
}

// Mirrors, for display only, the tenant-zero synthetic owner (LANDER
// RECORDS) that the backend already uses under AUTH_DISABLED — the source of truth is
// apps/api/src/database/tenant-zero.constants.ts
// (TENANT_ZERO_SYNTHETIC_OWNER_*), frozen and covered by a snapshot there.
// Never calls Supabase Auth: under AUTH_DISABLED the backend validates no
// token at all, so there is no real session to fetch.
const AUTH_DISABLED_USER: User = {
  id: "c600dbbd-84ea-5910-8655-eb94389bb224",
  email: "owner@lander-records.example.com",
  role: "owner",
  org_id: "724f035f-3034-5ea3-9b53-0785b558d4ec",
  mustChangePassword: false,
  user_metadata: { full_name: "LANDER RECORDS (Owner Sintético — DEV/STAGING)", role: "owner" },
};

// DEV ONLY (VITE_DISABLE_AUTH=true) — central synthetic user to browse the
// UI without login. Deliberately distinct from AUTH_DISABLED_USER above: this one does NOT
// mirror any real backend data (the backend has, and needs, no
// corresponding bypass under this flag) — clearly synthetic IDs so they are
// never mistaken for a real tenant/user.
const DEV_BYPASS_USER: User = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "dev-bypass@local.dev",
  role: "super_admin",
  org_id: "00000000-0000-4000-8000-000000000002",
  mustChangePassword: false,
  user_metadata: { full_name: "DEV BYPASS USER (VITE_DISABLE_AUTH — DEV ONLY)", role: "super_admin" },
};

const AUTH_BYPASS_ACTIVE = AUTH_DISABLED || DEV_AUTH_BYPASS;

function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(
    AUTH_DISABLED ? AUTH_DISABLED_USER : DEV_AUTH_BYPASS ? DEV_BYPASS_USER : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!AUTH_BYPASS_ACTIVE);
  const initDone = useRef(false);

  useEffect(() => {
    if (AUTH_BYPASS_ACTIVE) return;
    if (initDone.current) return;
    initDone.current = true;

    const sb = getSupabaseClient();

    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const readySession = await ensureWorkspaceProvisioned(data.session);
        const s = applyApiSessionState(readySession);
        setSession(s);
        setUser(s.user);
      } else {
        clearApiSessionState();
      }
      setLoading(false);
    }).catch((error: unknown) => {
      clearApiSessionState();
      devLog("Falha no bootstrap da sessão", error);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, sbSession) => {
      if (sbSession) {
        if (needsWorkspaceProvisioning(sbSession)) {
          setLoading(true);
          window.setTimeout(() => {
            void ensureWorkspaceProvisioned(sbSession)
              .then((readySession) => {
                const ready = applyApiSessionState(readySession);
                setSession(ready);
                setUser(ready.user);
                setLoading(false);
              })
              .catch((error: unknown) => {
                devLog("Falha ao provisionar workspace", error);
                setLoading(false);
              });
          }, 0);
          return;
        }
        const s = applyApiSessionState(sbSession);
        setSession(s);
        setUser(s.user);

        logJwtClaims(sbSession.access_token, event);
        devLog(`Tenant resolvido: ${s.user.org_id ?? "(sem org — hook ativo?)"}`);
        devLog(`Role resolvida: ${s.user.role ?? "(sem role)"}`);

        if (event === "TOKEN_REFRESHED") {
          window.dispatchEvent(new CustomEvent("musicos360:auth:tokenRefreshed", {
            detail: { access_token: sbSession.access_token },
          }));
          devLog("TOKEN_REFRESHED — evento musicos360:auth:tokenRefreshed despachado");
        }
      } else {
        setSession(null);
        setUser(null);
        clearApiSessionState();
        devLog(`Sessão encerrada (${event})`);
      }
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) {
      return { error: { message: error.message, status: error.status } };
    }
    if (data.session) {
      const readySession = await ensureWorkspaceProvisioned(data.session);
      const mapped = applyApiSessionState(readySession);
      setSession(mapped);
      setUser(mapped.user);
    }
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ error: AuthError | null }> => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await getSupabaseClient().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName ?? "",
          org_name: fullName?.trim() || normalizedEmail.split("@")[0],
          ...metadata,
        },
      },
    });
    if (error) return { error: { message: error.message, status: error.status } };
    if (data.session) {
      const readySession = await ensureWorkspaceProvisioned(data.session);
      const mapped = applyApiSessionState(readySession);
      setSession(mapped);
      setUser(mapped.user);
    }
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    await getSupabaseClient().auth.signOut();
    clearApiSessionState();
    setUser(null);
    setSession(null);
    queryClient.clear();
  };

  const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
    if (error) return { error: { message: error.message, status: error.status } };
    return { error: null };
  };

  const updatePassword = async (password: string): Promise<{ error: AuthError | null }> => {
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    if (error) return { error: { message: error.message, status: error.status } };
    return { error: null };
  };

  const changeRequiredPassword = async (
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ error: AuthError | null }> => {
    try {
      await api.post("/auth/change-required-password", { newPassword, confirmPassword });
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : "Required password change request failed",
          userMessage: toUserMessage(error, "Não foi possível trocar a senha."),
        },
      };
    }

    // The backend already confirmed the physical change + clearing of must_change_password
    // (an atomic operation — see auth-password.service.ts). It is the JWT the
    // frontend still holds in memory that is outdated: refreshSession()
    // fetches a new access_token already without the flag, firing TOKEN_REFRESHED
    // via onAuthStateChange (above), which updates session/user automatically.
    const { data, error: refreshError } = await getSupabaseClient().auth.refreshSession();
    if (refreshError || !data.session) {
      return {
        error: {
          message: refreshError?.message ?? "Session refresh returned no session after the password change",
          userMessage: "Senha trocada, mas não foi possível renovar a sessão. Faça login novamente.",
        },
      };
    }
    const mapped = applyApiSessionState(data.session);
    setSession(mapped);
    setUser(mapped.user);

    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword, changeRequiredPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

