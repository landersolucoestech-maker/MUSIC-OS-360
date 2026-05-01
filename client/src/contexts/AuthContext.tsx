import React, { createContext, useContext, useState } from "react";
import type { AuthError, Session, User } from "@/types/auth";
import { MOCK_USER, MOCK_SESSION } from "@/data/mockData";

/**
 * Modo standalone: o app roda sem backend, autenticação real foi
 * removida. O usuário "mock" está sempre logado e os métodos de
 * sign in/out/reset são no-ops que devolvem `{ error: null }` para
 * que as telas legadas continuem funcionando.
 */

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_USER as User);
  const [session, setSession] = useState<Session | null>(MOCK_SESSION as Session);

  const signIn = async (_email: string, _password: string) => {
    setUser(MOCK_USER as User);
    setSession(MOCK_SESSION as Session);
    return { error: null };
  };

  const signUp = async (_email: string, _password: string, _fullName?: string) => {
    setUser(MOCK_USER as User);
    setSession(MOCK_SESSION as Session);
    return { error: null };
  };

  const signOut = async () => {
    // Em modo standalone mantemos o usuário mock — não há sessão real
    // para encerrar. Mantido apenas para compatibilidade com a UI.
  };

  const resetPassword = async (_email: string) => {
    return { error: null };
  };

  const updatePassword = async (_password: string) => {
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading: false,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
