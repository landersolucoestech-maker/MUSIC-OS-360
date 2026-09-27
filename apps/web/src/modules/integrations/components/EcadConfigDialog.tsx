/**
 * modules/integrations/components/EcadConfigDialog.tsx
 *
 * Configuration dialog of the ECAD integration.
 * Allows connecting, querying collections, reconciling with the catalog and disconnecting.
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
  Trash2,
  Save,
  Eye,
  EyeOff,
  FileText,
  Info,
} from "lucide-react";
import {
  useEcadStatus,
  useEcadSaveCredentials,
  useEcadDeleteCredentials,
  useEcadReconciliation,
} from "../hooks/useEcad";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EcadConfigDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EcadConfigDialog({ open, onOpenChange }: EcadConfigDialogProps) {
  const { data: status, isLoading: isLoadingStatus } = useEcadStatus();
  const saveCredentials   = useEcadSaveCredentials();
  const deleteCredentials = useEcadDeleteCredentials();
  const reconciliation       = useEcadReconciliation();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    associacao: "",
    username:   "",
    password:   "",
  });

  const currentPeriodo = format(new Date(), "yyyy-MM", { locale: ptBR });

  const isConnected  = status?.connected ?? false;
  const isSaving     = saveCredentials.isPending;
  const isDeleting   = deleteCredentials.isPending;
  const isConciling  = reconciliation.isPending;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveCredentials.mutate({
      associacao: form.associacao.trim(),
      username:   form.username.trim(),
      password:   form.password.trim(),
    });
  }

  function handleConciliar() {
    reconciliation.mutate({ periodo: currentPeriodo });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <IntegrationDialogHeader
          logoId="ecad"
          title="ECAD — Escritório Central de Arrecadação"
          description="Arrecadação de execução pública · Conciliação com catálogo · Relatórios"
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
            {isConnected && status?.associacao_filiada && (
              <span className="text-muted-foreground">
                · {status.associacao_filiada}
              </span>
            )}
          </div>
          {isConnected && (
            <Badge variant="info">
              Ativo
            </Badge>
          )}
        </div>

        {/* Institutional notice (always visible) */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700">
            O acesso ao ECAD requer contrato institucional com uma associação filiada (ABRAMUS, UBC, AMAR, SICAM, etc.).
            As credenciais são fornecidas pela sua associação.
          </p>
        </div>

        {/* Credentials form (disconnected) */}
        {!isConnected && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ecad-associacao" className="text-xs font-medium">
                  Associação filiada <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ecad-associacao"
                  placeholder="Ex.: ABRAMUS, UBC, AMAR, SICAM…"
                  value={form.associacao}
                  onChange={(e) => setForm((p) => ({ ...p, associacao: e.target.value }))}
                  data-testid="input-ecad-associacao"
                  disabled={isSaving}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ecad-username" className="text-xs font-medium">
                  Usuário <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ecad-username"
                  placeholder="Usuário de acesso fornecido pelo ECAD"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  data-testid="input-ecad-username"
                  disabled={isSaving}
                  autoComplete="username"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ecad-password" className="text-xs font-medium">
                  Senha <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="ecad-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    data-testid="input-ecad-password"
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
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSaving || !form.associacao.trim() || !form.username.trim() || !form.password.trim()}
              data-testid="button-ecad-save"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando…</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Conectar ao ECAD</>
              )}
            </Button>
          </form>
        )}

        {/* Management panel (connected) */}
        {isConnected && (
          <div className="space-y-4">
            {/* Reconciliation */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Conciliação com catálogo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Compara os fonogramas com código ECAD registrado no catálogo com os dados de arrecadação do período atual.
              </p>
              {reconciliation.data && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-emerald-500/10 border border-emerald-500/20 py-2">
                    <p className="text-base font-semibold text-emerald-600">{reconciliation.data.conciliados}</p>
                    <p className="text-[11px] text-muted-foreground">Conciliados</p>
                  </div>
                  <div className="rounded bg-amber-500/10 border border-amber-500/20 py-2">
                    <p className="text-base font-semibold text-amber-600">{reconciliation.data.discrepancias}</p>
                    <p className="text-[11px] text-muted-foreground">Discrepâncias</p>
                  </div>
                  <div className="rounded bg-muted/40 border py-2">
                    <p className="text-base font-semibold">{reconciliation.data.sem_cod_ecad}</p>
                    <p className="text-[11px] text-muted-foreground">Sem cód. ECAD</p>
                  </div>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleConciliar}
                disabled={isConciling}
                data-testid="button-ecad-conciliar"
              >
                {isConciling ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Conciliando…</>
                ) : (
                  <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Conciliar agora</>
                )}
              </Button>
            </div>

            {/* Report import */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Importar relatório ECAD</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Importe o arquivo de arrecadação ECAD (.txt / .xml) recebido por e-mail da sua associação.
              </p>
              <p className="text-xs text-muted-foreground/60 italic">
                Disponível após vincular o relatório ao módulo de Contabilidade.
              </p>
            </div>

            <Separator />

            {/* Info + desconectar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>
                  {status?.associacao_filiada} · Usuário: <strong>{status?.username}</strong>
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isDeleting}
                    data-testid="button-ecad-disconnect"
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
                    <AlertDialogTitle>Desconectar ECAD?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As credenciais serão removidas. Os dados de arrecadação já importados não serão apagados.
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
