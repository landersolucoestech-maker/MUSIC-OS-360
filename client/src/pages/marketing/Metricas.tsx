import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Heart, Users, TrendingUp, Download, Link2, BarChart3 } from "lucide-react";

export default function MarketingMetricas() {
  return (
    <MainLayout title="Métricas e Resultados" description="Análise detalhada do desempenho das campanhas e redes sociais">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white">
            <Download className="mr-2 h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="metricas">
          <TabsList>
            <TabsTrigger value="metricas" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="avancado" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Marketing Avançado
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics & Benchmarks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metricas" className="mt-6 space-y-6">
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Alcance Total</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">...</span>
                    <p className="text-xs text-muted-foreground mt-1">impressões este mês</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Engajamento Médio</span>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">...</span>
                    <p className="text-xs text-muted-foreground mt-1">taxa de interação</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Seguidores Totais</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">...</span>
                    <p className="text-xs text-muted-foreground mt-1">em todas as plataformas</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ROI Médio</span>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">0%</span>
                    <p className="text-xs text-muted-foreground mt-1">retorno sobre investimento</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance por Plataforma</CardTitle>
                  <CardDescription>Comparativo de desempenho entre as redes sociais</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    Carregando métricas...
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resultados das Campanhas</CardTitle>
                  <CardDescription>Performance detalhada das campanhas publicitárias</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    Nenhuma campanha encontrada
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="avancado" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Métricas avançadas de marketing em desenvolvimento.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Benchmarks e comparativos do mercado em desenvolvimento.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
