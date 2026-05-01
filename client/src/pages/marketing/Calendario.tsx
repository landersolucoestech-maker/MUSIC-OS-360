import { useCallback, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEditQueryParam } from "@/hooks/useEditQueryParam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, FileText, TrendingUp, Eye, Search, Instagram, Youtube, MoreHorizontal, Pencil, Trash2, Music2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConteudoFormModal } from "@/components/forms/ConteudoFormModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useConteudos } from "@/hooks/useConteudos";
import type { ConteudoWithRelations } from "@/hooks/useConteudos";

const getStatusColor = (status: string) => {
  switch (status) {
    case "publicado": return "bg-green-600 text-white";
    case "agendado": return "bg-blue-600 text-white";
    case "rascunho": return "bg-gray-500 text-white";
    case "pausado": return "bg-amber-600 text-white";
    default: return "bg-muted text-muted-foreground";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "publicado": return "Publicado";
    case "agendado": return "Agendado";
    case "rascunho": return "Rascunho";
    case "pausado": return "Pausado";
    default: return status;
  }
};

const getPlataformaIcon = (plataforma: string | null) => {
  switch (plataforma) {
    case "instagram": return <Instagram className="h-4 w-4" />;
    case "youtube": return <Youtube className="h-4 w-4" />;
    case "tiktok": return <FileText className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getPlataformaBg = (plataforma: string | null) => {
  switch (plataforma) {
    case "instagram": return "bg-gradient-to-br from-purple-600 to-pink-500";
    case "tiktok": return "bg-black";
    case "youtube": return "bg-red-600";
    case "facebook": return "bg-blue-600";
    case "twitter": return "bg-sky-500";
    case "linkedin": return "bg-blue-700";
    default: return "bg-muted-foreground";
  }
};

export default function MarketingCalendario() {
  const { conteudos, isLoading, deleteConteudo } = useConteudos();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedConteudo, setSelectedConteudo] = useState<ConteudoWithRelations | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; conteudo?: ConteudoWithRelations }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlataforma, setFilterPlataforma] = useState("all-plat");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all-tipo");

  const handleNovoConteudo = () => {
    setSelectedConteudo(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEdit = useCallback((conteudo: ConteudoWithRelations) => {
    setSelectedConteudo(conteudo);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  useEditQueryParam("edit", conteudos, handleEdit);

  const handleDelete = async () => {
    if (deleteModal.conteudo?.id) {
      await deleteConteudo.mutateAsync(deleteModal.conteudo.id);
      setDeleteModal({ open: false });
    }
  };

  const filtered = conteudos.filter((c: ConteudoWithRelations) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = c.titulo?.toLowerCase().includes(term);
      const matchCampanha = c.campanha_relacionada?.toLowerCase().includes(term);
      const matchDescricao = c.descricao?.toLowerCase().includes(term);
      const matchLancamento = c.lancamentos?.titulo?.toLowerCase().includes(term);
      if (!matchTitle && !matchCampanha && !matchDescricao && !matchLancamento) return false;
    }
    if (filterPlataforma !== "all-plat") {
      if (!c.plataforma || !c.plataforma.includes(filterPlataforma)) return false;
    }
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterTipo !== "all-tipo") {
      if (!c.tipo_conteudo || !c.tipo_conteudo.includes(filterTipo)) return false;
    }
    return true;
  });

  const agendados = conteudos.filter((c: ConteudoWithRelations) => c.status === "agendado").length;
  const publicados = conteudos.filter((c: ConteudoWithRelations) => c.status === "publicado").length;

  const firstPlataforma = (plataformas: string[] | null): string | null =>
    plataformas && plataformas.length > 0 ? plataformas[0] : null;

  const headerActions = (
    <Button className="bg-red-600 hover:bg-red-700" onClick={handleNovoConteudo} data-testid="button-novo-conteudo">+ Novo Conteúdo</Button>
  );

  return (
    <MainLayout title="Calendário de Conteúdo" description="Planeje e agende todo o conteúdo das redes sociais" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Conteúdos Agendados</span><CalendarDays className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2"><span className="text-2xl font-bold text-blue-500" data-testid="text-agendados">{agendados}</span><p className="text-xs text-muted-foreground mt-1">próximos 7 dias</p></div></CardContent></Card>
          <Card className="bg-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Posts Publicados</span><FileText className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2"><span className="text-2xl font-bold text-green-500" data-testid="text-publicados">{publicados}</span><p className="text-xs text-muted-foreground mt-1">este mês</p></div></CardContent></Card>
          <Card className="bg-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Taxa de Engajamento</span><TrendingUp className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2"><span className="text-2xl font-bold text-amber-500">0%</span><p className="text-xs text-muted-foreground mt-1">média das plataformas</p></div></CardContent></Card>
          <Card className="bg-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Alcance Total</span><Eye className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2"><span className="text-2xl font-bold">0</span><p className="text-xs text-muted-foreground mt-1">últimos 30 dias</p></div></CardContent></Card>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conteúdo por título, campanha, lançamento..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={filterPlataforma} onValueChange={setFilterPlataforma}>
            <SelectTrigger className="w-[180px]" data-testid="filter-plataforma"><SelectValue placeholder="Todos Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all-plat">Todos Plataforma</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status"><SelectValue placeholder="Todos Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[150px]" data-testid="filter-tipo"><SelectValue placeholder="Todos Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all-tipo">Todos Tipo</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="stories">Stories</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="reels">Reels</SelectItem>
              <SelectItem value="anuncio">Anúncio</SelectItem>
              <SelectItem value="carrossel">Carrossel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader><CardTitle>Calendário de Publicações</CardTitle><CardDescription>Todos os conteúdos programados e histórico de publicações</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length > 0 ? (
              <div className="space-y-3">
                <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="w-10" />
                  <div className="flex-1 min-w-0">Conteúdo</div>
                  <div className="w-9 text-center">Ações</div>
                </div>
                {filtered.map((conteudo: ConteudoWithRelations) => (
                  <div key={conteudo.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors" data-testid={`card-conteudo-${conteudo.id}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPlataformaBg(firstPlataforma(conteudo.plataforma))}`}>
                      {getPlataformaIcon(firstPlataforma(conteudo.plataforma))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{conteudo.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {conteudo.plataforma?.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                        <Badge className={`text-xs ${getStatusColor(conteudo.status)}`}>{getStatusLabel(conteudo.status)}</Badge>
                        {conteudo.tipo_conteudo?.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                        {conteudo.formato?.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs bg-muted">{f}</Badge>
                        ))}
                        {conteudo.lancamentos && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Music2 className="h-3 w-3" />
                            {conteudo.lancamentos.titulo}
                            {conteudo.lancamentos.artistas?.nome_artistico && ` — ${conteudo.lancamentos.artistas.nome_artistico}`}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${conteudo.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(conteudo)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteModal({ open: true, conteudo })} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum conteúdo cadastrado"
                description="Comece criando seu primeiro conteúdo para as redes sociais"
                actionLabel="Novo Conteúdo"
                onAction={handleNovoConteudo}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ConteudoFormModal open={modalOpen} onOpenChange={setModalOpen} initialData={selectedConteudo} mode={modalMode} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Conteúdo" description={`Tem certeza que deseja excluir o conteúdo "${deleteModal.conteudo?.titulo}"?`} onConfirm={handleDelete} />
    </MainLayout>
  );
}
