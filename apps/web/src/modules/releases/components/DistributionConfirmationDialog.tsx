import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  DISTRIBUTION_CONFIRMATION_SOURCE_OPTIONS,
  EMPTY_DISTRIBUTION_CONFIRMATION,
  buildDistributionConfirmationMetadata,
  distributionConfirmationProblems,
  type DistributionConfirmationDraft,
} from "@/modules/releases/lib/distribution-confirmation";

interface DistributionConfirmationDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (metadata: Record<string, unknown>) => void | Promise<void>;
}

export function DistributionConfirmationDialog({ open, isSubmitting = false, onCancel, onConfirm }: DistributionConfirmationDialogProps) {
  const [draft, setDraft] = useState<DistributionConfirmationDraft>(EMPTY_DISTRIBUTION_CONFIRMATION);
  const [attempted, setAttempted] = useState(false);
  const problems = distributionConfirmationProblems(draft);
  const set = (patch: Partial<DistributionConfirmationDraft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    setAttempted(true);
    if (problems.length > 0) return;
    await onConfirm(buildDistributionConfirmationMetadata(draft));
    setDraft(EMPTY_DISTRIBUTION_CONFIRMATION);
    setAttempted(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-md" data-testid="distribution-confirmation-dialog">
        <DialogHeader>
          <DialogTitle>Registrar confirmação de distribuição</DialogTitle>
          <DialogDescription>
            Um lançamento só é marcado como distribuído com a confirmação registrada: da distribuidora ou de uma conclusão
            operacional manual, com a referência que a comprova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="distribution-source">Origem da confirmação</Label>
            <select
              id="distribution-source"
              value={draft.source}
              onChange={(e) => set({ source: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {DISTRIBUTION_CONFIRMATION_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="distribution-reference">Referência (protocolo, ticket ou link)</Label>
            <Input id="distribution-reference" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={500} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="distribution-date">Data da confirmação</Label>
            <Input id="distribution-date" type="date" value={draft.confirmedAt} onChange={(e) => set({ confirmedAt: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="distribution-note">Observação (opcional)</Label>
            <Textarea id="distribution-note" value={draft.note} onChange={(e) => set({ note: e.target.value })} maxLength={1000} rows={2} />
          </div>
          {attempted && problems.length > 0 && (
            <p role="alert" className="text-sm text-destructive" data-testid="distribution-confirmation-problems">
              Informe: {problems.join(", ")}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={submit} disabled={isSubmitting} data-testid="distribution-confirmation-submit">
            Confirmar distribuição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
