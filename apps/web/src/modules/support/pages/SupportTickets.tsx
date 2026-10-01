import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Button } from "@/shared/ui/button";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import {
  useTickets, useTicketMessages,
  TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS, TICKET_CATEGORY_LABELS,
} from "../hooks/useSupport";
import type { SupportTicket, TicketStatus, TicketPriority, TicketCategory } from "../types";
import { WorkflowTransitionPanel } from "@/shared/components/WorkflowTransitionPanel";
import { useWorkflowTransition } from "@/shared/hooks/useWorkflowTransition";
import { useEntityDetail } from "@/shared/hooks/useEntityDetail";
import { resolveAllowedTransitions, WorkflowTransition } from "@/shared/lib/workflow-transitions";

import {
  Plus, Search, Ticket,
  Clock, AlertCircle, CheckCircle2,
  Send, User, Shield, Tag, Calendar, ExternalLink,
  ChevronDown, UserCheck, CalendarClock, Filter,
} from "lucide-react";

interface TicketWithWorkflow extends SupportTicket {
  allowed_transitions?: { to: string; label?: string }[];
}

/* ── colours ── */
const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open:             "info",
  in_progress:      "warning",
  waiting_customer: "warning",
  resolved:         "success",
  closed:           "neutral",
};
const PRIORITY_DOT: Record<TicketPriority, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-green-500",
};

const ASSIGNEES = ["Lucas Mendes", "Fernanda Silva", "Rafael Costa", "Ana Beatriz", "Thiago Alves"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function toDatetimeLocal(iso: string) {
  return iso ? iso.slice(0, 16) : "";
}

/* ── Drawer panel — receives updateTicket from parent so both share the same state ── */
interface DrawerProps {
  ticket: TicketWithWorkflow;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<SupportTicket>) => void;
}

