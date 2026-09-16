/**
 * settings/pages/AuditTrail.tsx
 *
 * Audit Trail — historial de todas as mutações auditadas no sistema.
 * Acesso restrito a OWNER/ADMIN.
 *
 *
 * Filtros: search free-text, entity_type, action_group, date range (from/to)
 */

import { Fragment, useState, useMemo } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/shared/ui/card";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import {
  ShieldCheck, Search, ChevronDown, ChevronRight,
  User, Clock, RefreshCw, Loader2, X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { useAuditTrail, type AuditLogEntry } from "@/modules/settings/hooks/useAuditTrail";

// ── Action badge helpers ───────────────────────────────────────────────────────

function getActionBadge(action: string) {
  if (
    action.endsWith(".created")  ||
    action.endsWith(".connected")  ||
    action.endsWith(".confirmed")  ||
    action.endsWith(".checkout_started")
  ) {
    return <Badge variant="success">{action}</Badge>;
  }
  if (action.endsWith(".updated")) {
    return <Badge variant="info">{action}</Badge>;
  }
  if (action.endsWith(".deleted") || action.endsWith(".cancelled") || action.endsWith(".disconnected")) {
    return <Badge variant="danger">{action}</Badge>;
  }
  return <Badge variant="neutral">{action}</Badge>;
}

function getRoleBadge(role: string | null) {
  if (!role) return null;
  const variants: Record<string, BadgeVariant> = {
    owner:  "info",
    admin:  "warning",
    editor: "info",
    viewer: "neutral",
  };
  return <Badge variant={variants[role] ?? "neutral"}>{role}</Badge>;
}

// ── Diff viewer ───────────────────────────────────────────────────────────────

