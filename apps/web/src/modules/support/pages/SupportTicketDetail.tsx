import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  useTickets, useTicketMessages,
  TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS, TICKET_CATEGORY_LABELS,
} from "../hooks/useSupport";
import type { TicketStatus, TicketPriority } from "../types";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import {
  ArrowLeft, Send, User, Shield, Clock,
  AlertCircle, CheckCircle2, Tag, Calendar,
} from "lucide-react";

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  in_progress: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  waiting_customer: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  resolved: "border-green-500/30 text-green-400 bg-green-500/10",
  closed: "border-border text-muted-foreground bg-muted/40",
};

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  critical: "border-red-500/30 text-red-400 bg-red-500/10",
  high: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  medium: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  low: "border-green-500/30 text-green-400 bg-green-500/10",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { tickets, updateTicket } = useTickets();
  const ticket = tickets.find((t) => t.id === id);
  const { messages, addMessage, isSending } = useTicketMessages(id ?? "");
  const [reply, setReply] = useState("");

  if (!ticket) {
    return (
      <MainLayout title="Ticket não encontrado">
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Ticket não encontrado</p>
          <Link to="/support/tickets">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Tickets
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  async function handleSend() {
    if (!reply.trim()) return;
    try {
      await addMessage(reply.trim(), "support");
      setReply("");
    } catch {
      // Error already reported via toast in useTicketMessages; keeps the typed
      // text so the user does not lose the reply and can try again.
    }
  }

  return (
    <MainLayout
      title={ticket.ticket_number}
      description={ticket.subject}
      actions={
        <Link to="/support/tickets">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        </Link>
      }
    >
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 animate-fade-in">

        {/* ── Messages ── */}
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h1 className="text-base font-semibold text-foreground mb-2">{ticket.subject}</h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{ticket.description}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] border", STATUS_COLOR[ticket.status])}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] border", PRIORITY_COLOR[ticket.priority])}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {TICKET_CATEGORY_LABELS[ticket.category as import("../types").TicketCategory]}
              </span>
            </div>
          </div>

          {/* Thread */}
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                <p className="text-[13px] text-muted-foreground">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSupport = msg.sender_role === "support";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-xl border p-4",
                      isSupport
                        ? "border-primary/20 bg-primary/5 ml-6"
                        : "border-border/60 bg-card mr-6",
                    )}
                    data-testid={`msg-${msg.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {isSupport
                          ? <Shield className="h-3.5 w-3.5 text-primary" />
                          : <User className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <span className="text-[12px] font-semibold text-foreground">
                          {msg.sender_name}
                        </span>
                        {isSupport && (
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-primary/30 text-primary">
                            Suporte
                          </Badge>
                        )}
                        {msg.internal_note && (
                          <Badge variant="warning" className="text-[9px] h-3.5 px-1">
                            Nota Interna
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatShort(msg.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply */}
          {ticket.status !== "closed" && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-[12px] font-medium text-muted-foreground mb-2">Responder</p>
              <Textarea
                placeholder="Escreva sua resposta..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                className="text-sm resize-none mb-3"
                data-testid="textarea-reply"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleSend}
                  disabled={!reply.trim() || isSending}
                  data-testid="button-send-reply"
                >
                  <Send className="h-3.5 w-3.5" /> {isSending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <p className="text-[12px] font-semibold text-muted-foreground  tracking-wider">Gerenciar</p>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Status</p>
              <Select
                value={ticket.status}
                onValueChange={(v) => updateTicket(ticket.id, { status: v as TicketStatus }, getExpectedUpdatedAt(ticket))}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-ticket-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Prioridade</p>
              <Select
                value={ticket.priority}
                onValueChange={(v) => updateTicket(ticket.id, { priority: v as TicketPriority }, getExpectedUpdatedAt(ticket))}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ticket.status !== "resolved" && ticket.status !== "closed" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 text-green-400 border-green-500/30 hover:bg-green-500/10"
                onClick={() => updateTicket(ticket.id, { status: "resolved" }, getExpectedUpdatedAt(ticket))}
                data-testid="button-resolve-ticket"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Resolvido
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <p className="text-[12px] font-semibold text-muted-foreground  tracking-wider">Detalhes</p>
            {[
              { icon: User, label: "Solicitante", value: ticket.created_by },
              { icon: Shield, label: "Responsável", value: ticket.assigned_to ?? "Não atribuído" },
              { icon: Tag, label: "Categoria", value: TICKET_CATEGORY_LABELS[ticket.category as import("../types").TicketCategory] },
              { icon: Calendar, label: "Criado em", value: formatDate(ticket.created_at) },
              { icon: Clock, label: "Atualizado", value: formatDate(ticket.updated_at) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-[12px] text-foreground font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
