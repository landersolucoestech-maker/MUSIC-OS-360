import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, FileText, Loader2, Plus } from "lucide-react";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { TemplateContratoFormModal } from "@/components/forms/TemplateContratoFormModal";
import { TemplateContratoViewModal } from "@/components/forms/TemplateContratoViewModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useTemplatesContratos } from "@/hooks";

const TIPOS_SERVICO = [
  "Agenciamento",
  "Gestão",
  "Empresariamento",
  "Empresariamento com Suporte Financeiro",
  "Licenciamento",
  "Edição",
  "Show/Evento",
  "Produção Musical",
  "Produção Audiovisual",
  "Marketing",
  "Criação de Sites",
  "Distribuição",
  "Parceria",
  "Outros",
];

export default function TemplatesContratos() {
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useTemplatesContratos();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const filteredTemplates = templates.filter((tpl: any) => {
    const matchesSearch =
      tpl.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tpl.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = filterTipo === "todos" || tpl.tipo_servico === filterTipo;
    return matchesSearch && matchesTipo;
  });

  const handleAdd = () => {
    setSelectedTemplate(null);
    setIsFormOpen(true);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setIsFormOpen(true);
  };

  const handleView = (template: any) => {
    setSelectedTemplate(template);
    setIsViewOpen(true);
  };

  const handleDeleteClick = (template: any) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTemplate) {
      deleteTemplate.mutate(selectedTemplate.id);
      setIsDeleteOpen(false);
      setSelectedTemplate(null);
    }
  };

  const handleSave = (data: any) => {
    if (selectedTemplate) {
      updateTemplate.mutate({ id: selectedTemplate.id, ...data });
    } else {
      addTemplate.mutate(data);
    }
    setIsFormOpen(false);
    setSelectedTemplate(null);
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

  return (
    <MainLayout title="Templates de Contratos" description="Gerencie modelos de contratos personalizáveis">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" className="gap-2" onClick={handleAdd}><Plus className="h-4 w-4" />Novo Template</Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
              <FileText className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {templates.filter((t: any) => t.ativo).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inativos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {templates.filter((t: any) => !t.ativo).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tipos de Serviço</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(templates.map((t: any) => t.tipo_servico)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_SERVICO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchTerm !== "" || filterTipo !== "todos") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterTipo("todos"); }}>
              Limpar
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filteredTemplates.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="Nenhum template encontrado"
                  description="Crie templates de contratos para agilizar a geração de documentos."
                  action={{ label: "Novo Template", onClick: handleAdd }}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo de Serviço</TableHead>
                    <TableHead>Variáveis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualização</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template: any) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.nome}</p>
                          {template.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {template.descricao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.tipo_servico}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {template.variaveis?.length || 0} variáveis
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.ativo ? "default" : "secondary"}>
                          {template.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(template.updated_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleView(template)}>
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteClick(template)}>
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <TemplateContratoFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        template={selectedTemplate}
        onSave={handleSave}
        tiposServico={TIPOS_SERVICO}
      />

      <TemplateContratoViewModal
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        template={selectedTemplate}
      />

      <DeleteConfirmModal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Template"
        description={`Tem certeza que deseja excluir o template "${selectedTemplate?.nome}"? Esta ação não pode ser desfeita.`}
      />
    </MainLayout>
  );
}
