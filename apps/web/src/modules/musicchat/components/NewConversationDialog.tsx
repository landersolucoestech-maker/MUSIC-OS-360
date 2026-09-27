/**
 * components/NewConversationDialog.tsx
 *
 * Start a new conversation (product decision PD-3, 2026-08-23): WhatsApp-only scope.
 * Every other channel (facebook/instagram/tiktok/site/etc.) always results in
 * delivery_status='internal_only' on the backend (dispatchOutbound never actually sends
 * to them) — offering those channels here would create a false impression of a real choice.
 * WhatsApp is the only channel where "start conversation" actually reaches someone externally.
 */
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "sonner";
import {
  musicChatConversationsService,
  type SupportConversation,
} from "@/modules/musicchat/services/conversations.service";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversation: SupportConversation) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // One idempotency key PER PAYLOAD, not per call. A retry of the same payload after a
  // timeout reuses the key and the backend returns the already-created conversation instead of creating a second one
  // (IdempotencyInterceptor). If the agent EDITS the fields and resubmits, it is another logical
  // attempt: new key, otherwise the backend would replay the old response and the edit would be lost.
  const attemptRef = useRef<{ key: string; signature: string } | null>(null);

  const canSubmit = phone.trim().length > 0 && !isSubmitting;

  const reset = () => {
    setCustomerName("");
    setPhone("");
    setInitialMessage("");
    attemptRef.current = null;
  };

  const handleOpenChange = (next: boolean) => {
    if (!isSubmitting) {
      onOpenChange(next);
      if (!next) reset();
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const signature = `${customerName.trim()}|${phone.trim()}|${initialMessage.trim()}`;
    if (attemptRef.current?.signature !== signature) {
      attemptRef.current = { key: crypto.randomUUID(), signature };
    }
    try {
      const conversation = await musicChatConversationsService.create(
        {
          subject: customerName.trim() || phone.trim(),
          channel: "whatsapp",
          phone: phone.trim(),
          customer: customerName.trim() || undefined,
        },
        attemptRef.current.key,
      );

      const body = initialMessage.trim();
      let initialMessageFailed = false;
      if (body) {
        try {
          await musicChatConversationsService.sendMessage(conversation.id, body);
        } catch {
          // The conversation was really created — only the first message failed to send.
          // Do not fabricate silent success: warn the agent, but keep the created conversation
          // (it already shows up in the list via the realtime conversation:created event itself).
          initialMessageFailed = true;
          toast.error("Conversa criada, mas a mensagem inicial falhou ao enviar. Tente reenviar pela conversa.");
        }
      }

      if (!initialMessageFailed) toast.success("Conversa iniciada.");
      onCreated(conversation);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível iniciar a conversa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa via WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Apenas WhatsApp tem envio externo real hoje — os demais canais ficam registrados
            apenas internamente (sem entrega ao cliente).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-name">Nome do contato</Label>
            <Input
              id="new-conv-name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Opcional"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-phone">Telefone (WhatsApp)</Label>
            <Input
              id="new-conv-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+55 11 99999-9999"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-message">Mensagem inicial</Label>
            <Textarea
              id="new-conv-message"
              value={initialMessage}
              onChange={(event) => setInitialMessage(event.target.value)}
              placeholder="Opcional — a conversa pode ser criada sem enviar nada ainda"
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting ? "Criando…" : "Iniciar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
