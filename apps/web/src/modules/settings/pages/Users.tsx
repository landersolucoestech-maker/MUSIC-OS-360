import { useMemo, useState } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Users, Search, Loader2, Eye, Pencil } from "lucide-react";
import { UserEditorModal } from "@/modules/settings/components/UserEditorModal";
import { UserViewModal } from "@/modules/settings/components/UserViewModal";
import { EmptyState } from "@/shared/components/EmptyState";
import { useUsers, type UserAccount } from "@/modules/settings/hooks/useUsers";
import { useRoles } from "@/modules/settings/hooks/useRoles";
import { formatPersonName } from "@/shared/lib/format-name";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UsersPage() {
  const { users, isLoading } = useUsers();
  const { roles } = useRoles();
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; usuario?: UserAccount }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; usuario?: UserAccount }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all-roles");
  const [statusFilter, setStatusFilter] = useState("all-status");

  const roleNames = useMemo(
    () => new Map(roles.map((role) => [role.slug, role.name])),
    [roles],
  );

  const filteredUsers = users.filter((member) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      (member.full_name?.toLowerCase().includes(normalizedSearch) ?? false) ||
      member.email.toLowerCase().includes(normalizedSearch);
    const matchesRole = roleFilter === "all-roles" || member.role === roleFilter;
    const matchesStatus = statusFilter === "all-status" || member.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const hasActiveFilters = searchTerm !== "" || roleFilter !== "all-roles" || statusFilter !== "all-status";

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all-roles");
    setStatusFilter("all-status");
  };

  const initials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
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
    <MainLayout
      title="Usuários"
      description="Gerencie usuários, convites e papéis do sistema"
      actions={
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setFormModal({ open: true, mode: "create" })}>
          <Users className="h-3.5 w-3.5" /> Convidar usuário
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[190px] h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos os papéis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-roles">Todos os papéis</SelectItem>
              {roles.filter((role) => !role.archived_at).map((role) => (
                <SelectItem key={role.id} value={role.slug}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário encontrado"
            description={hasActiveFilters ? "Nenhum usuário corresponde aos filtros aplicados." : "Envie um convite para adicionar o primeiro usuário."}
          />
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="pt-0">
              <ListSectionHeader title="Usuários" count={filteredUsers.length} description="Usuários cadastrados no workspace atual" />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((member) => (
                    <TableRow key={member.id} data-testid={`row-usuario-${member.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-xs shrink-0">
                            {initials(member.full_name)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{formatPersonName(member.full_name, "Usuário")}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{roleNames.get(member.role) ?? member.role}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{member.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(member.created_at)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${member.status === "ativo" ? "bg-success" : "bg-gray-500"} text-foreground`}>
                          {member.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            data-testid={`button-ver-usuario-${member.id}`}
                            onClick={() => setViewModal({
                              open: true,
                              usuario: {
                                ...member,
                                nome: member.full_name,
                                iniciais: initials(member.full_name),
                                telefone: member.phone,
                                criadoEm: formatDate(member.created_at),
                              } as UserAccount,
                            })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            data-testid={`button-editar-usuario-${member.id}`}
                            onClick={() => setFormModal({ open: true, mode: "edit", usuario: member })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <UserViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal((current) => ({ ...current, open }))}
        usuario={viewModal.usuario}
      />
      <UserEditorModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal((current) => ({ ...current, open }))}
        usuario={formModal.usuario}
        mode={formModal.mode}
      />
    </MainLayout>
  );
}
