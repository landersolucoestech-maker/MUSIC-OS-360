import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Share2, ArrowDownLeft, CheckCircle, ArrowUpRight, Download, Plus, Search, Image, Loader2, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShareViewModal } from "@/components/forms/ShareViewModal";
import { SharePendenteFormModal } from "@/components/forms/SharePendenteFormModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { useShares, useLancamentos, useArtistas } from "@/hooks";

export default function GestaoShares() {
  const { shares, isLoading: loadingShares, deleteShare } = useShares();
  const { lancamentos, isLoading: loadingLancamentos } = useLancamentos();
  const { artistas } = useArtistas();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [artistFilter, setArtistFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [shareFilter, setShareFilter] = useState("todos");
  const [viewModal, setViewModal] = useState<{ open: boolean; share?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; share?: any }>({ open: false });
  const [sharePendenteModal, setSharePendenteModal] = useState<{ open: boolean; share?: any }>({ open: false });

  const isLoading = loadingShares || loadingLancamentos;

  // Metrics
  const shareReceber = shares.filter((s: any) => s.status === "a_receber").length;
  const shareRecebido = shares.filter((s: any) => s.status === "recebido").length;
  const shareEnviar = shares.filter((s: any) => s.status === "a_enviar").length;
  const shareAplicado = shares.filter((s: any) => s.status === "aplicado").length;

  // Filter shares/lancamentos
  const filteredLancamentos = lancamentos.filter((item: any) => {
    const artistaNome = artistas.find((a: any) => a.id === item.artista_id)?.nome_artistico || "";
    
    const matchesSearch = searchTerm === "" || 
      item.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artistaNome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesArtist = artistFilter === "todos" || item.artista_id === artistFilter;
    
    return matchesSearch && matchesArtist;
  });

  const handleClearFilters = () => {
    setSearchTerm("");
    setArtistFilter("todos");
    setStatusFilter("todos");
    setShareFilter("todos");
  };

  const handleDelete = () => {
    if (deleteModal.share) {
      deleteShare.mutate(deleteModal.share.id);
      setDeleteModal({ open: false });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const headerActions = (
    <>
      <Button variant="outline" size="sm" className="gap-2" data-testid="button-export">
        <Download className="h-4 w-4" />
        Exportar
      </Button>
      <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setSharePendenteModal({ open: true })} data-testid="button-register-pending-share">
        <Plus className="h-4 w-4" />
        Registrar Share Pendente
      </Button>
    </>
  );

  return (
    <MainLayout title="Gestão de Shares" description="Conferência de share aplicado nos lançamentos" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Share a Receber</span>
                  <div className="mt-2"><span className="text-2xl font-bold text-foreground">{shareReceber}</span></div>
                </div>
                <ArrowDownLeft className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Share Recebido</span>
                  <div className="mt-2"><span className="text-2xl font-bold text-foreground">{shareRecebido}</span></div>
                </div>
                <CheckCircle className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Share a Enviar</span>
                  <div className="mt-2"><span className="text-2xl font-bold text-green-500">{shareEnviar}</span></div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Share Aplicado</span>
                  <div className="mt-2"><span className="text-2xl font-bold text-foreground">{shareAplicado}</span></div>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por título ou artista..." 
              className="pl-10 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={artistFilter} onValueChange={setArtistFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Artista" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="todos">Todos Artistas</SelectItem>
              {artistas.map((artista: any) => (
                <SelectItem key={artista.id} value={artista.id}>{artista.nome_artistico}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="Sim">Enviado</SelectItem>
              <SelectItem value="Não">Não Enviado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={shareFilter} onValueChange={setShareFilter}>
            <SelectTrigger className="w-[150px] bg-card border-border">
              <SelectValue placeholder="Share" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aplicado">Aplicado</SelectItem>
              <SelectItem value="Recebido">Recebido</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm !== "" || artistFilter !== "todos" || statusFilter !== "todos" || shareFilter !== "todos") && (
            <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>
          )}
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Lançamentos ({filteredLancamentos.length})</CardTitle>
            <CardDescription>Gerencie o share aplicado e conferência de royalties</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLancamentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Capa</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Artista</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLancamentos.map((item: any) => {
                    const artista = artistas.find((a: any) => a.id === item.artista_id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Image className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.titulo}</TableCell>
                        <TableCell className="text-muted-foreground">{artista?.nome_artistico || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.data_lancamento ? new Date(item.data_lancamento).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-menu-share-${item.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem data-testid={`button-ver-share-${item.id}`} onClick={() => setViewModal({ open: true, share: item })}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem data-testid={`button-editar-share-${item.id}`} onClick={() => setSharePendenteModal({ open: true, share: item })}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem data-testid={`button-excluir-share-${item.id}`} className="text-destructive" onClick={() => setDeleteModal({ open: true, share: item })}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Share2}
                title="Nenhum lançamento cadastrado"
                description="Os lançamentos aparecerão aqui para gestão de shares"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ShareViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        lancamento={viewModal.share}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title="Excluir Share"
        description="Tem certeza que deseja excluir este share? Esta ação não pode ser desfeita."
      />

      <SharePendenteFormModal
        open={sharePendenteModal.open}
        onOpenChange={(open) => setSharePendenteModal({ ...sharePendenteModal, open })}
      />
    </MainLayout>
  );
}
