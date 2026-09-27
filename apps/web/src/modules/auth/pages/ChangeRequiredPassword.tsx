/**
 * modules/auth/pages/ChangeRequiredPassword.tsx  (Part 74)
 *
 * MANDATORY first-login password change screen (must_change_password
 * in app_metadata — see MustChangePasswordGuard on the backend). Unlike
 * ResetPassword.tsx ("forgot my password" flow via magic link): here the
 * user is already authenticated (signed in with the temporary password), but the
 * backend blocks every other route until the change is completed.
 *
 * Calls AuthContext.changeRequiredPassword(), which in turn calls
 * POST /auth/change-required-password — an atomic backend operation
 * (really changes the password in Supabase Auth AND clears the flag in the same
 * call) — and then refreshes the session so the new JWT (without the flag)
 * reaches the app.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { describeAuthError } from "@/shared/lib/auth-error-messages";
const MIN_LENGTH = 12;

function clientSideViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < MIN_LENGTH) violations.push(`mínimo de ${MIN_LENGTH} caracteres`);
  if (!/[a-z]/.test(password)) violations.push("uma letra minúscula");
  if (!/[A-Z]/.test(password)) violations.push("uma letra maiúscula");
  if (!/[0-9]/.test(password)) violations.push("um número");
  if (!/[^A-Za-z0-9]/.test(password)) violations.push("um símbolo");
  return violations;
}

export default function ChangeRequiredPassword() {
  const { user, session, loading, changeRequiredPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!loading && !session) {
    return <Navigate to="/auth" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return; // prevents duplicate submission
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }
    const violations = clientSideViolations(newPassword);
    if (violations.length > 0) {
      setErrorMessage(`Senha fraca — faltam: ${violations.join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await changeRequiredPassword(newPassword, confirmPassword);
      if (error) {
        // Message already sanitized by the backend (never exposes internal detail) —
        // ver auth-password.service.ts / mapError() em api-client.ts.
        setErrorMessage(describeAuthError(error, "Não foi possível trocar a senha."));
        return;
      }
      toast.success("Senha atualizada. Redirecionando…");
      navigate("/onboarding", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <ShieldAlert className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold">Troca de senha obrigatória</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email ? `Conta: ${user.email}. ` : ""}
            Por segurança, defina uma nova senha antes de continuar. Requisitos: mínimo {MIN_LENGTH} caracteres,
            com maiúscula, minúscula, número e símbolo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="required-new-password">Nova senha</Label>
          <Input
            id="required-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="required-confirm-password">Confirmar nova senha</Label>
          <Input
            id="required-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
          />
        </div>

        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={saving || loading} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Trocar senha e continuar
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={saving} onClick={() => void signOut()}>
          Sair
        </Button>
      </form>
    </main>
  );
}
