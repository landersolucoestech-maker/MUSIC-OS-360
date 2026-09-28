import { useMemo, useState } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, Loader2, RotateCcw, Search,
} from "lucide-react";
import { useTransactions, type Transaction } from "@/modules/accounting/hooks/useTransactions";
import { formatCurrency } from "@/shared/lib/format-utils";
import { transactionCategoryLabel } from "@/modules/accounting/constants/transaction-constants";
import { useQuery } from "@tanstack/react-query";
import { fetchAllPages } from "@/shared/lib/exportAll";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { FeatureGate } from '@/shared/components/FeatureGate';
import { toNumber, sum } from "./profit-and-loss-calc";

function catLabel(cat: string) {
  return transactionCategoryLabel(cat);
}

function totalsByCategory(rows: Transaction[]): { category: string; amount: number }[] {
  const map: Record<string, number> = {};
  rows.forEach((t) => { const c = t.category ?? "outras"; map[c] = (map[c] ?? 0) + toNumber(t.amount); });
  return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCards({
  incomeTotal, expensesTotal, netProfit, netMargin,
}: {
  incomeTotal: number; expensesTotal: number; netProfit: number; netMargin: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Total</p>
              <p className="text-lg font-bold text-green-600" data-testid="metric-receitas">{formatCurrency(incomeTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg"><TrendingDown className="h-5 w-5 text-red-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Despesa Total</p>
              <p className={`text-lg font-bold ${expensesTotal > 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="metric-despesas">{expensesTotal > 0 ? formatCurrency(-expensesTotal) : formatCurrency(expensesTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
              <DollarSign className={`h-5 w-5 ${netProfit >= 0 ? "text-primary" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className={`text-lg font-bold ${netProfit > 0 ? "text-green-600" : netProfit < 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="metric-lucro">
                {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><RotateCcw className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Margem Líquida</p>
              <p className={`text-lg font-bold ${netMargin >= 0 ? "text-primary" : "text-destructive"}`} data-testid="metric-margem">
                {netMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── P&L statement (company) ─────────────────────────────────────────────────

interface CategoryTotal { category: string; amount: number }

function PlCompanyTable({
  incomeByCategory, expensesByCategory,
  incomeTotal, expensesTotal, netProfit, netMargin,
}: {
  incomeByCategory: CategoryTotal[];
  expensesByCategory: CategoryTotal[];
  incomeTotal: number; expensesTotal: number; netProfit: number; netMargin: number;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ListSectionHeader
          title="Demonstrativo de Resultado (P&L)"
          count={incomeByCategory.length + expensesByCategory.length}
          description="Receitas e despesas por categoria no período"
          className="px-6 pt-6"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-no-sort="true">Categoria</TableHead>
              <TableHead className="text-right" data-no-sort="true">Valor</TableHead>
              <TableHead className="text-right" data-no-sort="true">% Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-green-500/5">
              <TableCell colSpan={3} className="font-semibold text-green-700 text-xs  tracking-wider">Receitas</TableCell>
            </TableRow>
            {incomeByCategory.map((r) => (
              <TableRow key={r.category}>
                <TableCell className="pl-8 text-foreground">{catLabel(r.category)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(r.amount)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {incomeTotal > 0 ? ((r.amount / incomeTotal) * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-green-500/5 border-b-2">
              <TableCell className="font-bold text-foreground">Total Receitas</TableCell>
              <TableCell className="text-right font-bold text-green-600">{formatCurrency(incomeTotal)}</TableCell>
              <TableCell className="text-right font-bold text-muted-foreground">100.0%</TableCell>
            </TableRow>

            <TableRow className="bg-red-500/5">
              <TableCell colSpan={3} className="font-semibold text-destructive text-xs  tracking-wider">Despesas</TableCell>
            </TableRow>
            {expensesByCategory.map((d) => (
              <TableRow key={d.category}>
                <TableCell className="pl-8 text-foreground">{catLabel(d.category)}</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(-d.amount)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {incomeTotal > 0 ? ((d.amount / incomeTotal) * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-red-500/5 border-b-2">
              <TableCell className="font-bold text-foreground">Total Despesas</TableCell>
              <TableCell className="text-right font-bold text-destructive">{formatCurrency(-expensesTotal)}</TableCell>
              <TableCell className="text-right font-bold text-muted-foreground">
                {incomeTotal > 0 ? ((expensesTotal / incomeTotal) * 100).toFixed(1) : "0.0"}%
              </TableCell>
            </TableRow>

            <TableRow className={netProfit >= 0 ? "bg-primary/5 border-t-2" : "bg-destructive/5 border-t-2"}>
              <TableCell className="font-bold text-lg text-foreground">Lucro Líquido</TableCell>
              <TableCell className={`text-right font-bold text-lg ${netProfit > 0 ? "text-green-600" : netProfit < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {formatCurrency(netProfit)}
              </TableCell>
              <TableCell className={`text-right font-bold ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                {netMargin.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfitAndLoss() {
  const { transactions, isLoading } = useTransactions();
  // Every artist of the tenant (paged sweep): the plain list stops at the API's
  // default page and would leave names of the remaining artists unresolved.
  const { data: artists = [] } = useQuery({
    queryKey: [...QUERY_KEYS.ARTISTS, "all-names"],
    queryFn: async () => (await fetchAllPages<{ id: string; stage_name?: string | null }>("artists")).items,
  });
  const [activeTab, setActiveTab] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [financialFilter, setFinancialFilter] = useState<"all" | "revenue" | "expense" | "profit">("all");

  // Filters by search (description/category), date range and financial type — the base of every view.
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return transactions.filter((t) => {
      const transactionDate = String(t.transaction_date ?? "").slice(0, 10);
      if (startDate && transactionDate && transactionDate < startDate) return false;
      if (endDate && transactionDate && transactionDate > endDate) return false;
      if (financialFilter === "revenue" && t.type !== "revenue") return false;
      if (financialFilter === "expense" && t.type !== "expense") return false;
      // "profit" and "all" keep revenues and expenses (the net result is consolidated in the KPIs).
      if (!term) return true;
      return (
        String(t.description ?? "").toLowerCase().includes(term) ||
        catLabel(String(t.category ?? "")).toLowerCase().includes(term)
      );
    });
  }, [transactions, searchTerm, startDate, endDate, financialFilter]);

  const income = useMemo(() => filteredTransactions.filter((t) => t.type === "revenue"), [filteredTransactions]);
  const expenses = useMemo(() => filteredTransactions.filter((t) => t.type === "expense"), [filteredTransactions]);

  const incomeTotal = sum(income, "amount");
  const expensesTotal = sum(expenses, "amount");
  const netProfit = incomeTotal - expensesTotal;
  const netMargin = incomeTotal > 0 ? (netProfit / incomeTotal) * 100 : 0;

  const incomeByCategory = useMemo(() => totalsByCategory(income), [income]);
  const expensesByCategory = useMemo(() => totalsByCategory(expenses), [expenses]);

  // ── P&L per project (each transaction = 1 project) ─────────────────────────
  const plByProject = useMemo(() =>
    filteredTransactions
      .map((t) => {
        const amount = toNumber(t.amount);
        return {
          id: t.id,
          name: t.description ?? "—",
          category: t.category ?? "—",
          revenue: t.type === "revenue" ? amount : 0,
          expense: t.type === "expense" ? amount : 0,
          result: t.type === "revenue" ? amount : -amount,
        };
      })
      .sort((a, b) => b.result - a.result),
  [filteredTransactions]);

  // ── P&L per artist ──────────────────────────────────────────────────────────
  // Groups by the transaction's artist_id; the API does not embed the artist in a
  // transaction, so the display name is resolved from the tenant's artist list.
  const artistNameById = useMemo(
    () => new Map(artists.map((a) => [a.id, a.stage_name ?? ""] as const)),
    [artists],
  );
  const plByArtist = useMemo(() => {
    const byArtist = new Map<string, { id: string; name: string; totalRevenue: number; totalExpenses: number }>();
    for (const t of filteredTransactions) {
      const artistId = t.artist_id;
      if (!artistId) continue;
      const entry = byArtist.get(artistId) ?? {
        id: artistId,
        name: artistNameById.get(artistId) || "Artista não encontrado",
        totalRevenue: 0,
        totalExpenses: 0,
      };
      if (t.type === "revenue") entry.totalRevenue += toNumber(t.amount);
      else if (t.type === "expense") entry.totalExpenses += toNumber(t.amount);
      byArtist.set(artistId, entry);
    }
    return Array.from(byArtist.values())
      .map((a) => ({ ...a, profit: a.totalRevenue - a.totalExpenses, margin: a.totalRevenue > 0 ? ((a.totalRevenue - a.totalExpenses) / a.totalRevenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredTransactions, artistNameById]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const plCompanyProps = { incomeByCategory, expensesByCategory, incomeTotal, expensesTotal, netProfit, netMargin };

  return (
    <FeatureGate feature="moduleAccounting" featureName="Contabilidade">
    <MainLayout
      title="Contabilidade"
    >
      <div className="space-y-6">

        {/* ── Toolbar: search + date pickers (right-aligned) ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          {/* Date picker — always immediately to the left of the search */}
          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            placeholder="Data início"
            className="h-8 text-xs w-[150px]"
            data-testid="datepicker-start-date"
          />
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            placeholder="Data fim"
            className="h-8 text-xs w-[150px]"
            data-testid="datepicker-end-date"
          />
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou categoria…"
              className="pl-9 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-contabilidade"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={financialFilter} onValueChange={(v) => setFinancialFilter(v as typeof financialFilter)}>
              <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] bg-card border-border" data-testid="select-financial-filter">
                <SelectValue placeholder="Financeiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="revenue">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
                <SelectItem value="profit">Lucro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs — always visible above the tabs */}
        <KpiCards incomeTotal={incomeTotal} expensesTotal={expensesTotal} netProfit={netProfit} netMargin={netMargin} />

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-contabilidade">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="todos" data-testid="tab-todos">Todos</TabsTrigger>
            <TabsTrigger value="empresa" data-testid="tab-empresa">P&amp;L Empresa</TabsTrigger>
            <TabsTrigger value="projetos" data-testid="tab-projetos">P&amp;L Projetos</TabsTrigger>
            <TabsTrigger value="artistas" data-testid="tab-artistas">P&amp;L Artistas</TabsTrigger>
          </TabsList>

          {/* ── ALL: every view stacked ──────────────────────────────── */}
          <TabsContent value="todos" className="space-y-6 mt-6">
            <PlCompanyTable {...plCompanyProps} />

            {/* Projects (compact) */}
            <Card>
              <CardContent className="p-0 max-h-64 overflow-y-auto">
                <ListSectionHeader
                  title="P&L por Projeto"
                  count={plByProject.length}
                  description="Resultado por lançamento e operação"
                  className="px-6 pt-6"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Projeto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plByProject.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-xs truncate">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{catLabel(p.category)}</TableCell>
                        <TableCell className="text-right text-green-600">{p.revenue > 0 ? formatCurrency(p.revenue) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.expense > 0 ? formatCurrency(-p.expense) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${p.result > 0 ? "text-green-600" : p.result < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.result >= 0 ? "+" : ""}{formatCurrency(p.result)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Artists (compact) */}
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Artista"
                  count={plByArtist.length}
                  description="Resultado por artista no período"
                  className="px-6 pt-6"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artista</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plByArtist.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-right text-green-600">{a.totalRevenue > 0 ? formatCurrency(a.totalRevenue) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{a.totalExpenses > 0 ? formatCurrency(-a.totalExpenses) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${a.profit > 0 ? "text-green-600" : a.profit < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {a.profit >= 0 ? "+" : ""}{formatCurrency(a.profit)}
                        </TableCell>
                        <TableCell className={`text-right ${a.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                          {a.margin.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── COMPANY P&L ──────────────────────────────────────────────── */}
          <TabsContent value="empresa" className="space-y-4 mt-6">
            <PlCompanyTable {...plCompanyProps} />
          </TabsContent>

          {/* ── PROJECTS P&L ─────────────────────────────────────────────── */}
          <TabsContent value="projetos" className="space-y-4 mt-6">
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Projeto"
                  count={plByProject.length}
                  description="Resultado financeiro por lançamento e operação"
                  className="px-6 pt-6"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Projeto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plByProject.map((p) => (
                      <TableRow key={p.id} data-testid={`row-projeto-${p.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{catLabel(p.category)}</TableCell>
                        <TableCell className="text-right text-green-600">{p.revenue > 0 ? formatCurrency(p.revenue) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.expense > 0 ? formatCurrency(-p.expense) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${p.result > 0 ? "text-green-600" : p.result < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.result >= 0 ? "+" : ""}{formatCurrency(p.result)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-muted/40">
                      <TableCell className="font-bold" colSpan={2}>Total Geral</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatCurrency(incomeTotal)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{formatCurrency(-expensesTotal)}</TableCell>
                      <TableCell className={`text-right font-bold ${netProfit > 0 ? "text-green-600" : netProfit < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ARTISTS P&L ──────────────────────────────────────────────── */}
          <TabsContent value="artistas" className="space-y-4 mt-6">
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Artista"
                  count={plByArtist.length}
                  description="Receitas, despesas e resultado por artista"
                  className="px-6 pt-6"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artista</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plByArtist.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                          Nenhum artista com transações registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {plByArtist.map((a) => (
                          <TableRow key={a.id} data-testid={`row-artista-${a.id}`}>
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-right text-green-600">{a.totalRevenue > 0 ? formatCurrency(a.totalRevenue) : "—"}</TableCell>
                            <TableCell className="text-right text-destructive">{a.totalExpenses > 0 ? formatCurrency(-a.totalExpenses) : "—"}</TableCell>
                            <TableCell className={`text-right font-bold ${a.profit > 0 ? "text-green-600" : a.profit < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {a.profit >= 0 ? "+" : ""}{formatCurrency(a.profit)}
                            </TableCell>
                            <TableCell className={`text-right text-sm ${a.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                              {a.margin.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 bg-muted/40">
                          <TableCell className="font-bold">Total (artistas)</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(sum(plByArtist, "totalRevenue"))}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{formatCurrency(-sum(plByArtist, "totalExpenses"))}</TableCell>
                          <TableCell className={`text-right font-bold ${sum(plByArtist, "profit") > 0 ? "text-green-600" : sum(plByArtist, "profit") < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {sum(plByArtist, "profit") >= 0 ? "+" : ""}{formatCurrency(sum(plByArtist, "profit"))}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">—</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </MainLayout>
    </FeatureGate>
  );
}

