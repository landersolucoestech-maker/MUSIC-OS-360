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
  useResendStatus,
  useResendSaveCredentials,
  useResendDeleteCredentials,
} from "@/hooks/useResend";

interface ResendConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResendConfigDialog({
  open,
  onOpenChange,
}: ResendConfigDialogProps) {
  const { data: status, isLoading } = useResendStatus();
  const saveMutation = useResendSaveCredentials();
  const deleteMutation = useResendDeleteCredentials();

  const [apiKey, setApiKey] = useState("");
  const [fromAddress, setFromAddress] = useState("");

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setFromAddress(status?.from_address ?? "");
  }, [open, status?.from_address]);

  const canSave =
    (apiKey.trim().length > 0 || Boolean(status?.has_api_key)) &&
    (apiKey.trim().length > 0 ||
      (fromAddress.trim() !== (status?.from_address ?? "")));

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      api_key: apiKey.trim(),
      from_address: fromAddress.trim() || undefined,
    });
    setApiKey("");
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    setApiKey("");
    setFromAddress("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-resend-config">
        <DialogHeader>
          <DialogTitle>Integração Resend</DialogTitle>
          <DialogDescription>
            Configure a conta do Resend para enviar e-mails transacionais
            (notificações, resets, convites) a partir do seu próprio domínio.
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
                data-testid="resend-connected-status"
              >
                Conectado.
                {status.last_sync_at && (
                  <span className="block text-xs text-muted-foreground">
                    Último envio:{" "}
                    {new Date(status.last_sync_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            )}

            {status?.status === "error" && status?.last_error && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                data-testid="resend-error-status"
              >
                Erro na última conexão: {status.last_error}
              </div>
            )}

            {!status?.connected && status?.has_global_fallback && (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400"
                data-testid="resend-fallback-hint"
              >
                Esta organização ainda usa a chave global compartilhada
                (RESEND_API_KEY). Configure credenciais próprias para
                personalizar o domínio remetente.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="resend-api-key">API Key</Label>
              <Input
                id="resend-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  status?.has_api_key
                    ? "••••••• (digite para atualizar)"
                    : "re_..."
                }
                autoComplete="off"
                data-testid="input-resend-api-key"
              />
              <p className="text-xs text-muted-foreground">
                Crie em <span className="font-medium">resend.com → API Keys</span>.
                Permissão recomendada: <em>Sending access</em>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resend-from">Remetente padrão (opcional)</Label>
              <Input
                id="resend-from"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="Lander360 <noreply@seudominio.com>"
                autoComplete="off"
                data-testid="input-resend-from"
              />
              <p className="text-xs text-muted-foreground">
                Use o domínio que você verificou no Resend. Se vazio, será
                usado o remetente global.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {status?.has_api_key ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-resend-disconnect"
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
              data-testid="button-resend-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !canSave}
              data-testid="button-resend-save"
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
