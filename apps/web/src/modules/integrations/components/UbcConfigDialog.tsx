/**
 * modules/integrations/components/UbcConfigDialog.tsx
 *
 * Configuration dialog of the UBC integration (Brazilian composers' union).
 * Allows connecting, disconnecting, syncing the catalog and scheduling syncs.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/shared/ui/dialog";
import { IntegrationDialogHeader } from "@/shared/integrations";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import {
  Shield,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useUbcStatus,
  useUbcSaveCredentials,
  useUbcDeleteCredentials,
  useUbcSyncAll,
  useUbcSetSchedule,
  type UbcSyncSchedule,
} from "../hooks/useUbc";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UbcConfigDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UbcConfigDialog({ open, onOpenChange }: UbcConfigDialogProps) {
  const { data: status, isLoading: isLoadingStatus } = useUbcStatus();
  const saveCredentials   = useUbcSaveCredentials();
  const deleteCredentials = useUbcDeleteCredentials();
  const syncAll           = useUbcSyncAll();
  const setSchedule       = useUbcSetSchedule();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    numero_filiado: "",
    username:       "",
    password:       "",
    base_url:       "",
  });

  const isConnected  = status?.connected ?? false;
  const isSaving     = saveCredentials.isPending;
  const isSyncing    = syncAll.isPending;
  const isDeleting   = deleteCredentials.isPending;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveCredentials.mutate({
      numero_filiado: form.numero_filiado.trim(),
      username:       form.username.trim(),
      password:       form.password.trim(),
      base_url:       form.base_url.trim() || undefined,
    });
  }

  function handleSync() {
    syncAll.mutate();
  }

  function handleScheduleChange(value: string) {
    setSchedule.mutate(value as UbcSyncSchedule);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <IntegrationDialogHeader
          logoId="ubc"
          title="UBC — União Brasileira de Compositores"
          description="Sincronize obras, ISWC e dados de registro de composições"
        />

        {/* Status badge */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {isLoadingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
            {isConnected && status?.numero_filiado && (
              <span className="text-muted-foreground">
                · Filiado {status.numero_filiado}
              </span>
            )}
          </div>
          {isConnected && (
            <Badge variant="success">
              Ativo
            </Badge>
          )}
        </div>

        {/* Credentials form (shown only when disconnected) */}
        {!isConnected && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ubc-filiado" className="text-xs font-medium">
                  Número de Filiado <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ubc-filiado"
                  placeholder="Ex.: 12345"
                  value={form.numero_filiado}
                  onChange={(e) => setForm((p) => ({ ...p, numero_filiado: e.target.value }))}
                  data-testid="input-ubc-filiado"
                  disabled={isSaving}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ubc-username" className="text-xs font-medium">
                  Usuário <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ubc-username"
                  placeholder="Usuário de acesso ao portal UBC"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  data-testid="input-ubc-username"
                  disabled={isSaving}
                  autoComplete="username"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ubc-password" className="text-xs font-medium">
                  Senha <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="ubc-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    data-testid="input-ubc-password"
                    disabled={isSaving}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ubc-url" className="text-xs font-medium text-muted-foreground">
                  URL base (opcional)
                </Label>
                <Input
                  id="ubc-url"
                  placeholder="https://portal.ubc.org.br (padrão)"
                  value={form.base_url}
                  onChange={(e) => setForm((p) => ({ ...p, base_url: e.target.value }))}
                  data-testid="input-ubc-url"
                  disabled={isSaving}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSaving || !form.numero_filiado.trim() || !form.username.trim() || !form.password.trim()}
              data-testid="button-ubc-save"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando…</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Conectar à UBC</>
              )}
            </Button>
          </form>
        )}

        {/* Management panel (shown when connected) */}
        {isConnected && (
          <div className="space-y-4">
            {/* Batch sync */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sincronização do catálogo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Importa todas as obras registradas na UBC para o catálogo local, gerando ISWC automaticamente.
              </p>
              {syncAll.data && (
                <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700">
                  Última sincronização: {syncAll.data.total_inserted} novas obras importadas, {syncAll.data.total_updated} já existentes
                  {syncAll.data.total_errors > 0 && ` · ${syncAll.data.total_errors} erros`}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleSync}
                disabled={isSyncing}
                data-testid="button-ubc-sync"
              >
                {isSyncing ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Sincronizando…</>
                ) : (
                  <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Sincronizar agora</>
                )}
              </Button>
            </div>

            {/* Agendamento */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sincronização automática</span>
              </div>
              <Select
                value={status?.sync_schedule ?? "off"}
                onValueChange={handleScheduleChange}
                disabled={setSchedule.isPending}
              >
                <SelectTrigger
                  className="w-full text-sm"
                  data-testid="select-ubc-schedule"
                >
                  <SelectValue placeholder="Frequência…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Desactivada</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Zona de perigo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>Filiado: <strong>{status?.numero_filiado}</strong> · Usuário: <strong>{status?.username}</strong></span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isDeleting}
                    data-testid="button-ubc-disconnect"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">Desconectar</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar UBC?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As credenciais serão removidas. O catálogo já importado não será apagado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteCredentials.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
