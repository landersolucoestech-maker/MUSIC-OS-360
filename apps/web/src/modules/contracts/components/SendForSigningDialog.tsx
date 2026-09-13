/**
 * contracts/components/SendForSigningDialog.tsx
 *
 * Dialog para selecionar o provedor de assinatura digital e disparar o envio
 * de um contrato para assinatura.
 *
 * Provedores mostrados:  Autentique (sempre) | Clicksign | DocuSign
 * Somente provedores conectados ficam habilitados para seleção.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Loader2, Send, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSigningProviders } from "@/modules/integrations/hooks/useSigningProviders";
import { signingService, type SigningProviderId } from "@/modules/integrations/services/signing.service";
import type { ContractWithRelations } from "@/modules/contracts/hooks/useContracts";

interface SendForSigningDialogProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  contrato:       ContractWithRelations;
  onSuccess?:     (documentId: string, provider: SigningProviderId) => void;
}

const PROVIDER_COLORS: Record<SigningProviderId, string> = {
  autentique: "bg-blue-500/10 border-blue-500/30 text-blue-600",
  docusign:   "bg-amber-500/10 border-amber-500/30 text-amber-600",
};

const PROVIDER_SELECTED: Record<SigningProviderId, string> = {
  autentique: "ring-2 ring-blue-500 border-blue-500",
  docusign:   "ring-2 ring-amber-500 border-amber-500",
};

export function SendForSigningDialog({
  open,
  onOpenChange,
  contrato,
  onSuccess,
}: SendForSigningDialogProps) {
  const { data: providers = [], isLoading: loadingProviders } = useSigningProviders();
  const [selected, setSelected] = useState<SigningProviderId | null>(null);
  const [sending, setSending] = useState(false);

  const signers = Array.isArray(contrato.signers) ? contrato.signers : [];
  const hasFile = Boolean(contrato.arquivo_url);
  const canSend = selected !== null && signers.length > 0 && hasFile && !sending;

  async function handleSend() {
    if (!selected || signers.length === 0 || !contrato.arquivo_url) return;
    setSending(true);
    try {
      const result = await signingService.sendForSigning({
        contratoId: contrato.id,
        title:      contrato.title,
        fileUrl:    contrato.arquivo_url,
        signers:    signers.map((s) => ({ name: s.name, email: s.email })),
        provider:   selected,
      });

      // Autentique já envia o convite de assinatura por email diretamente aos
      // signatários (ver signing.service.ts) — este toast só confirma o envio.
      // Nota: o vínculo local do documento (useDocuments/useSaveDocument) não
      // tem endpoint real ainda (ver contracts/hooks/useDocuments.ts) — o envio
      // acima já é real e irreversível, então o sucesso é reportado a partir
      // dele, sem depender de uma persistência local que sempre falharia e
      // mascararia o envio bem-sucedido como erro.
      toast.success("Contrato enviado via Autentique!", {
        description: `${signers.length} signatário(s) notificado(s) por email.`,
      });

      onSuccess?.(result.documentId, selected);
      onOpenChange(false);
      setSelected(null);
    } catch (err) {
      toast.error("Erro ao enviar para assinatura", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) { onOpenChange(v); if (!v) setSelected(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            Enviar para Assinatura Digital
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha o provedor de assinatura digital para enviar o contrato{" "}
            <span className="font-medium text-foreground">&ldquo;{contrato.title}&rdquo;</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Signatários summary */}
        {signers.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Nenhum signatário definido. Edite o contrato para adicionar signatários antes de enviar.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-muted/30 border border-border rounded-lg">
            <p className="text-xs font-medium mb-2 text-muted-foreground  tracking-wide">
              Signatários ({signers.length})
            </p>
            <div className="space-y-1">
              {signers.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium truncate">{s.name}</span>
                  <span className="text-muted-foreground truncate">{s.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasFile && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Este contrato não possui uma URL de arquivo cadastrada. Edite o contrato e informe a URL do PDF antes de enviar.
            </p>
          </div>
        )}

        {/* Provider selector */}
        <div>
          <p className="text-xs font-medium text-muted-foreground  tracking-wide mb-3">
            Provedor de Assinatura
          </p>
          {loadingProviders ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.connected || sending}
                  onClick={() => p.connected && setSelected(p.id)}
                  data-testid={`provider-option-${p.id}`}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    p.connected && "cursor-pointer hover:bg-muted/40",
                    selected === p.id
                      ? PROVIDER_SELECTED[p.id]
                      : "border-border bg-card"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg border flex items-center justify-center text-sm font-bold shrink-0",
                    PROVIDER_COLORS[p.id]
                  )}>
                    {p.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {p.connected ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                        <ExternalLink className="h-2.5 w-2.5" />
                        Configurar
                      </Badge>
                    )}
                    {selected === p.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onOpenChange(false); setSelected(null); }}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSend}
            disabled={!canSend}
            data-testid="button-confirm-send-for-signing"
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Enviar para Assinatura
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
