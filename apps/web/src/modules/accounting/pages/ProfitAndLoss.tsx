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
import { useTransactions } from "@/modules/accounting/hooks/useTransactions";
import { formatCurrency } from "@/shared/lib/format-utils";
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import { FeatureGate } from '@/shared/components/FeatureGate';
import { toNumber, sum } from "./profit-and-loss-calc";

const CATEGORIA_LABELS: Record<string, string> = {
  "recebimentos externos de direitos": "Recebimentos externos de direitos",
  "cachê": "Cachê de Shows",
  licenciamento: "Licenciamento",
  distribuicao: "Distribuição",
  patrocinio: "Patrocínio",
  adiantamento_artista: "Adiantamento a Artista",
  producao_musical: "Produção Musical",
  marketing_digital: "Marketing Digital",
  marketing_offline: "Marketing Offline",
  juridico: "Honorários Jurídicos",
  administrativo: "Administrativo",
  folha_pagamento: "Folha de Pagamento",
  producao_audiovisual: "Produção Audiovisual",
  infraestrutura: "Infraestrutura",
  software: "Software",
  seguros: "Seguros",
  distribuicao_digital: "Distribuição Digital",
};

function catLabel(cat: string) {
  return CATEGORIA_LABELS[cat] ?? formatCategoryLabel(cat);
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCards({
  totalReceitas, totalDespesas, lucroLiquido, margemLiquida,
}: {
  totalReceitas: number; totalDespesas: number; lucroLiquido: number; margemLiquida: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Total</p>
              <p className="text-lg font-bold text-green-600" data-testid="metric-receitas">{formatCurrency(totalReceitas)}</p>
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
              <p className={`text-lg font-bold ${totalDespesas > 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="metric-despesas">{totalDespesas > 0 ? formatCurrency(-totalDespesas) : formatCurrency(totalDespesas)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${lucroLiquido >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
              <DollarSign className={`h-5 w-5 ${lucroLiquido >= 0 ? "text-primary" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className={`text-lg font-bold ${lucroLiquido > 0 ? "text-green-600" : lucroLiquido < 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="metric-lucro">
                {lucroLiquido >= 0 ? "+" : ""}{formatCurrency(lucroLiquido)}
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
              <p className={`text-lg font-bold ${margemLiquida >= 0 ? "text-primary" : "text-destructive"}`} data-testid="metric-margem">
                {margemLiquida.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Demonstrativo P&L (empresa) ───────────────────────────────────────────────

function PLEmpresaTable({
  receitasPorCategoria, despesasPorCategoria,
  totalReceitas, totalDespesas, lucroLiquido, margemLiquida,
}: {
  receitasPorCategoria: { categoria: string; valor: number }[];
  despesasPorCategoria: { categoria: string; valor: number }[];
  totalReceitas: number; totalDespesas: number; lucroLiquido: number; margemLiquida: number;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ListSectionHeader
          title="Demonstrativo de Resultado (P&L)"
          count={receitasPorCategoria.length + despesasPorCategoria.length}
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
            {receitasPorCategoria.map((r) => (
              <TableRow key={r.categoria}>
                <TableCell className="pl-8 text-foreground">{catLabel(r.categoria)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(r.valor)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {totalReceitas > 0 ? ((r.valor / totalReceitas) * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-green-500/5 border-b-2">
              <TableCell className="font-bold text-foreground">Total Receitas</TableCell>
              <TableCell className="text-right font-bold text-green-600">{formatCurrency(totalReceitas)}</TableCell>
              <TableCell className="text-right font-bold text-muted-foreground">100.0%</TableCell>
            </TableRow>

            <TableRow className="bg-red-500/5">
              <TableCell colSpan={3} className="font-semibold text-destructive text-xs  tracking-wider">Despesas</TableCell>
            </TableRow>
            {despesasPorCategoria.map((d) => (
              <TableRow key={d.categoria}>
                <TableCell className="pl-8 text-foreground">{catLabel(d.categoria)}</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(-d.valor)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {totalReceitas > 0 ? ((d.valor / totalReceitas) * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-red-500/5 border-b-2">
              <TableCell className="font-bold text-foreground">Total Despesas</TableCell>
              <TableCell className="text-right font-bold text-destructive">{formatCurrency(-totalDespesas)}</TableCell>
              <TableCell className="text-right font-bold text-muted-foreground">
                {totalReceitas > 0 ? ((totalDespesas / totalReceitas) * 100).toFixed(1) : "0.0"}%
              </TableCell>
            </TableRow>

            <TableRow className={lucroLiquido >= 0 ? "bg-primary/5 border-t-2" : "bg-destructive/5 border-t-2"}>
              <TableCell className="font-bold text-lg text-foreground">Lucro Líquido</TableCell>
              <TableCell className={`text-right font-bold text-lg ${lucroLiquido > 0 ? "text-green-600" : lucroLiquido < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {formatCurrency(lucroLiquido)}
              </TableCell>
              <TableCell className={`text-right font-bold ${lucroLiquido >= 0 ? "text-primary" : "text-destructive"}`}>
                {margemLiquida.toFixed(1)}%
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
  const [activeTab, setActiveTab] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [financialFilter, setFinancialFilter] = useState<"todos" | "receitas" | "despesas" | "lucro">("todos");

  // Filtra por busca (descrição/categoria), intervalo de datas e type financeiro — base de todas as visões.
  const filteredTransacoes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return transactions.filter((t: any) => {
      const data = String(t.data ?? "").slice(0, 10);
      if (startDate && data && data < startDate) return false;
      if (endDate && data && data > endDate) return false;
      if (financialFilter === "receitas" && t.type !== "receita") return false;
      if (financialFilter === "despesas" && t.type !== "despesa") return false;
      // "lucro" e "todos" mantêm receitas e despesas (o resultado líquido é consolidado nos KPIs).
      if (!term) return true;
      return (
        String(t.descricao ?? "").toLowerCase().includes(term) ||
        catLabel(String(t.categoria ?? "")).toLowerCase().includes(term)
      );
    });
  }, [transactions, searchTerm, startDate, endDate, financialFilter]);

  const receitas = useMemo(() => filteredTransacoes.filter((t: any) => t.type === "receita"), [filteredTransacoes]);
  const despesas = useMemo(() => filteredTransacoes.filter((t: any) => t.type === "despesa"), [filteredTransacoes]);

  const totalReceitas = sum(receitas, "valor");
  const totalDespesas = sum(despesas, "valor");
  const lucroLiquido = totalReceitas - totalDespesas;
  const margemLiquida = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

  const receitasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    receitas.forEach((t: any) => { const c = t.categoria ?? "outras"; map[c] = (map[c] ?? 0) + toNumber(t.valor); });
    return Object.entries(map).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [receitas]);

  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    despesas.forEach((t: any) => { const c = t.categoria ?? "outras"; map[c] = (map[c] ?? 0) + toNumber(t.valor); });
    return Object.entries(map).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [despesas]);

  // ── P&L por Projeto (cada transação = 1 projeto) ──────────────────────────
  const plPorProjeto = useMemo(() =>
    filteredTransacoes
      .map((t: any) => {
        const valor = toNumber(t.valor);
        return {
          id: t.id,
          nome: t.descricao ?? "—",
          categoria: t.categoria ?? "—",
          receita: t.type === "receita" ? valor : 0,
          despesa: t.type === "despesa" ? valor : 0,
          resultado: t.type === "receita" ? valor : -valor,
        };
      })
      .sort((a, b) => b.resultado - a.resultado),
  [filteredTransacoes]);

  // ── P&L por Artista ───────────────────────────────────────────────────────
  // Agrupa direto pelas transações (já vêm com `artistas` embutido via join
  // server-side, ver useTransacoes select: "*, artistas(*)") em vez de
  // percorrer useArtistas() — evita depender de uma segunda lista (capada a
  // 50 registros/tenant) só para resolver o nome de exibição.
  const plPorArtista = useMemo(() => {
    const porArtista = new Map<string, { id: string; nome: string; totalRec: number; totalDes: number }>();
    for (const t of filteredTransacoes as any[]) {
      const artistId = t.artist_id;
      if (!artistId) continue;
      const entry = porArtista.get(artistId) ?? {
        id: artistId,
        nome: t.artistas?.nome_artistico ?? t.artistas?.nome ?? "—",
        totalRec: 0,
        totalDes: 0,
      };
      if (t.type === "receita") entry.totalRec += toNumber(t.valor);
      else if (t.type === "despesa") entry.totalDes += toNumber(t.valor);
      porArtista.set(artistId, entry);
    }
    return Array.from(porArtista.values())
      .map((a) => ({ ...a, lucro: a.totalRec - a.totalDes, margem: a.totalRec > 0 ? ((a.totalRec - a.totalDes) / a.totalRec) * 100 : 0 }))
      .sort((a, b) => b.lucro - a.lucro);
  }, [filteredTransacoes]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const plEmpresaProps = { receitasPorCategoria, despesasPorCategoria, totalReceitas, totalDespesas, lucroLiquido, margemLiquida };

  return (
    <FeatureGate feature="moduleAccounting" featureName="Contabilidade">
    <MainLayout
      title="Contabilidade"
    >
      <div className="space-y-6">

        {/* ── Toolbar: busca + date pickers (alinhados à direita) ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          {/* Seletor de datas — sempre imediatamente à esquerda da busca */}
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
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receitas">Receitas</SelectItem>
                <SelectItem value="despesas">Despesas</SelectItem>
                <SelectItem value="lucro">Lucro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs — sempre visíveis acima das abas */}
        <KpiCards totalReceitas={totalReceitas} totalDespesas={totalDespesas} lucroLiquido={lucroLiquido} margemLiquida={margemLiquida} />

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-contabilidade">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="todos" data-testid="tab-todos">Todos</TabsTrigger>
            <TabsTrigger value="empresa" data-testid="tab-empresa">P&amp;L Empresa</TabsTrigger>
            <TabsTrigger value="projetos" data-testid="tab-projetos">P&amp;L Projetos</TabsTrigger>
            <TabsTrigger value="artistas" data-testid="tab-artistas">P&amp;L Artistas</TabsTrigger>
          </TabsList>

          {/* ── TODOS: todas as visões empilhadas ────────────────────────── */}
          <TabsContent value="todos" className="space-y-6 mt-6">
            <PLEmpresaTable {...plEmpresaProps} />

            {/* Projetos (compacto) */}
            <Card>
              <CardContent className="p-0 max-h-64 overflow-y-auto">
                <ListSectionHeader
                  title="P&L por Projeto"
                  count={plPorProjeto.length}
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
                    {plPorProjeto.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-xs truncate">{p.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{catLabel(p.categoria)}</TableCell>
                        <TableCell className="text-right text-green-600">{p.receita > 0 ? formatCurrency(p.receita) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.despesa > 0 ? formatCurrency(-p.despesa) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${p.resultado > 0 ? "text-green-600" : p.resultado < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.resultado >= 0 ? "+" : ""}{formatCurrency(p.resultado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Artistas (compacto) */}
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Artista"
                  count={plPorArtista.length}
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
                    {plPorArtista.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.nome}</TableCell>
                        <TableCell className="text-right text-green-600">{a.totalRec > 0 ? formatCurrency(a.totalRec) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{a.totalDes > 0 ? formatCurrency(-a.totalDes) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${a.lucro > 0 ? "text-green-600" : a.lucro < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {a.lucro >= 0 ? "+" : ""}{formatCurrency(a.lucro)}
                        </TableCell>
                        <TableCell className={`text-right ${a.margem >= 0 ? "text-primary" : "text-destructive"}`}>
                          {a.margem.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── P&L EMPRESA ──────────────────────────────────────────────── */}
          <TabsContent value="empresa" className="space-y-4 mt-6">
            <PLEmpresaTable {...plEmpresaProps} />
          </TabsContent>

          {/* ── P&L PROJETOS ─────────────────────────────────────────────── */}
          <TabsContent value="projetos" className="space-y-4 mt-6">
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Projeto"
                  count={plPorProjeto.length}
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
                    {plPorProjeto.map((p) => (
                      <TableRow key={p.id} data-testid={`row-projeto-${p.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">{p.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{catLabel(p.categoria)}</TableCell>
                        <TableCell className="text-right text-green-600">{p.receita > 0 ? formatCurrency(p.receita) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.despesa > 0 ? formatCurrency(-p.despesa) : "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${p.resultado > 0 ? "text-green-600" : p.resultado < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.resultado >= 0 ? "+" : ""}{formatCurrency(p.resultado)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-muted/40">
                      <TableCell className="font-bold" colSpan={2}>Total Geral</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatCurrency(totalReceitas)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{formatCurrency(-totalDespesas)}</TableCell>
                      <TableCell className={`text-right font-bold ${lucroLiquido > 0 ? "text-green-600" : lucroLiquido < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {lucroLiquido >= 0 ? "+" : ""}{formatCurrency(lucroLiquido)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── P&L ARTISTAS ─────────────────────────────────────────────── */}
          <TabsContent value="artistas" className="space-y-4 mt-6">
            <Card>
              <CardContent className="p-0">
                <ListSectionHeader
                  title="P&L por Artista"
                  count={plPorArtista.length}
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
                    {plPorArtista.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                          Nenhum artista com transações registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {plPorArtista.map((a) => (
                          <TableRow key={a.id} data-testid={`row-artista-${a.id}`}>
                            <TableCell className="font-medium">{a.nome}</TableCell>
                            <TableCell className="text-right text-green-600">{a.totalRec > 0 ? formatCurrency(a.totalRec) : "—"}</TableCell>
                            <TableCell className="text-right text-destructive">{a.totalDes > 0 ? formatCurrency(-a.totalDes) : "—"}</TableCell>
                            <TableCell className={`text-right font-bold ${a.lucro > 0 ? "text-green-600" : a.lucro < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {a.lucro >= 0 ? "+" : ""}{formatCurrency(a.lucro)}
                            </TableCell>
                            <TableCell className={`text-right text-sm ${a.margem >= 0 ? "text-primary" : "text-destructive"}`}>
                              {a.margem.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 bg-muted/40">
                          <TableCell className="font-bold">Total (artistas)</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(sum(plPorArtista, "totalRec"))}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{formatCurrency(-sum(plPorArtista, "totalDes"))}</TableCell>
                          <TableCell className={`text-right font-bold ${sum(plPorArtista, "lucro") > 0 ? "text-green-600" : sum(plPorArtista, "lucro") < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {sum(plPorArtista, "lucro") >= 0 ? "+" : ""}{formatCurrency(sum(plPorArtista, "lucro"))}
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

