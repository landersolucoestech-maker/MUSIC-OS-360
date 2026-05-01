import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import {
  useAutentiqueStatus,
  useAutentiqueSaveCredentials,
  useAutentiqueDeleteCredentials,
} from "@/hooks/useAutentique";

interface AutentiqueConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutentiqueConfigDialog({
  open,
  onOpenChange,
}: AutentiqueConfigDialogProps) {
  const { data: status, isLoading } = useAutentiqueStatus();
  const saveMutation = useAutentiqueSaveCredentials();
  const deleteMutation = useAutentiqueDeleteCredentials();

  const [token, setToken] = useState("");

  useEffect(() => {
    if (!open) return;
    setToken("");
  }, [open]);

  const handleSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    await saveMutation.mutateAsync({ token: trimmed });
    setToken("");
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    setToken("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-autentique-config">
        <DialogHeader>
          <DialogTitle>Integração Autentique</DialogTitle>
          <DialogDescription>
            Conecte sua conta do Autentique para enviar e acompanhar
            contratos com assinatura digital direto do Lander360.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando status…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {status?.connected && (
              <div
                className="rounded-md border border-green-500/40 bg-green-500/5 p-3 text-sm"
                data-testid="autentique-connected-status"
              >
                Conectado.
                {status.last_sync_at && (
                  <span className="block text-xs text-muted-foreground">
                    Última atividade:{" "}
                    {new Date(status.last_sync_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            )}

            {status?.status === "error" && status?.last_error && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                data-testid="autentique-error-status"
              >
                Erro na última conexão: {status.last_error}
              </div>
            )}

            {!status?.connected && status?.has_global_fallback && (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400"
                data-testid="autentique-fallback-hint"
              >
                Esta organização ainda usa o token global compartilhado
                (AUTENTIQUE_TOKEN). Configure um token próprio para que os
                contratos saiam da sua conta do Autentique.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="autentique-token">API Token</Label>
              <Input
                id="autentique-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  status?.has_token
                    ? "••••••• (digite para atualizar)"
                    : "Cole o token gerado no painel"
                }
                autoComplete="off"
                data-testid="input-autentique-token"
              />
              <p className="text-xs text-muted-foreground">
                Em <span className="font-medium">Autentique → Integrações → API</span>{" "}
                gere um token de acesso e cole aqui.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {status?.has_token ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-autentique-disconnect"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-autentique-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || token.trim().length === 0}
              data-testid="button-autentique-save"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Salvar e conectar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
