import { useState } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { useRequests, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "../hooks/useSupport";
import type { SupportRequest } from "../types";
import {
  ThumbsUp, Plus, Search, Inbox,
  CheckCircle2, Clock,
} from "lucide-react";

const STATUS_COLOR: Record<SupportRequest["status"], string> = {
  pending:   "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  in_review: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  approved:  "border-green-500/30 text-green-400 bg-green-500/10",
  rejected:  "border-border text-muted-foreground",
  done:      "border-primary/30 text-primary bg-primary/10",
};

const TYPE_COLOR: Record<SupportRequest["type"], string> = {
  feature:     "text-primary",
  bug:         "text-red-400",
  question:    "text-blue-400",
  billing:     "text-green-400",
  integration: "text-cyan-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function SupportRequests() {
  const { requests, addRequest, upvote, isCreating } = useRequests();
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy]           = useState<"votes" | "date">("votes");
  const [showModal, setShowModal]     = useState(false);
  const [votedIds, setVotedIds]       = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "feature" as SupportRequest["type"],
    priority: "medium" as SupportRequest["priority"],
  });

  const filtered = requests
    .filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) =>
      sortBy === "votes"
        ? b.votes - a.votes
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  async function handleVote(id: string) {
    if (votedIds.has(id)) return;
    // Marca localmente antes de confirmar (evita duplo-clique durante o
    // round-trip); reverte se a chamada falhar, para não travar o voto real.
    setVotedIds((prev) => new Set([...prev, id]));
    try {
      await upvote(id);
    } catch {
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    try {
      await addRequest({
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
      });
      setShowModal(false);
      setForm({ title: "", description: "", type: "feature", priority: "medium" });
    } catch {
      // Erro já reportado via toast em useRequests; mantém o modal aberto e o
      // formulário preenchido para o usuário poder tentar de novo.
    }
  }

  const totalVotes = requests.reduce((s, r) => s + r.votes, 0);
  const approved   = requests.filter((r) => r.status === "approved" || r.status === "in_review").length;
  const done       = requests.filter((r) => r.status === "done").length;

  return (
    <MainLayout
      title="Solicitações"
      description="Funcionalidades e melhorias solicitadas pela comunidade"
      actions={
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowModal(true)} data-testid="button-nova-solicitacao">
          <Plus className="h-3.5 w-3.5" /> Nova Solicitação
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Solicitações",  value: requests.length, icon: Inbox,        color: "text-blue-400",   bg: "bg-blue-500/10" },
            { label: "Votos Totais",  value: totalVotes,      icon: ThumbsUp,     color: "text-primary",    bg: "bg-primary/10"  },
            { label: "Em Análise",    value: approved,         icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Concluídas",    value: done,             icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-4">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl mb-2", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar solicitações..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-requests"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]" data-testid="select-type-filter">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.entries(REQUEST_TYPE_LABELS) as [SupportRequest["type"], string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.entries(REQUEST_STATUS_LABELS) as [SupportRequest["status"], string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-border/60 overflow-hidden h-8 shrink-0">
            <button
              className={cn(
                "flex items-center gap-1 px-3 text-xs transition-colors",
                sortBy === "votes" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSortBy("votes")}
              data-testid="sort-votes"
            >
              <ThumbsUp className="h-3 w-3" /> Votos
            </button>
            <div className="w-px bg-border/60" />
            <button
              className={cn(
                "flex items-center gap-1 px-3 text-xs transition-colors",
                sortBy === "date" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSortBy("date")}
              data-testid="sort-date"
            >
              <Clock className="h-3 w-3" /> Data
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-border/60 bg-card">
            <Inbox className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-[13px] font-medium text-muted-foreground">Nenhuma solicitação encontrada</p>
            <Button size="sm" variant="outline" className="mt-4 text-xs" onClick={() => setShowModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar solicitação
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const hasVoted = votedIds.has(req.id);
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-border/60 bg-card p-4 flex gap-4"
                  data-testid={`card-request-${req.id}`}
                >
                  <button
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 w-14 shrink-0 rounded-xl border py-2 transition-colors",
                      hasVoted
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary",
                    )}
                    onClick={() => handleVote(req.id)}
                    disabled={hasVoted}
                    data-testid={`vote-${req.id}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="text-[12px] font-bold">{req.votes}</span>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-foreground leading-snug">{req.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("text-[10px] font-medium", TYPE_COLOR[req.type])}>
                          {REQUEST_TYPE_LABELS[req.type]}
                        </span>
                        <Badge variant="outline" className={cn("text-[10px] border", STATUS_COLOR[req.status])}>
                          {REQUEST_STATUS_LABELS[req.status]}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground line-clamp-2 mb-2">{req.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span>{formatDate(req.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Nova Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input
                placeholder="Descreva brevemente a solicitação..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="text-sm"
                data-testid="input-request-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as SupportRequest["type"] })}>
                  <SelectTrigger className="text-xs h-8" data-testid="select-request-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(REQUEST_TYPE_LABELS) as [SupportRequest["type"], string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as SupportRequest["priority"] })}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">Baixa</SelectItem>
                    <SelectItem value="medium" className="text-xs">Média</SelectItem>
                    <SelectItem value="high" className="text-xs">Alta</SelectItem>
                    <SelectItem value="critical" className="text-xs">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Explique em detalhes sua solicitação..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-sm resize-none"
                rows={4}
                data-testid="textarea-request-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!form.title.trim() || isCreating} data-testid="button-submit-request">
              {isCreating ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

