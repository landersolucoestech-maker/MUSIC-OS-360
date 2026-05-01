import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Settings, TrendingUp, TrendingDown, MoreHorizontal, Eye, Pencil, Trash2, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { RegraViewModal } from "@/components/forms/RegraViewModal";
import { RegraFormModal } from "@/components/forms/RegraFormModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";

interface Regra {
  id: number;
  keywords: string;
  category: string;
  type: string;
  origin: string;
}

export default function FinanceiroRegras() {
  const [rules, setRules] = useState<Regra[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; rule?: Regra }>({ open: false });
  const [viewModal, setViewModal] = useState<{ open: boolean; rule?: Regra }>({ open: false });
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; rule?: Regra }>({ open: false, mode: "create" });

  const customRulesCount = rules.filter(r => r.origin === "Personalizada").length;
  const systemRulesCount = rules.filter(r => r.origin === "Sistema").length;
  const revenueRulesCount = rules.filter(r => r.type === "Receita").length;
  const expenseRulesCount = rules.filter(r => r.type === "Despesa").length;

  const handleCreateRule = () => {
    setFormModal({ open: true, mode: "create" });
  };

  const handleViewRule = (rule: Regra) => {
    setViewModal({ open: true, rule });
  };

  const handleEditRule = (rule: Regra) => {
    if (rule.origin === "Sistema") {
      toast.error("Regras do sistema não podem ser editadas.");
      return;
    }
    setFormModal({ open: true, mode: "edit", rule });
  };

  const handleSaveRule = (ruleData: Omit<Regra, "id" | "origin">) => {
    if (formModal.mode === "create") {
      const newRule: Regra = {
        id: rules.length > 0 ? Math.max(...rules.map(r => r.id)) + 1 : 1,
        ...ruleData,
        origin: "Personalizada",
      };
      setRules([...rules, newRule]);
    } else if (formModal.rule) {
      setRules(rules.map(r => 
        r.id === formModal.rule!.id 
          ? { ...r, ...ruleData } 
          : r
      ));
    }
  };

  const handleDelete = () => {
    if (deleteModal.rule) {
      if (deleteModal.rule.origin === "Sistema") {
        toast.error("Regras do sistema não podem ser excluídas.");
        setDeleteModal({ open: false });
        return;
      }
      setRules(rules.filter(r => r.id !== deleteModal.rule!.id));
      toast.success("A regra foi excluída com sucesso.");
    }
    setDeleteModal({ open: false });
  };

  return (
    <MainLayout title="Regras de Categorização" description="Configure regras automáticas para categorizar transações">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" className="gap-2" onClick={handleCreateRule}><Plus className="h-4 w-4" />Nova Regra</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Regras do Sistema" value={systemRulesCount.toString()} icon={Settings} />
          <MetricCard title="Regras Personalizadas" value={customRulesCount.toString()} icon={FileText} />
          <MetricCard title="Regras de Receitas" value={revenueRulesCount.toString()} icon={TrendingUp} />
          <MetricCard title="Regras de Despesas" value={expenseRulesCount.toString()} icon={TrendingDown} />
        </div>
        <Card>
          {rules.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Settings}
                title="Nenhuma regra cadastrada"
                description="Adicione regras para categorizar automaticamente suas transações financeiras."
                action={{ label: "Nova Regra", onClick: handleCreateRule }}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Palavras-chave</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-sm max-w-md truncate">{rule.keywords}</TableCell>
                    <TableCell className="font-medium">{rule.category}</TableCell>
                    <TableCell><Badge variant={rule.type === "Receita" ? "default" : "secondary"}>{rule.type}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{rule.origin}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewRule(rule)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteModal({ open: true, rule })} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <RegraViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        regra={viewModal.rule}
        onEdit={() => {
          setViewModal({ open: false });
          if (viewModal.rule) {
            setFormModal({ open: true, mode: "edit", rule: viewModal.rule });
          }
        }}
      />

      <RegraFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        mode={formModal.mode}
        regra={formModal.rule}
        onSave={handleSaveRule}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title="Excluir Regra"
        description={`Tem certeza que deseja excluir a regra "${deleteModal.rule?.category}"?`}
      />
    </MainLayout>
  );
}