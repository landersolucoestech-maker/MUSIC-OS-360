import { useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { adminSupportService } from "../services/admin-support.service";
import type { TicketStatus, TicketPriority } from "../types";
import { Search, HeadphonesIcon, Clock, CheckCircle2, AlertCircle, Pause } from "lucide-react";

const STATUS_CFG: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open:        { label: "Aberto",      color: "text-primary",    bg: "bg-primary/10 border-primary/20" },
  in_progress: { label: "Em andamento",color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20" },
  resolved:    { label: "Resolvido",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  closed:      { label: "Fechado",     color: "text-muted-foreground",    bg: "bg-muted border-border" },
  waiting:     { label: "Aguardando",  color: "text-primary",  bg: "bg-primary/10 border-primary/30" },
};
const PRIORITY_CFG: Record<TicketPriority, { label: string; color: string }> = {
  critical: { label: "Crítica", color: "text-red-400" },
  high:     { label: "Alta",    color: "text-orange-400" },
  medium:   { label: "Média",   color: "text-yellow-400" },
  low:      { label: "Baixa",   color: "text-muted-foreground" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function AdminSupport() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const ticketsQuery = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: () => adminSupportService.list(),
  });
  const tickets = ticketsQuery.data ?? [];

  const filtered = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.tenant_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const open       = tickets.filter(t => t.status === "open").length;
  const inProgress = tickets.filter(t => t.status === "in_progress").length;
  const resolved   = tickets.filter(t => t.status === "resolved").length;
  const waiting    = tickets.filter(t => t.status === "waiting").length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">Central de suporte</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Gestão global de tickets de suporte</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Abertos",      value: open,       icon: AlertCircle,    color: "text-primary",    bg: "bg-primary/10" },
            { label: "Em Andamento", value: inProgress, icon: Clock,          color: "text-yellow-400",  bg: "bg-yellow-500/10" },
            { label: "Aguardando",   value: waiting,    icon: Pause,          color: "text-primary",  bg: "bg-primary/10" },
            { label: "Resolvidos",   value: resolved,   icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl mb-3", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar tickets..." className="pl-9 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-tickets" />
          </div>
          <div className="flex gap-1">
            {[
              { key: "all", label: "Todos" },
              { key: "open", label: "Abertos" },
              { key: "in_progress", label: "Em Andamento" },
              { key: "resolved", label: "Resolvidos" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  filter === key
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-muted-foreground hover:bg-muted",
                )}
                data-testid={`filter-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ListSectionHeader
            title="Lista de Tickets"
            count={filtered.length}
            description="Acompanhe tickets, workspaces, prioridades e responsáveis"
            className="p-4"
          />
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {["#", "Assunto", "Tenant", "Prioridade", "Status", "Atribuído", "Criado"].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground  tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const sc = STATUS_CFG[t.status];
                const pc = PRIORITY_CFG[t.priority];
                return (
                  <TableRow key={t.id} className="border-border hover:bg-muted transition-colors" data-testid={`ticket-${t.id}`}>
                    <TableCell className="py-3.5 font-sans text-[11px] text-muted-foreground">#{t.id.slice(-4)}</TableCell>
                    <TableCell className="py-3.5">
                      <p className="text-[13px] font-medium text-foreground">{t.subject}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t.category}</p>
                    </TableCell>
                    <TableCell className="py-3.5 text-[12px] text-muted-foreground">{t.tenant_name}</TableCell>
                    <TableCell className="py-3.5">
                      <span className={cn("text-[12px] font-semibold", pc.color)}>{pc.label}</span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={cn("text-[10px] border", sc.bg, sc.color)}>
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {t.assigned_to ? (
                        <div className="flex items-center gap-1.5">
                          <HeadphonesIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[12px] text-muted-foreground">{t.assigned_to}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />{fmtDate(t.created_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {ticketsQuery.isLoading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <HeadphonesIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
              <p className="text-[13px] text-muted-foreground">Carregando tickets…</p>
            </div>
          ) : ticketsQuery.isError ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-[13px] text-muted-foreground">Falha ao carregar tickets de suporte.</p>
              <button onClick={() => ticketsQuery.refetch()} className="text-[12px] text-primary hover:underline" data-testid="button-retry-tickets">
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <HeadphonesIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">Nenhum ticket encontrado</p>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}

