/**
 * modules/auth/pages/ChangeRequiredPassword.tsx  (Parte 74)
 *
 * Tela de troca OBRIGATÓRIA de senha do primeiro login (must_change_password
 * no app_metadata — ver MustChangePasswordGuard no backend). Diferente de
 * ResetPassword.tsx (fluxo de "esqueci minha senha" via magic link): aqui o
 * usuário já está autenticado (entrou com a senha provisória), mas o
 * backend bloqueia qualquer outra rota até a troca ser concluída.
 *
 * Chama AuthContext.changeRequiredPassword(), que por sua vez chama
 * POST /auth/change-required-password — uma operação atômica no backend
 * (troca a senha de verdade no Supabase Auth E limpa a flag na mesma
 * chamada) — e depois renova a sessão para que o novo JWT (sem a flag)
 * chegue ao app.
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
    if (saving) return; // evita envio duplicado
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
        // Mensagem já sanitizada pelo backend (nunca expõe detalhe interno) —
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
