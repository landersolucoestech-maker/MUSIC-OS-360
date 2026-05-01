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
import { Loader2, Trash2, Activity } from "lucide-react";
import {
  useMetaAdsStatus,
  useMetaAdsSaveCredentials,
  useMetaAdsDeleteCredentials,
  useMetaAdsTestConnection,
} from "@/hooks/useMetaAds";

interface MetaAdsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetaAdsConfigDialog({
  open,
  onOpenChange,
}: MetaAdsConfigDialogProps) {
  const { data: status, isLoading } = useMetaAdsStatus();
  const saveMutation = useMetaAdsSaveCredentials();
  const deleteMutation = useMetaAdsDeleteCredentials();
  const testMutation = useMetaAdsTestConnection();

  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccessToken("");
    setAdAccountId(status?.ad_account_id ?? "");
  }, [open, status?.ad_account_id]);

  const handleSave = async () => {
    const trimmedToken = accessToken.trim();
    const trimmedAccount = adAccountId.trim();
    // Permite atualizar só o ad_account_id quando já existe um token salvo —
    // assim o admin não precisa colar o access_token de novo só para trocar
    // a conta de anúncios. Se não tem token salvo, exige um novo.
    if (!trimmedToken && !status?.has_token) return;
    await saveMutation.mutateAsync({
      access_token: trimmedToken,
      ad_account_id: trimmedAccount || undefined,
    });
    setAccessToken("");
  };

  const canSave = accessToken.trim().length > 0 || Boolean(status?.has_token);

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    setAccessToken("");
    setAdAccountId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="dialog-meta-ads-config"
      >
        <DialogHeader>
          <DialogTitle>Integração Meta Ads</DialogTitle>
          <DialogDescription>
            Conecte sua conta do Meta (Facebook/Instagram Ads) para puxar
            métricas de campanhas, conjuntos de anúncios e contas.
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
                data-testid="meta-ads-connected-status"
              >
                Conectado.
                {status.ad_account_id && (
                  <span className="block text-xs text-muted-foreground">
                    Conta de anúncios:{" "}
                    <span className="font-medium">
                      act_{status.ad_account_id}
                    </span>
                  </span>
                )}
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
                data-testid="meta-ads-error-status"
              >
                Erro na última conexão: {status.last_error}
              </div>
            )}

            {!status?.connected &&
              !status?.has_token &&
              status?.global_fallback_status === "valid" && (
                <div
                  className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400"
                  data-testid="meta-ads-fallback-hint"
                >
                  Esta organização ainda usa o token global compartilhado
                  (META_ACCESS_TOKEN). Configure credenciais próprias para
                  isolar acessos por conta.
                </div>
              )}

            {!status?.connected &&
              !status?.has_token &&
              status?.global_fallback_status === "invalid" && (
                <div
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
                  data-testid="meta-ads-fallback-invalid"
                >
                  Token global (META_ACCESS_TOKEN) está expirado ou
                  inválido — nenhuma chamada ao Meta vai funcionar até
                  que credenciais próprias sejam cadastradas aqui.
                  {status.global_fallback_error && (
                    <span className="block mt-1 opacity-80">
                      Detalhe: {status.global_fallback_error}
                    </span>
                  )}
                </div>
              )}

            {!status?.connected &&
              !status?.has_token &&
              status?.global_fallback_status === "absent" &&
              status?.has_global_fallback === false && (
                <div
                  className="rounded-md border border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground"
                  data-testid="meta-ads-fallback-absent"
                >
                  Nenhuma credencial configurada e o token global
                  (META_ACCESS_TOKEN) não está definido no servidor.
                  Cadastre suas credenciais para conectar.
                </div>
              )}

            <div className="space-y-2">
              <Label htmlFor="meta-ads-access-token">
                Access Token do Meta
              </Label>
              <Input
                id="meta-ads-access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={
                  status?.has_token
                    ? "••••••• (digite para atualizar)"
                    : "EAAB..."
                }
                autoComplete="off"
                data-testid="input-meta-ads-access-token"
              />
              <p className="text-xs text-muted-foreground">
                Gere um System User Token de longa duração no Business
                Manager com permissões `ads_read` e `read_insights`.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta-ads-account-id">
                Ad Account ID (opcional)
              </Label>
              <Input
                id="meta-ads-account-id"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="123456789012345"
                data-testid="input-meta-ads-account-id"
              />
              <p className="text-xs text-muted-foreground">
                Use o número, sem o prefixo `act_`. Pode ser sobrescrito
                por chamada via parâmetro `adAccountId`.
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
              data-testid="button-meta-ads-disconnect"
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
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-meta-ads-test"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Testar conexão
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-meta-ads-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !canSave}
              data-testid="button-meta-ads-save"
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
