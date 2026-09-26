import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { toUserMessage } from "@/shared/lib/errors";
import { describeAuthError } from "@/shared/lib/auth-error-messages";
export default function ResetPassword() {
  const { session, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!loading && !session && !completed) {
    return <Navigate to="/forgot-password" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(describeAuthError(error, "Não foi possível atualizar a senha. Tente novamente."));
        return;
      }
      setCompleted(true);
      toast.success("Senha atualizada com sucesso.");
    } catch (error) {
      toast.error(toUserMessage(error, "Não foi possível atualizar a senha. Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <LockKeyhole className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">
            {completed ? "Sua senha foi alterada." : "Escolha uma senha forte para continuar."}
          </p>
        </div>
        {completed ? (
          <Button asChild className="w-full"><Link to="/login">Voltar ao login</Link></Button>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input id="confirm-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving || loading} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar senha
            </Button>
          </>
        )}
      </form>
    </main>
  );
}