function DiffViewer({ diff, before, after }: {
  diff:   AuditLogEntry["diff"];
  before: AuditLogEntry["before"];
  after:  AuditLogEntry["after"];
}) {
  if (!diff && !before && !after) {
    return <p className="text-xs text-muted-foreground italic">Sem dados de snapshot disponíveis.</p>;
  }

  if (diff && Object.keys(diff).length > 0) {
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-[140px_1fr_1fr] gap-2 mb-2 pb-1 border-b border-border">
          <span className="text-[10px] text-muted-foreground font-semibold">CAMPO</span>
          <span className="text-[10px] text-muted-foreground font-semibold">ANTES</span>
          <span className="text-[10px] text-muted-foreground font-semibold">DEPOIS</span>
        </div>
        {Object.entries(diff).map(([field, change]) => (
          <div key={field} className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs">
            <span className="font-sans text-muted-foreground truncate">{field}</span>
            <span className="font-sans bg-destructive/10 text-destructive px-1 rounded truncate">
              {change.from === null || change.from === undefined
                ? <em>null</em>
                : String(change.from)}
            </span>
            <span className="font-sans bg-success/10 text-success px-1 rounded truncate">
              {change.to === null || change.to === undefined
                ? <em>null</em>
                : String(change.to)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {before && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">ANTES</p>
          <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-32 font-sans">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      )}
      {after && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">DEPOIS</p>
          <pre className="text-xs bg-success/5 rounded p-2 overflow-auto max-h-32 font-sans">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditTrail() {
  const [search,       setSearch]       = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const { data: entries = [], isLoading, refetch } = useAuditTrail({
    fromDate: fromDate || undefined,
    toDate:   toDate   || undefined,
  });

  const entities = useMemo(() => {
    const set = new Set(entries.map(e => e.entity));
    return ["all", ...Array.from(set).sort()];
  }, [entries]);

  const actionGroups = ["all", "created", "updated", "deleted", "connected", "disconnected", "other"];

  const filtered = useMemo(() => {
    return entries.filter(entry => {
      const matchSearch =
        !search ||
        entry.action.toLowerCase().includes(search.toLowerCase()) ||
        (entry.user_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (entry.entity_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (entry.correlation_id ?? "").toLowerCase().includes(search.toLowerCase());

      const matchEntity = entityFilter === "all" || entry.entity === entityFilter;

      const matchAction =
        actionFilter === "all" ||
        (actionFilter === "other"
          ? !["created", "updated", "deleted", "connected", "disconnected"].some(
              s => entry.action.endsWith(`.${s}`)
            )
          : entry.action.endsWith(`.${actionFilter}`));

      const entryDate = new Date(entry.created_at);
      const matchFrom = !fromDate || entryDate >= new Date(fromDate);
      const matchTo   = !toDate   || entryDate <= new Date(toDate + "T23:59:59Z");

      return matchSearch && matchEntity && matchAction && matchFrom && matchTo;
    });
  }, [entries, search, entityFilter, actionFilter, fromDate, toDate]);

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  const hasActiveFilters = search || entityFilter !== "all" || actionFilter !== "all" || fromDate || toDate;

  const clearFilters = () => {
    setSearch("");
    setEntityFilter("all");
    setActionFilter("all");
    setFromDate("");
    setToDate("");
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Audit Trail</h1>
              <p className="text-sm text-muted-foreground">
                Histórico imutável de todas as operações críticas — restrito a Proprietário/Admin
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-audit-refresh"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total de eventos",    value: entries.length, sub: "audit logs" },
            { label: "Criações",            value: entries.filter(e => e.action.endsWith(".created")).length,   sub: "endpoints" },
            { label: "Atualizações",       value: entries.filter(e => e.action.endsWith(".updated")).length,   sub: "modificações" },
            {
              label: "Eliminações/Cancel.",
              value: entries.filter(e =>
                e.action.endsWith(".deleted") || e.action.endsWith(".cancelled")
              ).length,
              sub: "operações destrutivas",
            },
          ].map(stat => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="w-4 h-4" />
                Filtros
              </CardTitle>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={clearFilters}
                  data-testid="button-audit-clear-filters"
                >
                  <X className="w-3 h-3" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {/* Seletor de datas — sempre imediatamente à esquerda da busca */}
              <DatePickerField
                value={fromDate}
                onChange={setFromDate}
                placeholder="Data início"
                className="h-8 text-xs w-[150px]"
              />
              <DatePickerField
                value={toDate}
                onChange={setToDate}
                placeholder="Data fim"
                className="h-8 text-xs w-[150px]"
              />

              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-audit-search"
                  placeholder="Pesquisar por acção, actor, ID, correlation…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>

              {/* Entity */}
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger data-testid="select-audit-entity" className="h-8 text-sm w-[160px]">
                  <SelectValue placeholder="Entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e} value={e}>
                      {e === "all" ? "Todas as entidades" : e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="select-audit-action" className="h-8 text-sm w-[160px]">
                  <SelectValue placeholder="Tipo de acção" />
                </SelectTrigger>
                <SelectContent>
                  {actionGroups.map(a => (
                    <SelectItem key={a} value={a}>
                      {a === "all" ? "Todas as acções" : a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Audit log table */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            <ListSectionHeader
              title="Eventos"
              count={filtered.length}
              description="Clique numa linha para expandir o diff before/after"
              className="px-6 pt-6"
            />
            <div className="rounded-b-lg overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">A carregar audit trail…</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="w-[20px]" />
                      <TableHead className="text-xs w-[160px]">Timestamp</TableHead>
                      <TableHead className="text-xs w-[140px]">Actor</TableHead>
                      <TableHead className="text-xs w-[80px]">Role</TableHead>
                      <TableHead className="text-xs">Acção</TableHead>
                      <TableHead className="text-xs w-[100px]">Entidade</TableHead>
                      <TableHead className="text-xs w-[120px]">ID</TableHead>
                      <TableHead className="text-xs w-[70px]">Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                          Nenhum evento encontrado com os filtros actuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageItems.map(entry => (
                        <Fragment key={entry.id}>
                          <TableRow
                            data-testid={`row-audit-${entry.id}`}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleExpand(entry.id)}
                          >
                            <TableCell className="py-2 pl-3 pr-0">
                              {expandedId === entry.id
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              }
                            </TableCell>
                            <TableCell className="py-2 text-xs font-sans text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                {format(new Date(entry.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="font-sans truncate max-w-[110px]" title={entry.user_id ?? undefined}>
                                  {entry.user_id ?? <em className="text-muted-foreground">system</em>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              {getRoleBadge(entry.actor_role)}
                            </TableCell>
                            <TableCell className="py-2">
                              {getActionBadge(entry.action)}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-medium capitalize">
                              {entry.entity}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-sans text-muted-foreground truncate max-w-[110px]">
                              {entry.entity_id ?? <em>—</em>}
                            </TableCell>
                            <TableCell className="py-2">
                              {entry.http_method && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    entry.http_method === "DELETE" ? "text-destructive border-destructive/30" :
                                    entry.http_method === "POST"   ? "text-success border-success/30" :
                                    entry.http_method === "PATCH"  ? "text-primary border-primary/30" : ""
                                  }`}
                                >
                                  {entry.http_method}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Expanded diff panel */}
                          {expandedId === entry.id && (
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={8} className="py-3 px-6">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                    {entry.ip_address && (
                                      <span>IP: <code className="font-sans">{entry.ip_address}</code></span>
                                    )}
                                    {entry.http_path && (
                                      <span>Path: <code className="font-sans">{entry.http_path}</code></span>
                                    )}
                                    {entry.correlation_id && (
                                      <span>Correlation: <code className="font-sans">{entry.correlation_id}</code></span>
                                    )}
                                  </div>
                                  <DiffViewer
                                    diff={entry.diff}
                                    before={entry.before}
                                    after={entry.after}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {filtered.length > 0 && (
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="eventos"
              />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Audit trail append-only — nenhum registo pode ser modificado ou eliminado após criação.
        </p>
      </div>
    </MainLayout>
  );
}


