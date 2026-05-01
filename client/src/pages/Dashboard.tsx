import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, DollarSign, Radio, Calendar, ArrowRight, Star, Music, TrendingUp, BarChart3, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useMetrics } from "@/hooks/useMetrics";
import { useTransacoes } from "@/hooks/useTransacoes";
import { useEventos } from "@/hooks/useEventos";
import { useContratos, type ContratoWithRelations } from "@/hooks/useContratos";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { formatCurrency } from "@/lib/utils-format";
import { DashboardSkeleton } from "@/components/shared/PageSkeletons";
import { FinanceChart } from "@/components/dashboard/FinanceChart";

export default function Dashboard() {
  const { dashboardMetrics, isLoading } = useMetrics();
  const { transacoes } = useTransacoes();
  const { eventos } = useEventos();
  const { contratos } = useContratos();

  const contratosPorArtista = (() => {
    const map = new Map<string, ContratoWithRelations[]>();
    for (const c of contratos) {
      if (!c.artista_id) continue;
      const arr = map.get(c.artista_id) ?? [];
      arr.push(c);
      map.set(c.artista_id, arr);
    }
    return map;
  })();

  const { totalArtistas, contratosAtivos, contratosVencendo, receitaMensal, artistasDestaque } = dashboardMetrics;

  // Get today's events
  const today = new Date().toISOString().split("T")[0];
  const eventosHoje = eventos.filter(e => e.data_inicio === today);

  // Artistas com eventos/receita para exibição
  const artistasComEventos = artistasDestaque.map(a => ({
    id: a.id,
    nome: a.nome_artistico,
    genero: a.genero_musical || "Outro",
    shows: a.shows,
    receita: a.receita,
  }));

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <MainLayout title="Dashboard" description="Visão geral do seu negócio musical">
      <div className="space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Artistas Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalArtistas}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Artistas cadastrados</p>
                <span className="text-xs text-success font-medium">{contratosAtivos} com contrato</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Vigentes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contratosAtivos}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Contratos ativos</p>
                {contratosVencendo > 0 && (
                  <span className="text-xs text-warning font-medium">{contratosVencendo} vencendo</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(receitaMensal)}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Receitas do mês</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Streams do Mês</CardTitle>
              <Radio className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">-</div>
              <p className="text-xs text-muted-foreground mt-1">Dados de streaming</p>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Atividades Recentes */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Atividades Recentes</CardTitle>
              <Link to="/financeiro">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Ver todas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex-1">
              {transacoes.length > 0 ? (
                <div className="space-y-4">
                  {transacoes.slice(0, 5).map((transacao) => (
                    <div key={transacao.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground">{new Date(transacao.data).toLocaleDateString("pt-BR")}</span>
                        <p className="text-sm font-medium truncate">{transacao.descricao}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(transacao.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma atividade recente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agenda de Hoje */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agenda de Hoje
              </CardTitle>
              <CardDescription>Compromissos agendados</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {eventosHoje.length > 0 ? (
                <div className="space-y-4">
                  {eventosHoje.map((evento) => (
                    <div key={evento.id} className="flex items-center gap-3">
                      <div className="w-14 text-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{evento.horario_inicio || "00:00"}</span>
                      </div>
                      <div className="w-1 h-8 bg-primary/20 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{evento.titulo}</p>
                        <Badge variant="secondary" className="text-xs mt-1">{evento.tipo_evento}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum evento para hoje</p>
                </div>
              )}
              <Link to="/agenda">
                <Button variant="outline" className="w-full mt-4">
                  Ver Agenda Completa
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>


        {/* Artistas em Destaque */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-warning" />
              Artistas em Destaque
            </CardTitle>
            <CardDescription>Artistas com maior relevância no período</CardDescription>
          </CardHeader>
          <CardContent>
            {artistasComEventos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {artistasComEventos.map((artista, index) => (
                  <Card key={artista.id} className="bg-secondary border-border relative overflow-hidden">
                    {/* Ranking badge */}
                    <div className="absolute top-3 right-3">
                      <Badge
                        className={`${index === 0 ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'} text-xs px-2 py-0.5`}
                      >
                        {index === 0 && <TrendingUp className="h-3 w-3 mr-1" />}
                        #{index + 1}
                      </Badge>
                    </div>

                    {/* Background decorative element */}
                    <div className="absolute bottom-0 right-0 w-24 h-24 opacity-20">
                      <div className="w-full h-full bg-primary rounded-full blur-2xl" />
                    </div>

                    <CardContent className="p-4 pt-10">
                      {/* Artist Name */}
                      <h3 className="font-bold text-lg mb-2">{artista.nome}</h3>

                      {/* Genre + Contrato Badges */}
                      <div className="flex flex-wrap items-center gap-1 mb-4">
                        <Badge className="bg-primary hover:bg-primary text-primary-foreground text-xs">
                          {artista.genero}
                        </Badge>
                        <ContratoStatusBadge
                          situacao={getContratoSituacao(contratosPorArtista.get(artista.id))}
                          data-testid={`badge-contrato-destaque-${artista.id}`}
                        />
                      </div>

                      {/* Stats */}
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <BarChart3 className="h-4 w-4" />
                            Streams
                          </span>
                          <span className="font-medium">-</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Shows
                          </span>
                          <span className="font-medium">{artista.shows}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            Receita
                          </span>
                          <span className="font-medium">{formatCurrency(artista.receita)}</span>
                        </div>
                      </div>

                      {/* View Profile Button */}
                      <Link to="/artistas">
                        <Button
                          variant="outline"
                          className="w-full mt-4"
                        >
                          Ver Perfil
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum artista cadastrado</p>
                <Link to="/artistas">
                  <Button variant="link" className="mt-2">Gerenciar Artistas</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
