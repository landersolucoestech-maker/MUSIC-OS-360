import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Loader2, UserCog } from "lucide-react";
import { UsuarioFormModal } from "@/components/forms/UsuarioFormModal";
import { UsuarioViewModal } from "@/components/forms/UsuarioViewModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useUsuarios, Usuario } from "@/hooks/useUsuarios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Usuarios() {
  const { usuarios, isLoading } = useUsuarios();
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; usuario?: Usuario }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; usuario?: Usuario }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [cargoFilter, setCargoFilter] = useState("all-cargo");
  const [statusFilter, setStatusFilter] = useState("all-status");

  const filteredUsuarios = usuarios.filter((usuario) => {
    const matchesSearch = 
      (usuario.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (usuario.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCargo = cargoFilter === "all-cargo" || 
      (cargoFilter === "admin" && usuario.role === "admin") ||
      (cargoFilter === "usuario" && usuario.role !== "admin");
    const matchesStatus = statusFilter === "all-status" || usuario.status === statusFilter;
    return matchesSearch && matchesCargo && matchesStatus;
  });

  const hasActiveFilters = searchTerm !== "" || cargoFilter !== "all-cargo" || statusFilter !== "all-status";

  const handleClearFilters = () => {
    setSearchTerm("");
    setCargoFilter("all-cargo");
    setStatusFilter("all-status");
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Usuários" description="Gerencie usuários e permissões do sistema">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button 
            size="sm" 
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" 
            onClick={() => setFormModal({ open: true, mode: "create" })}
          >
            <Users className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome ou email..." 
                  className="pl-10 bg-card border-border" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <Select value={cargoFilter} onValueChange={setCargoFilter}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder="Todos os Cargos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-cargo">Todos os Cargos</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="usuario">Usuário</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">Todos os Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>}
            </div>
          </CardContent>
        </Card>

        {filteredUsuarios.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário encontrado"
            description={hasActiveFilters 
              ? "Nenhum usuário corresponde aos filtros aplicados." 
              : "Novos usuários aparecem aqui após se cadastrarem no sistema."}
          />
        ) : (
          <div className="space-y-3">
            {filteredUsuarios.map((usuario) => (
              <Card key={usuario.id} className="bg-card border-border hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold">
                      {getInitials(usuario.full_name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{usuario.full_name || "Usuário"}</h3>
                        <Badge variant="outline" className="text-xs">
                          {usuario.role === "admin" ? "Administrador" : usuario.cargo || "Usuário"}
                        </Badge>
                        <Badge className={`text-xs ${usuario.status === 'ativo' ? 'bg-green-600' : 'bg-gray-500'} hover:bg-opacity-80 text-white`}>
                          {usuario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">ID: {usuario.id.substring(0, 8)}...</p>
                    </div>
                    <div className="hidden lg:flex items-center gap-8">
                      <div>
                        <span className="text-muted-foreground text-xs">Telefone:</span>
                        <p className="text-foreground text-sm">{usuario.phone || "-"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Criado em:</span>
                        <p className="text-foreground text-sm">{formatDate(usuario.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setViewModal({ 
                          open: true, 
                          usuario: {
                            ...usuario,
                            nome: usuario.full_name,
                            iniciais: getInitials(usuario.full_name),
                            telefone: usuario.phone,
                            criadoEm: formatDate(usuario.created_at),
                          } as any
                        })}
                      >
                        Ver
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setFormModal({ open: true, mode: "edit", usuario })}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <UsuarioViewModal 
        open={viewModal.open} 
        onOpenChange={(open) => setViewModal({ ...viewModal, open })} 
        usuario={viewModal.usuario} 
      />
      <UsuarioFormModal 
        open={formModal.open} 
        onOpenChange={(open) => setFormModal({ ...formModal, open })} 
        usuario={formModal.usuario} 
        mode={formModal.mode} 
      />
    </MainLayout>
  );
}