function TicketDrawer({ ticket, onClose, onUpdate }: DrawerProps) {
  const { messages, addMessage } = useTicketMessages(ticket.id);
  const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
    table:    'support_tickets',
    id:       ticket.id,
    queryKey: ['support_tickets'],
  });
  const { data: detail } = useEntityDetail<TicketWithWorkflow>('support_tickets', ticket.id);
  const allowedTransitions = resolveAllowedTransitions(
    'ticket',
    detail?.status ?? ticket.status,
    detail?.allowed_transitions,
  );
  const [reply, setReply]        = useState("");
  const [editSLA, setEditSLA]    = useState(toDatetimeLocal(ticket.sla_deadline ?? ""));
  const [editAssignee, setEditAssignee] = useState(ticket.assigned_to ?? "");
  const bottomRef                = useRef<HTMLDivElement>(null);

  function handleSend() {
    if (!reply.trim()) return;
    addMessage(reply.trim(), "support");
    setReply("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function applyAssignee(val: string) {
    setEditAssignee(val);
    onUpdate(ticket.id, { assigned_to: val || undefined });
  }

  function applySLA(val: string) {
    setEditSLA(val);
    if (val) onUpdate(ticket.id, { sla_deadline: new Date(val).toISOString() });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden bg-card p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
            <span className="font-sans">{ticket.ticket_number}</span>
            <span>·</span>
            <Badge variant={STATUS_VARIANT[ticket.status]} className="text-[9px] h-4 px-1.5">
              {TICKET_STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border border-border/60 text-muted-foreground ml-1">
              {TICKET_CATEGORY_LABELS[ticket.category as import("../types").TicketCategory]}
            </Badge>
          </div>
          <DialogTitle className="text-[15px] font-semibold text-left leading-snug">
            {ticket.subject}
          </DialogTitle>

          {/* Controls — priority and open full (status controlled by WorkflowTransitionPanel below) */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Select value={ticket.priority} onValueChange={(v) => onUpdate(ticket.id, { priority: v as TicketPriority })}>
              <SelectTrigger className="h-7 text-xs w-32" data-testid="select-drawer-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to={`/support/tickets/${ticket.id}`} className="ml-auto">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
                <ExternalLink className="h-3 w-3" /> Abrir completo
              </Button>
            </Link>
          </div>
          {allowedTransitions.length > 0 && (
            <WorkflowTransitionPanel
              currentStatus={ticket.status}
              allowedTransitions={allowedTransitions}
              onTransition={workflowTransition}
              isLoading={isTransitionPending}
              className="mt-1"
            />
          )}
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — thread */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border/60">
            {/* Description */}
            <div className="px-5 py-3 border-b border-border/60 shrink-0">
              <p className="text-[12px] text-muted-foreground leading-relaxed">{ticket.description}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.created_by}</span>
                <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{TICKET_CATEGORY_LABELS[ticket.category as import("../types").TicketCategory]}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatShort(ticket.created_at)}</span>
              </div>
            </div>

            {/* Thread messages */}
            <ScrollArea className="flex-1 px-5 py-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-[12px] text-muted-foreground">Nenhuma mensagem ainda. Inicie a conversa abaixo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isSupport = msg.sender_role === "support";
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "rounded-xl border p-3",
                          isSupport
                            ? "border-primary/20 bg-primary/5 ml-6"
                            : "border-border/60 bg-muted/30 mr-6",
                        )}
                        data-testid={`drawer-msg-${msg.id}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {isSupport
                              ? <Shield className="h-3 w-3 text-primary" />
                              : <User className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className="text-[11px] font-semibold text-foreground">{msg.sender_name}</span>
                            {isSupport && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/30 text-primary">
                                Suporte
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{formatShort(msg.created_at)}</span>
                        </div>
                        <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply box */}
            {ticket.status !== "closed" && (
              <div className="px-5 py-3 border-t border-border/60 shrink-0">
                <Textarea
                  placeholder="Escreva uma resposta..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  className="text-sm resize-none mb-2"
                  data-testid="textarea-drawer-reply"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</span>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleSend}
                    disabled={!reply.trim()}
                    data-testid="button-drawer-send"
                  >
                    <Send className="h-3 w-3" /> Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right — management panel */}
          <div className="w-56 shrink-0 flex flex-col gap-5 px-4 py-4 overflow-y-auto">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground  tracking-wider mb-2">Responsável</p>
              <Select value={editAssignee} onValueChange={applyAssignee}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-drawer-assignee">
                  <UserCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">Sem responsável</SelectItem>
                  {ASSIGNEES.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground  tracking-wider mb-2">SLA Deadline</p>
              <div className="relative">
                <CalendarClock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="datetime-local"
                  className="w-full pl-8 pr-2 py-1.5 h-8 text-xs rounded-md border border-border/60 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editSLA}
                  onChange={(e) => applySLA(e.target.value)}
                  data-testid="input-drawer-sla"
                />
              </div>
              {ticket.sla_deadline && (
                <p className={cn(
                  "text-[10px] mt-1.5 flex items-center gap-1",
                  new Date(ticket.sla_deadline) < new Date() ? "text-red-400" : "text-muted-foreground",
                )}>
                  <Clock className="h-3 w-3" />
                  {formatShort(ticket.sla_deadline)}
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground  tracking-wider mb-2">Detalhes</p>
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  <span className="font-medium text-foreground">Criado por:</span>
                </div>
                <p className="pl-4">{ticket.created_by}</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium text-foreground">Atualizado:</span>
                </div>
                <p className="pl-4">{formatShort(ticket.updated_at)}</p>
                {ticket.closed_at && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      <span className="font-medium text-foreground">Fechado:</span>
                    </div>
                    <p className="pl-4">{formatShort(ticket.closed_at)}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ── */
const PAGE_SIZE = 8;

export default function SupportTickets() {
  const { tickets, addTicket, updateTicket } = useTickets();
  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState<string>("all");
  const [priorityFilter, setPriorityFilter]   = useState<string>("all");
  const [categoryFilter, setCategoryFilter]   = useState<string>("all");
  const [showModal, setShowModal]             = useState(false);
  const [activeTicket, setActiveTicket]       = useState<SupportTicket | null>(null);
  const [page, setPage]                       = useState(1);

  const [form, setForm] = useState({
    subject: "", description: "", category: "other" as TicketCategory, priority: "medium" as TicketPriority,
  });

  /* When updateTicket is called from drawer, also sync the activeTicket state */
  const handleUpdate = useCallback((id: string, changes: Partial<SupportTicket>) => {
    updateTicket(id, changes);
    setActiveTicket((prev) =>
      prev && prev.id === id
        ? { ...prev, ...changes, updated_at: new Date().toISOString() }
        : prev
    );
  }, [updateTicket]);

  const filtered = tickets.filter((t) => {
    if (statusFilter   !== "all" && t.status   !== statusFilter)   return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase())
      && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visible  = filtered.slice(0, page * PAGE_SIZE);
  const hasMore  = visible.length < filtered.length;
  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  function handleCreate() {
    if (!form.subject.trim()) return;
    addTicket({ subject: form.subject, description: form.description, category: form.category, priority: form.priority, created_by: "Usuário Atual" });
    setShowModal(false);
    setForm({ subject: "", description: "", category: "other", priority: "medium" });
  }

  return (
    <MainLayout
      title="Tickets"
      description="Gerencie chamados de suporte"
      actions={
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowModal(true)} data-testid="button-new-ticket">
          <Plus className="h-3.5 w-3.5" /> Novo Ticket
        </Button>
      }
    >
      <div className="space-y-5 animate-fade-in">

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por assunto ou número..."
                className="pl-8 h-8 text-xs"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search-tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-40" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-40" data-testid="select-priority-filter"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {(Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Category filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {[["all", "Todas as categorias"], ...Object.entries(TICKET_CATEGORY_LABELS)].map(([k, v]) => (
              <button
                key={k}
                onClick={() => { setCategoryFilter(k); setPage(1); }}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] border transition-colors",
                  categoryFilter === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                )}
                data-testid={`category-filter-${k}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Abertos",    count: tickets.filter(t => t.status === "open").length,            icon: Ticket,       color: "text-blue-400" },
            { label: "Andamento",  count: tickets.filter(t => t.status === "in_progress").length,     icon: Clock,        color: "text-yellow-400" },
            { label: "Aguardando", count: tickets.filter(t => t.status === "waiting_customer").length, icon: AlertCircle,  color: "text-orange-400" },
            { label: "Resolvidos", count: tickets.filter(t => t.status === "resolved").length,         icon: CheckCircle2, color: "text-green-400" },
          ].map(({ label, count, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
              <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Ticket list */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Ticket className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <>
              <ListSectionHeader
                title="Lista de Tickets"
                count={filtered.length}
                description="Acompanhe solicitações, categorias, prioridades e prazos de atendimento"
                className="px-4 pt-4"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Atribuído a</TableHead>
                    <TableHead>Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setActiveTicket(ticket)}
                      data-testid={`row-ticket-${ticket.id}`}
                    >
                      <TableCell className="font-sans text-[11px] text-muted-foreground">{ticket.ticket_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[ticket.priority])} />
                          <span className="text-sm font-medium text-foreground truncate max-w-[260px]">{ticket.subject}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border border-border/60 text-muted-foreground">
                          {TICKET_CATEGORY_LABELS[ticket.category as import("../types").TicketCategory]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border border-border/60 text-muted-foreground">
                          {TICKET_PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[ticket.status]} className="text-[10px] h-4 px-1.5">
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ticket.created_by}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ticket.assigned_to
                          ? <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{ticket.assigned_to}</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatDate(ticket.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {hasMore && (
                <div className="px-5 py-4 border-t border-border/60 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={loadMore}
                    data-testid="button-load-more"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Carregar mais ({filtered.length - visible.length} restantes)
                  </Button>
                </div>
              )}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <div className="px-5 py-3 border-t border-border/60 text-center">
                  <p className="text-[11px] text-muted-foreground">{filtered.length} tickets exibidos</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawer — passes updateTicket from THIS component's hook instance */}
      {activeTicket && (
        <TicketDrawer
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Create modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Novo Ticket de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Assunto *</Label>
              <Input
                placeholder="Descreva brevemente o problema..."
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="text-sm"
                data-testid="input-ticket-subject"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}>
                  <SelectTrigger className="text-xs h-8" data-testid="select-ticket-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TICKET_CATEGORY_LABELS) as [TicketCategory, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                  <SelectTrigger className="text-xs h-8" data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Descreva o problema em detalhes..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-sm resize-none"
                rows={4}
                data-testid="textarea-ticket-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!form.subject.trim()} data-testid="button-submit-ticket">
              Criar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
