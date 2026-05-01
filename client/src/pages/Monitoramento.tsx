import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, Clock, AlertTriangle, CheckCircle, FileText, Upload, Search, RefreshCw, Music } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Confirmado": return <Badge className="bg-green-600">{status}</Badge>;
    case "Pendente": return <Badge className="bg-amber-500">{status}</Badge>;
    case "Não Reportado": return <Badge className="bg-red-600">{status}</Badge>;
    case "Processado": return <Badge className="bg-green-600">{status}</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function Monitoramento() {
  const [activeTab, setActiveTab] = useState("deteccao");
  const [deteccoes] = useState<any[]>([]);
  const [ecadPeriodos] = useState<any[]>([]);

  const totalDeteccoes = deteccoes.length;
  const pendentes = deteccoes.filter(d => d.status === "Pendente").length;
  const naoReportados = deteccoes.filter(d => d.status === "Não Reportado").length;
  const taxaMatch = totalDeteccoes > 0 ? ((deteccoes.filter(d => d.status === "Confirmado").length / totalDeteccoes) * 100).toFixed(0) : "0";

  return (
    <MainLayout title="Monitoramento" description="Detecte execuções em rádio, TV e reconcilie com ECAD">
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Detecções Hoje</span><Radio className="h-5 w-5 text-primary" /></div><div className="mt-2"><span className="text-2xl font-bold">{totalDeteccoes}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Pendentes</span><Clock className="h-5 w-5 text-amber-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-amber-500">{pendentes}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Não Reportados</span><AlertTriangle className="h-5 w-5 text-red-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-red-500">{naoReportados}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Taxa de Match</span><CheckCircle className="h-5 w-5 text-green-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-green-500">{taxaMatch}%</span></div></CardContent></Card>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeTab === "deteccao" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("deteccao")} className={activeTab === "deteccao" ? "gap-2 bg-muted text-foreground hover:bg-muted" : "gap-2"}><Radio className="h-4 w-4" />Detecção Rádio/TV</Button>
          <Button variant={activeTab === "ecad" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("ecad")} className={activeTab === "ecad" ? "gap-2 bg-muted text-foreground hover:bg-muted" : "gap-2"}><FileText className="h-4 w-4" />ECAD</Button>
          <Button variant={activeTab === "divergencias" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("divergencias")} className={activeTab === "divergencias" ? "gap-2 bg-muted text-foreground hover:bg-muted" : "gap-2"}><AlertTriangle className="h-4 w-4" />Divergências ({naoReportados})</Button>
        </div>

        {activeTab === "deteccao" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div><CardTitle className="text-lg">Detecções de Execução</CardTitle><CardDescription>Execuções detectadas em rádio e TV via fingerprinting</CardDescription></div>
              <div className="flex items-center gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 w-64 bg-background" /></div>
                <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {deteccoes.length > 0 ? (
                deteccoes.map((deteccao: any) => (
                  <div key={deteccao.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                      <Music className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{deteccao.musica}</h3>
                      <p className="text-sm text-muted-foreground">{deteccao.artista}</p>
                    </div>
                    <div className="hidden lg:flex items-center gap-6 text-sm">
                      <div><span className="text-muted-foreground text-xs">Canal</span><p>{deteccao.canal}</p></div>
                      <div><span className="text-muted-foreground text-xs">Data/Hora</span><p>{deteccao.data} {deteccao.horario}</p></div>
                    </div>
                    <div>{getStatusBadge(deteccao.status)}</div>
                    <Button variant="outline" size="sm">Ver</Button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Radio}
                  title="Nenhuma detecção registrada"
                  description="As detecções de execução aparecerão aqui automaticamente"
                />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "ecad" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg">Conciliação ECAD</CardTitle><CardDescription>Importe e reconcilie relatórios do ECAD</CardDescription></div>
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90"><Upload className="h-4 w-4" />Importar Relatório ECAD</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {ecadPeriodos.length > 0 ? (
                ecadPeriodos.map((periodo: any) => (
                  <Card key={periodo.id} className="bg-muted/30">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div><p className="font-semibold">Período: {periodo.periodo}</p><p className="text-sm text-muted-foreground">{periodo.registros} registros • {periodo.matches} matches • {periodo.divergencias} divergências</p></div>
                      </div>
                      <div className="flex items-center gap-3">{getStatusBadge(periodo.status)}<Button variant="outline" size="sm">Ver Detalhes</Button></div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Nenhum relatório ECAD importado"
                  description="Importe relatórios do ECAD para conciliação"
                />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "divergencias" && (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={AlertTriangle}
                title="Nenhuma divergência encontrada"
                description="Todas as execuções estão conciliadas"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
