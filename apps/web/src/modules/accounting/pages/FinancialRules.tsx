import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { EmptyState } from "@/shared/components/EmptyState";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  useFinancialRules, type FinancialRule, type FinancialRuleTipo,
  type FinancialRuleCalculo, type FinancialRuleTrigger,
} from "@/modules/accounting/hooks/useFinancialRules";

const TIPOS: { value: FinancialRuleTipo; label: string }[] = [
  { value: "imposto", label: "Imposto" },
  { value: "comissao", label: "Comissão" },
  { value: "external_rights_fee", label: "Taxa de Direitos Externos" },
  { value: "desconto", label: "Desconto" },
  { value: "taxa", label: "Taxa" },
  { value: "outros", label: "Outros" },
];
const CALCULOS: { value: FinancialRuleCalculo; label: string }[] = [
  { value: "percentual", label: "Percentual" },
  { value: "fixo", label: "Valor Fixo" },
  { value: "faixa", label: "Faixa (em breve)" },
];
const TRIGGERS: { value: FinancialRuleTrigger; label: string }[] = [
  { value: "contract.signed", label: "Contrato assinado" },
  { value: "transaction.created", label: "Transação criada" },
  { value: "transaction.paid", label: "Transação paga" },
  { value: "invoice.overdue", label: "Nota fiscal vencida" },
];

interface FormState {
  name: string;
  type: FinancialRuleTipo;
  category: string;
  calculo: FinancialRuleCalculo;
  valor: string;
  descricao: string;
  active: boolean;
  triggers: FinancialRuleTrigger[];
}

const EMPTY_FORM: FormState = {
  name: "", type: "outros", category: "", calculo: "percentual",
  valor: "", descricao: "", active: true, triggers: [],
};

function toForm(rule: FinancialRule): FormState {
  return {
    name: rule.name,
    type: rule.type,
    category: rule.category ?? "",
    calculo: rule.calculo,
    valor: String(rule.valor),
    descricao: rule.descricao ?? "",
    active: rule.active,
    triggers: rule.condicoes?.triggers ?? [],
  };
}

function fmtValor(rule: FinancialRule): string {
  return rule.calculo === "percentual" ? `${rule.valor}%` : `R$ ${Number(rule.valor).toFixed(2)}`;
}

export default function FinancialRules() {
  const { rules, isLoading, createRule, updateRule, deleteRule } = useFinancialRules();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinancialRule | null>(null);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(null); setModalOpen(true); };
  const openEdit = (rule: FinancialRule) => { setEditing(rule); setForm(toForm(rule)); setError(null); setModalOpen(true); };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleTrigger = (trigger: FinancialRuleTrigger) => {
    setForm((f) => ({
      ...f,
      triggers: f.triggers.includes(trigger) ? f.triggers.filter((t) => t !== trigger) : [...f.triggers, trigger],
    }));
  };

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Informe o nome da regra."); return; }
    const valorNum = Number(form.valor);
    if (!form.valor.trim() || Number.isNaN(valorNum)) { setError("Informe um valor numérico válido."); return; }
    if (form.triggers.length === 0) {
      setError("Selecione ao menos um evento — uma regra sem evento nunca dispara.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      category: form.category.trim() || undefined,
      calculo: form.calculo,
      valor: valorNum,
      descricao: form.descricao.trim() || undefined,
      active: form.active,
      condicoes: { triggers: form.triggers },
    };

    try {
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createRule.mutateAsync(payload as never);
      }
      setModalOpen(false);
    } catch {
      // erro já reportado via toast pelo hook
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // erro já reportado via toast pelo hook
    }
  }

  async function handleToggleActive(rule: FinancialRule) {
    try {
      await updateRule.mutateAsync({ id: rule.id, active: !rule.active } as never);
    } catch {
      // erro já reportado via toast pelo hook
    }
  }

  return (
    <FeatureGate feature="moduleAccounting" featureName="Financeiro">
      <MainLayout
        title="Automações Financeiras"
        description="Regras que disparam automaticamente ao assinar contratos, criar/pagar transações e vencer notas fiscais"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/accounting"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Financeiro</Link>
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreate} data-testid="button-nova-regra-financeira">
              <Plus className="h-3.5 w-3.5" /> Nova Regra
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <Card>
            <CardContent className="p-0">
              <ListSectionHeader
                title="Regras de Automação"
                count={rules.length}
                description="Cada regra calcula um valor (percentual ou fixo) e notifica quando um dos eventos selecionados ocorre."
                className="px-6 pt-6"
              />
              {isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : rules.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="Nenhuma regra cadastrada"
                  description="Crie uma regra para automatizar cálculos e notificações financeiras."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cálculo</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} data-testid={`row-regra-financeira-${rule.id}`}>
                        <TableCell>
                          <p className="font-medium text-foreground">{rule.name}</p>
                          {rule.category && <p className="text-xs text-muted-foreground">{rule.category}</p>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {TIPOS.find((t) => t.value === rule.type)?.label ?? rule.type}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtValor(rule)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(rule.condicoes?.triggers ?? []).length === 0 ? (
                              <span className="text-xs text-destructive">Nenhum — nunca dispara</span>
                            ) : (
                              rule.condicoes!.triggers!.map((t) => (
                                <Badge key={t} variant="neutral" className="text-[10px]">
                                  {TRIGGERS.find((tr) => tr.value === t)?.label ?? t}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch checked={rule.active} onCheckedChange={() => handleToggleActive(rule)} data-testid={`switch-active-${rule.id}`} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(rule)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Regra" : "Nova Regra Financeira"}</DialogTitle>
              <DialogDescription>
                Defina o cálculo e selecione os eventos que disparam esta regra.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nome *</Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex.: Comissão de agenciamento" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setField("type", v as FinancialRuleTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Categoria</Label>
                  <Input value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cálculo</Label>
                  <Select value={form.calculo} onValueChange={(v) => setField("calculo", v as FinancialRuleCalculo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CALCULOS.map((c) => (
                        <SelectItem key={c.value} value={c.value} disabled={c.value === "faixa"}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Valor {form.calculo === "percentual" ? "(%)" : "(R$)"} *</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setField("valor", e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setField("descricao", e.target.value)} placeholder="Opcional" className="min-h-[70px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Eventos que disparam esta regra *</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {TRIGGERS.map((t) => (
                    <div key={t.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`trigger-${t.value}`}
                        checked={form.triggers.includes(t.value)}
                        onCheckedChange={() => toggleTrigger(t.value)}
                      />
                      <Label htmlFor={`trigger-${t.value}`} className="text-xs font-normal cursor-pointer">{t.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setField("active", v)} />
                <Label className="text-xs font-medium">Regra ativa</Label>
              </div>
              {error && <p className="text-[11px] text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editing ? "Salvar alterações" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir regra</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a regra &quot;{deleteTarget?.name}&quot;? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </FeatureGate>
  );
}
