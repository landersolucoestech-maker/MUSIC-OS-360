import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, TrendingUp, Percent, RefreshCw, Target, FileEdit, CheckSquare, Sparkles, AlertTriangle, ChevronRight, Loader2, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { useCampanhas, useBriefings, useTarefasMarketing, useClientes } from "@/hooks";

export default function MarketingVisaoGeral() {
  const { campanhas, isLoading: loadingCampanhas } = useCampanhas();
  const { briefings, isLoading: loadingBriefings } = useBriefings();
  const { tarefas, isLoading: loadingTarefas } = useTarefasMarketing();
  const { clientes, isLoading: loadingClientes } = useClientes();

  const isLoading = loadingCampanhas || loadingBriefings || loadingTarefas || loadingClientes;

  // Metrics
  const leads = clientes.filter((c: any) => c.status === "lead").length;
  const campanhasAtivas = campanhas.filter((c: any) => c.status === "ativa").length;
  const tarefasPendentes = tarefas.filter((t: any) => t.status === "pendente").length;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Visão Geral" description="Cockpit estratégico de marketing">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Top Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">LEADS</span>
                <Users className="h-5 w-5 text-red-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">{leads}</span>
              </div>
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12% vs mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">CPL</span>
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">R$ 0,00</span>
              </div>
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                -8% custo por lead
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">ROI</span>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">0.0x</span>
              </div>
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +15% retorno
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">CONVERSÃO</span>
                <Percent className="h-5 w-5 text-blue-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">0.0%</span>
              </div>
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                -5% taxa média
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Performance and Funnel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance por Canal */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Performance por Canal</CardTitle>
                <CardDescription>Engajamento e alcance por plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500", followers: "0 seguidores", growth: "0.0%" },
                  { name: "YouTube", color: "bg-red-600", followers: "0 seguidores", growth: "0.0%" },
                  { name: "TikTok", color: "bg-muted", followers: "0 seguidores", growth: "0.0%" },
                  { name: "Spotify", color: "bg-green-600", followers: "0 seguidores", growth: "0.0%" },
                ].map((channel) => (
                  <div key={channel.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${channel.color} rounded-full`} />
                      <span className="text-foreground">{channel.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-sm">{channel.followers}</span>
                      <span className="text-foreground">{channel.growth}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Funil de Marketing */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Funil de Marketing</CardTitle>
                <CardDescription>Jornada do lead até conversão</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { stage: "Awareness", value: "0 impressões", color: "bg-red-600", width: "100%" },
                  { stage: "Interesse", value: "0 cliques", color: "bg-muted", width: "75%" },
                  { stage: "Consideração", value: "0 alcance", color: "bg-muted", width: "50%" },
                  { stage: "Conversão", value: `${leads} leads`, color: "bg-muted", width: "25%" },
                ].map((stage) => (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{stage.stage}</span>
                    </div>
                    <div className="h-8 rounded bg-muted overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} flex items-center justify-center text-white text-sm`} 
                        style={{ width: stage.width }}
                      >
                        {stage.value}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Campanhas Ativas */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Campanhas Ativas</CardTitle>
                  <CardDescription>{campanhasAtivas} campanhas em execução</CardDescription>
                </div>
                <Link to="/marketing/campanhas">
                  <Button variant="ghost" size="sm" className="gap-1">
                    Ver todas <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
            </Card>
          </div>

          {/* Right Column - Alerts and Quick Actions */}
          <div className="space-y-6">
            {/* Alertas */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tarefasPendentes > 0 ? (
                  <p className="text-muted-foreground text-sm">{tarefasPendentes} tarefas pendentes</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum alerta no momento</p>
                )}
              </CardContent>
            </Card>

            {/* Melhor Performance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Melhor Performance</CardTitle>
                <CardDescription>Campanhas com maior ROI</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Sem dados de performance ainda</p>
              </CardContent>
            </Card>

            {/* Atalhos Rápidos */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Atalhos Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/marketing/campanhas">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Target className="h-4 w-4" />
                    Criar Campanha
                  </Button>
                </Link>
                <Link to="/marketing/briefing">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <FileEdit className="h-4 w-4" />
                    Novo Briefing
                  </Button>
                </Link>
                <Link to="/marketing/calendario">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Criar Tarefa
                  </Button>
                </Link>
                <Link to="/marketing/ia-criativa">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Sparkles className="h-4 w-4" />
                    IA Criativa
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Atividades */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Atividades</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{briefings.length} briefings cadastrados</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
