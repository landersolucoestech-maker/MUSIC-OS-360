import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Search, Plus, FileText } from "lucide-react";

export default function LanderZap() {
  const [activeTab, setActiveTab] = useState("todas");

  return (
    <MainLayout title="LanderZap" description="Comunicação com artistas e parceiros">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Plus className="h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>

        {/* Chat Layout */}
        <div className="flex gap-6 h-[calc(100vh-220px)]">
          {/* Conversations List */}
          <div className="w-[350px] flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Buscar conversas..." 
                className="pl-9 bg-card border-border"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2">
              <Button 
                variant={activeTab === "todas" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("todas")}
                className={activeTab === "todas" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                Todas
              </Button>
              <Button 
                variant={activeTab === "nao-lidas" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("nao-lidas")}
                className={activeTab === "nao-lidas" ? "bg-muted text-foreground hover:bg-muted" : ""}
              >
                Não lidas
              </Button>
              <Button 
                variant={activeTab === "favoritas" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("favoritas")}
                className={activeTab === "favoritas" ? "bg-muted text-foreground hover:bg-muted" : ""}
              >
                Favoritas
              </Button>
            </div>

            {/* Empty Conversations */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma conversa ainda</p>
              <button className="text-red-500 text-sm mt-2 hover:underline">
                Iniciar nova conversa
              </button>
            </div>
          </div>

          {/* Chat Area */}
          <Card className="flex-1 bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center h-full">
              <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Selecione uma conversa</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Escolha uma conversa existente ou inicie uma nova
              </p>
              <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Plus className="h-4 w-4" />
                Nova Mensagem
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
