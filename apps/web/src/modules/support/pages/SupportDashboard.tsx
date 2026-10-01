import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { useKnowledgeArticles, useTickets } from "../hooks/useSupport";
import {
  Plus, BookOpen, Ticket, Search, ChevronDown, ChevronRight,
} from "lucide-react";
import type { TicketStatus, TicketPriority } from "../types";

/* ── status helpers ── */
const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open:             "info",
  in_progress:      "warning",
  waiting_customer: "warning",
  resolved:         "success",
  closed:           "neutral",
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto", in_progress: "Em Andamento",
  waiting_customer: "Aguardando", resolved: "Resolvido", closed: "Fechado",
};
const PRIORITY_LABEL: Record<TicketPriority, string> = {
  critical: "CRÍTICA", high: "ALTA", medium: "MÉDIA", low: "BAIXA",
};
const PRIORITY_COLOR: Record<TicketPriority, string> = {
  critical: "text-red-500", high: "text-red-400", medium: "text-yellow-400", low: "text-green-400",
};

/* ── tab type ── */
type TabKey = "all" | "open" | "waiting" | "closed";

export default function SupportDashboard() {
  const { tickets } = useTickets();
  const { articles } = useKnowledgeArticles();
  const [faqOpen, setFaqOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");

  /* ticket counts */
  const openCount    = tickets.filter(t => t.status === "open").length;
  const waitingCount = tickets.filter(t => t.status === "waiting_customer").length;
  const closedCount  = tickets.filter(t => ["resolved", "closed"].includes(t.status)).length;

  /* filter tickets by tab */
  const filteredTickets = tickets.filter(t => {
    if (tab === "open")    return t.status === "open";
    if (tab === "waiting") return t.status === "waiting_customer";
    if (tab === "closed")  return t.status === "resolved" || t.status === "closed";
    return true;
  }).slice(0, 6);

  /* filter managed knowledge articles */
  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(search.toLowerCase()) ||
    article.summary.toLowerCase().includes(search.toLowerCase()) ||
    article.category_name.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "all",     label: "Todos",      count: tickets.length },
    { key: "open",    label: "Aberto",     count: openCount },
    { key: "waiting", label: "Aguardando", count: waitingCount },
    { key: "closed",  label: "Fechado",    count: closedCount },
  ];

  return (
    <MainLayout
      title="Central de Suporte"
      description="Como podemos ajudar hoje?"
    >
      <div className="space-y-6 animate-fade-in">

        {/* ── 3 Quick-action cards ── */}
        <div className="grid grid-cols-3 gap-4">
          <Link
            to="/support/tickets/new"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
            data-testid="quick-new-ticket"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
              <Plus className="h-7 w-7 text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-foreground">Novo Ticket</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Precisa de ajuda? Abra um novo ticket de suporte</p>
            </div>
          </Link>

          <Link
            to="/support/knowledge"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
            data-testid="quick-knowledge"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-foreground">Base de Conhecimento</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Encontre respostas rápidas nas perguntas frequentes</p>
            </div>
          </Link>

          <Link
            to="/support/tickets"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
            data-testid="quick-my-tickets"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
              <Ticket className="h-7 w-7 text-orange-400" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-foreground">Meus Tickets</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
                {openCount > 0 ? ` · ${openCount} aberto${openCount !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
          </Link>
        </div>

        {/* ── 2-col layout ── */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">

          {/* Left — knowledge base accordion */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Base de Conhecimento</span>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full rounded-xl border border-border/60 bg-muted/40 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                  placeholder="Buscar na base de conhecimento..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-faq-search"
                />
              </div>
            </div>

            {/* Managed knowledge articles */}
            <div className="px-5 pb-4 space-y-2">
              {filteredArticles.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-[12px] text-muted-foreground">Nenhum artigo encontrado.</p>
                  <Link to="/support/knowledge" className="mt-2 inline-flex text-[12px] text-primary hover:underline">
                    Ver Base de Conhecimento
                  </Link>
                </div>
              )}
              {filteredArticles.slice(0, 6).map(article => (
                <div key={article.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setFaqOpen(faqOpen === article.id ? null : article.id)}
                    data-testid={`faq-toggle-${article.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                        {article.category_name}
                      </span>
                      <span className="text-[13px] font-medium text-foreground truncate">{article.title}</span>
                    </div>
                    {faqOpen === article.id
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    }
                  </button>
                  {faqOpen === article.id && (
                    <div className="px-4 pb-4 pt-1 text-[12px] text-muted-foreground leading-relaxed border-t border-border/60 bg-muted/10">
                      <p>{article.summary}</p>
                      <Link to="/support/knowledge" className="mt-2 inline-flex text-[12px] text-primary hover:underline">
                        Abrir artigo completo
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 pb-4">
              <Link
                to="/support/knowledge"
                className="text-[12px] text-primary hover:underline flex items-center gap-1"
              >
                Ver todos os artigos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Right — Meus Tickets */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Meus Tickets</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/60 px-4 pt-2 gap-1">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "pb-2 px-3 text-[12px] font-medium border-b-2 transition-colors",
                    tab === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`tab-tickets-${t.key}`}
                >
                  {t.label}
                  <span className={cn(
                    "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
                    tab === t.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Ticket list */}
            <div className="flex-1 divide-y divide-border/60 overflow-y-auto max-h-[420px]">
              {filteredTickets.length === 0 && (
                <p className="text-[12px] text-muted-foreground text-center py-10">Nenhum ticket encontrado.</p>
              )}
              {filteredTickets.map(ticket => (
                <Link
                  key={ticket.id}
                  to={`/support/tickets/${ticket.id}`}
                  className="flex flex-col gap-1 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-sans text-muted-foreground/60 shrink-0">{ticket.ticket_number}</span>
                      <Badge variant={STATUS_VARIANT[ticket.status]} className="text-[9px] h-4 px-1.5 shrink-0">
                        {STATUS_LABEL[ticket.status]}
                      </Badge>
                    </div>
                    <span className={cn("text-[10px] font-bold shrink-0", PRIORITY_COLOR[ticket.priority])}>
                      {PRIORITY_LABEL[ticket.priority]}
                    </span>
                  </div>
                  <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{ticket.description}</p>
                </Link>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border/60">
              <Link
                to="/support/tickets"
                className="text-[12px] text-primary hover:underline flex items-center gap-1"
              >
                Ver todos os tickets <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

