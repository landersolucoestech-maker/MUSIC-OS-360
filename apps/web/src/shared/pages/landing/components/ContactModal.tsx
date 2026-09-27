/**
 * ContactModal.tsx
 *
 * Platform Commercial Contact (product decision 2026-08-22): institutional/commercial
 * contact about Music OS 360 itself — companies
 * interested in hiring the platform. Sends to
 * POST /public/platform-contact (forwards by e-mail via the real MailService,
 * never creates a Support Ticket/MusicChat/lead/tenant record).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { publicApi } from "@/shared/lib/api-client";
import { useContactModalStore } from "../store/contact-modal.store";

export function ContactModal() {
  const open = useContactModalStore((s) => s.open);
  const closeModal = useContactModalStore((s) => s.closeModal);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAndClose = () => {
    setName(""); setEmail(""); setCompany(""); setMessage(""); setWebsite("");
    closeModal();
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Preencha nome, e-mail e mensagem.");
      return;
    }
    setIsSubmitting(true);
    try {
      await publicApi.post("/public/platform-contact", {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        message: message.trim(),
        website,
      });
      toast.success("Mensagem enviada! Entraremos em contato em breve.");
      resetAndClose();
    } catch {
      toast.error("Não foi possível enviar sua mensagem agora. Tente novamente em instantes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetAndClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fale com a MUSIC OS 360</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Honeypot — invisible to humans, bots fill it in */}
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="contact-website">Site</Label>
            <Input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome *</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} data-testid="input-contact-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">E-mail *</Label>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} data-testid="input-contact-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-company">Empresa</Label>
            <Input id="contact-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={255} data-testid="input-contact-company" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Mensagem *</Label>
            <Textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={4} data-testid="input-contact-message" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-contact-submit">
            {isSubmitting ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
