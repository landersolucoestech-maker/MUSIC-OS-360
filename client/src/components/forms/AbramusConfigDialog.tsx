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
import { CalendarClock, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAbramusStatus,
  useAbramusSaveCredentials,
  useAbramusDeleteCredentials,
  useAbramusSyncAll,
  useAbramusSetSchedule,
  type AbramusSyncSchedule,
  type AbramusSyncSummary,
} from "@/hooks/useAbramus";

const SCHEDULE_LABELS: Record<AbramusSyncSchedule, string> = {
  off: "Desligado",
  daily: "Diário",
  weekly: "Semanal",
};

interface AbramusConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AbramusConfigDialog({
  open,
  onOpenChange,
}: AbramusConfigDialogProps) {
  const { data: status, isLoading } = useAbramusStatus();
  const saveMutation = useAbramusSaveCredentials();
  const deleteMutation = useAbramusDeleteCredentials();
  const syncAllMutation = useAbramusSyncAll();
  const setScheduleMutation = useAbramusSetSchedule();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setUsername(status?.username ?? "");
    setBaseUrl(status?.base_url ?? "");
    setPassword("");
  }, [open, status?.username, status?.base_url]);

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) return;
    await saveMutation.mutateAsync({
      username: username.trim(),
      password: password.trim(),
      base_url: baseUrl.trim() || undefined,
    });
    setPassword("");
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    setUsername("");
    setPassword("");
    setBaseUrl("");
  };

  const handleSyncAll = async () => {
    await syncAllMutation.mutateAsync(undefined).catch(() => {
      // toast já é exibido no onError do hook
    });
  };

  const handleScheduleChange = async (next: AbramusSyncSchedule) => {
    if (next === currentSchedule) return;
    await setScheduleMutation.mutateAsync(next).catch(() => {
      // toast já é exibido no onError do hook
    });
  };

  const summary: AbramusSyncSummary | null =
    syncAllMutation.data ?? status?.last_sync_summary ?? null;

  const currentSchedule: AbramusSyncSchedule = status?.sync_schedule ?? "off";
  const nextSyncAt = status?.next_sync_at
    ? new Date(status.next_sync_at)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="dialog-abramus-config"
      >
        <DialogHeader>
          <DialogTitle>Integração ABRAMUS</DialogTitle>
          <DialogDescription>
            Conecte sua conta da ABRAMUS para buscar e importar obras e
            fonogramas registrados.
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
                data-testid="abramus-connected-status"
              >
                Conectado como{" "}
                <span className="font-medium">{status.username}</span>.
                {status.last_sync_at && (
                  <span className="block text-xs text-muted-foreground">
                    Última sincronização:{" "}
                    {new Date(status.last_sync_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            )}

            {Boolean(status?.username) && (
              <div
                className="rounded-md border bg-muted/30 p-3 space-y-3"
                data-testid="abramus-sync-section"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Sincronização em lote
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Importa todas as obras e fonogramas do titular
                      registrados na ABRAMUS, criando ou atualizando
                      o catálogo local.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSyncAll}
                    disabled={
                      syncAllMutation.isPending || !status?.connected
                    }
                    title={
                      status?.connected
                        ? undefined
                        : "Conecte-se à ABRAMUS antes de sincronizar."
                    }
                    data-testid="button-abramus-sync-all"
                  >
                    {syncAllMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar agora
                  </Button>
                </div>

                {!status?.connected && !syncAllMutation.isPending && (
                  <p
                    className="text-xs text-amber-600 dark:text-amber-400"
                    data-testid="abramus-sync-disabled-hint"
                  >
                    Conexão indisponível no momento. Salve credenciais válidas
                    antes de rodar a sincronização em lote.
                  </p>
                )}

                <div
                  className="space-y-1 border-t pt-3"
                  data-testid="abramus-schedule-section"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <CalendarClock className="h-4 w-4" />
                        Sincronização automática
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quando ligada, o sistema dispara a sincronização
                        sozinho na cadência escolhida.
                      </p>
                    </div>
                    <Select
                      value={currentSchedule}
                      onValueChange={(value) =>
                        handleScheduleChange(value as AbramusSyncSchedule)
                      }
                      disabled={
                        setScheduleMutation.isPending || !status?.connected
                      }
                    >
                      <SelectTrigger
                        className="w-36"
                        data-testid="select-abramus-schedule"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">
                          {SCHEDULE_LABELS.off}
                        </SelectItem>
                        <SelectItem value="daily">
                          {SCHEDULE_LABELS.daily}
                        </SelectItem>
                        <SelectItem value="weekly">
                          {SCHEDULE_LABELS.weekly}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {currentSchedule !== "off" && nextSyncAt && (
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="text-abramus-next-sync"
                    >
                      Próxima execução agendada para{" "}
                      {nextSyncAt.toLocaleString("pt-BR")}.
                    </p>
                  )}
                  {currentSchedule !== "off" && !nextSyncAt && (
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="text-abramus-next-sync-pending"
                    >
                      Próxima execução será calculada após salvar o
                      agendamento.
                    </p>
                  )}
                  {currentSchedule === "off" && (
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="text-abramus-schedule-off"
                    >
                      Apenas sincronizações manuais. A automação está
                      desligada.
                    </p>
                  )}
                </div>


                {syncAllMutation.isPending && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="abramus-sync-progress"
                  >
                    Sincronizando catálogo da ABRAMUS… Isso pode levar
                    alguns minutos para acervos grandes.
                  </p>
                )}

                {summary && !syncAllMutation.isPending && (
                  <div
                    className="space-y-2 text-xs"
                    data-testid="abramus-sync-summary"
                  >
                    <p className="text-muted-foreground">
                      Última execução em{" "}
                      {new Date(summary.finished_at).toLocaleString(
                        "pt-BR"
                      )}{" "}
                      ({Math.max(1, Math.round(summary.duration_ms / 1000))}s).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <SummaryCard
                        label="Obras"
                        data={summary.obras}
                        testid="abramus-summary-obras"
                      />
                      <SummaryCard
                        label="Fonogramas"
                        data={summary.fonogramas}
                        testid="abramus-summary-fonogramas"
                      />
                    </div>
                    <p
                      className="text-muted-foreground"
                      data-testid="text-abramus-summary-totals"
                    >
                      Total: {summary.total_inserted} novos,{" "}
                      {summary.total_updated} atualizados,{" "}
                      {summary.total_errors} erro(s).
                    </p>
                    {summary.truncated && (
                      <p className="text-amber-600 dark:text-amber-400">
                        Limite máximo de páginas atingido. Rode novamente
                        para continuar a importação.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {status?.status === "error" && status?.last_error && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                data-testid="abramus-error-status"
              >
                Erro na última conexão: {status.last_error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="abramus-username">Usuário ABRAMUS</Label>
              <Input
                id="abramus-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu_login@abramus"
                autoComplete="username"
                data-testid="input-abramus-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abramus-password">Senha</Label>
              <Input
                id="abramus-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  status?.connected
                    ? "••••••• (digite para atualizar)"
                    : "Sua senha do portal ABRAMUS"
                }
                autoComplete="current-password"
                data-testid="input-abramus-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abramus-base-url">
                Base URL (opcional)
              </Label>
              <Input
                id="abramus-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://servicos.abramus.org.br/api/v1"
                data-testid="input-abramus-base-url"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a URL padrão.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {status?.connected ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-abramus-disconnect"
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
              data-testid="button-abramus-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                saveMutation.isPending ||
                !username.trim() ||
                !password.trim()
              }
              data-testid="button-abramus-save"
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

function SummaryCard({
  label,
  data,
  testid,
}: {
  label: string;
  data: { fetched: number; inserted: number; updated: number; errors: number };
  testid: string;
}) {
  return (
    <div
      className="rounded-md border bg-background p-2"
      data-testid={testid}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold">{data.fetched} importados</p>
      <p className="text-[11px] text-muted-foreground">
        {data.inserted} novos · {data.updated} atualizados
        {data.errors > 0 ? ` · ${data.errors} erro(s)` : ""}
      </p>
    </div>
  );
}
