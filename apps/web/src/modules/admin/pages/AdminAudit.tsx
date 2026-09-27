import { useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { adminAuditService } from "../services/admin-audit.service";
import type { AuditAction } from "../types";
import { Search, ScrollText, Globe, Clock } from "lucide-react";

const ACTION_STYLE: Record<AuditAction, string> = {
  create:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  update:      "text-primary bg-primary/10 border-primary/20",
  delete:      "text-red-400 bg-red-500/10 border-red-500/20",
  login:       "text-muted-foreground bg-muted border-border",
  logout:      "text-muted-foreground bg-muted border-border",
  impersonate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  plan_change: "text-primary bg-primary/10 border-primary/30",
  suspend:     "text-red-400 bg-red-500/10 border-red-500/20",
  activate:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  export:      "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};
const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Criação", update: "Atualização", delete: "Exclusão",
  login: "Login", logout: "Logout", impersonate: "Impersonation",
  plan_change: "Mudança de Plano", suspend: "Suspensão",
  activate: "Ativação", export: "Exportação",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminAudit() {
  const [search, setSearch] = useState("");

  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => adminAuditService.list(),
  });
  const logs = auditQuery.data ?? [];

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(q) ||
      log.tenant_name.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      log.action.includes(q)
    );
  });

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">Registros e auditoria</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Trilha de auditoria e ações administrativas</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Eventos Totais",   value: logs.length },
            { label: "Hoje",             value: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length },
            { label: "Ações Críticas",   value: logs.filter(l => ["suspend","delete","impersonate"].includes(l.action)).length },
            { label: "Exportações",      value: logs.filter(l => l.action === "export").length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl mb-3 bg-muted">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, workspace, ação..."
            className="pl-9 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-audit"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ListSectionHeader
            title="Registros de auditoria"
            count={filtered.length}
            description="Acompanhe ações administrativas, usuários, workspaces e detalhes de auditoria"
            className="p-4"
          />
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {["Ação", "Entidade", "Usuário", "Tenant", "IP", "Detalhes", "Quando"].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground  tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((log) => (
                <TableRow key={log.id} className="border-border hover:bg-muted transition-colors" data-testid={`audit-${log.id}`}>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className={cn("text-[10px] border", ACTION_STYLE[log.action] ?? "text-muted-foreground bg-muted border-border")}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="text-[12px] font-medium text-muted-foreground">{log.entity}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-sans">#{log.entity_id.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <p className="text-[12px] text-muted-foreground">{log.user_name}</p>
                    <p className="text-[10px] text-muted-foreground">{log.user_email}</p>
                  </TableCell>
                  <TableCell className="py-3.5 text-[12px] text-muted-foreground">{log.tenant_name}</TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-1 text-[11px] font-sans text-muted-foreground">
                      <Globe className="h-3 w-3 shrink-0" />{log.ip_address}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-[11px] text-muted-foreground max-w-[150px] truncate">
                    {log.details ?? "—"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />{fmtDate(log.created_at)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {auditQuery.isLoading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <ScrollText className="h-8 w-8 text-muted-foreground animate-pulse" />
              <p className="text-[13px] text-muted-foreground">Carregando auditoria…</p>
            </div>
          ) : auditQuery.isError ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <ScrollText className="h-8 w-8 text-red-400" />
              <p className="text-[13px] text-muted-foreground">Falha ao carregar os registros de auditoria.</p>
              <button onClick={() => auditQuery.refetch()} className="text-[12px] text-primary hover:underline" data-testid="button-retry-audit">
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <ScrollText className="h-8 w-8 text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">Nenhum evento de auditoria</p>
            </div>
          ) : null}
          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="eventos"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
