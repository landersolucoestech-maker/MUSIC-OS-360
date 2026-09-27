import { useState, useEffect } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { adminPlansService } from "../services/admin-plans.service";
import {
  useCommercialIntegrations,
  usePlanIntegrations,
  useSavePlanIntegrations,
} from "../hooks/useAdminIntegrations";
import type { AdminPlan } from "../types";
import {
  Tag, Users, HardDrive, DollarSign, Check,
  Plus, X, Save, MoreHorizontal, Eye, Pencil, Trash2,
  AlertTriangle, Power, PowerOff, RefreshCw,
} from "lucide-react";

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const EMPTY_PLAN: Omit<AdminPlan, "id"> = {
  name: "",
  tier: "starter",
  price_monthly: 0,
  price_annual: 0,
  max_users: 5,
  max_artists: 50,
  max_storage_gb: 10,
  features: [],
  active_subscribers: 0,
  mrr: 0,
  color: "#3B82F6",
  active: true,
};

/* ─────────────── Form / Create / Edit Dialog ─────────────── */
interface FormDialogProps {
  plan: AdminPlan | null;   // null = criar
  onSave: (plan: AdminPlan) => void;
  onClose: () => void;
}

function PlanFormDialog({ plan, onSave, onClose }: FormDialogProps) {
  const isNew = !plan;
  const [form, setForm] = useState<AdminPlan>(
    plan ? { ...plan } : { id: `plan-${Date.now()}`, ...EMPTY_PLAN }
  );
  const [newFeature, setNewFeature] = useState("");

  // Plan entitlements — persisted separately from the plan itself
  // (billing_plans.integrations), via the dedicated administrative endpoint.
  const { data: commercialIntegrations, isLoading: loadingIntegrations } = useCommercialIntegrations();
  const { data: persistedIntegrations } = usePlanIntegrations(plan?.tier);
  const saveIntegrations = useSavePlanIntegrations();
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [integrationsTouched, setIntegrationsTouched] = useState(false);

  // Reopening the plan must bring exactly what is persisted.
  useEffect(() => {
    if (!integrationsTouched) setSelectedIntegrations(persistedIntegrations);
  }, [persistedIntegrations, integrationsTouched]);

  function field(key: keyof AdminPlan, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addFeature() {
    const v = newFeature.trim();
    if (!v) return;
    setForm(prev => ({ ...prev, features: [...prev.features, v] }));
    setNewFeature("");
  }

  function removeFeature(idx: number) {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  }

  const canSave = form.name.trim().length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-[15px]">
            {isNew ? (
              <><Plus className="h-4 w-4 text-primary" /> Novo Plano</>
            ) : (
              <><div className="h-2.5 w-2.5 rounded-full" style={{ background: form.color }} /> Editar — {form.name}</>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name + color */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Nome do Plano *</Label>
              <Input
                value={form.name}
                onChange={e => field("name", e.target.value)}
                placeholder="Ex: Growth Plus"
                className="h-8 text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                data-testid="input-plan-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Cor</Label>
              <div className="flex items-center gap-2 h-8">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => field("color", e.target.value)}
                  className="h-8 w-10 rounded cursor-pointer border border-border bg-transparent"
                  data-testid="input-plan-color"
                />
                <span className="text-[11px] text-muted-foreground font-sans">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Preço Mensal (R$)</Label>
              <Input
                type="number"
                value={form.price_monthly}
                onChange={e => field("price_monthly", Number(e.target.value))}
                className="h-8 text-sm bg-muted border-border text-foreground focus:border-primary/50"
                data-testid="input-plan-price-monthly"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Preço Anual (R$)</Label>
              <Input
                type="number"
                value={form.price_annual}
                onChange={e => field("price_annual", Number(e.target.value))}
                className="h-8 text-sm bg-muted border-border text-foreground focus:border-primary/50"
                data-testid="input-plan-price-annual"
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Máx. Usuários</Label>
              <Input
                type="number"
                value={form.max_users}
                onChange={e => field("max_users", Number(e.target.value))}
                className="h-8 text-sm bg-muted border-border text-foreground focus:border-primary/50"
                data-testid="input-plan-max-users"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Máx. Artistas</Label>
              <Input
                type="number"
                value={form.max_artists}
                onChange={e => field("max_artists", Number(e.target.value))}
                className="h-8 text-sm bg-muted border-border text-foreground focus:border-primary/50"
                data-testid="input-plan-max-artists"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground  tracking-wider">Armazenamento (GB)</Label>
              <Input
                type="number"
                value={form.max_storage_gb}
                onChange={e => field("max_storage_gb", Number(e.target.value))}
                className="h-8 text-sm bg-muted border-border text-foreground focus:border-primary/50"
                data-testid="input-plan-storage"
              />
            </div>
          </div>

          {/* Stripe integration — managed by the backend (sync). Display-only. */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground tracking-wider">
              Integração Stripe <span className="text-muted-foreground/60">(gerido automaticamente)</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted border border-border px-2.5 py-1.5" data-testid="display-plan-stripe-product">
                <p className="text-[9px] text-muted-foreground/70 tracking-wider">ID DO PRODUTO (STRIPE)</p>
                <p className="text-[12px] text-foreground font-mono truncate">{form.stripe_product_id || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted border border-border px-2.5 py-1.5" data-testid="display-plan-stripe-price">
                <p className="text-[9px] text-muted-foreground/70 tracking-wider">ID DO PREÇO (STRIPE)</p>
                <p className="text-[12px] text-foreground font-mono truncate">{form.stripe_price_id || "—"}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Criados/atualizados no Stripe ao salvar. Preço alterado → novo preço no Stripe (o anterior é desativado).
            </p>
          </div>

          {/* Included integrations — the plan's entitlements.
              A DYNAMIC list coming from the backend (commercial integrations). Internal ones
              (Soundcharts/ACRCloud/Resend) and billing (Stripe) never appear:
              the backend does not classify them as commercial and also rejects them on save. */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground tracking-wider">
              Recursos e Integrações incluídos
            </Label>
            {loadingIntegrations ? (
              <p className="text-[11px] text-muted-foreground italic" data-testid="plan-integrations-loading">
                Carregando integrações comerciais…
              </p>
            ) : commercialIntegrations.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic" data-testid="plan-integrations-empty">
                Nenhuma integração comercial cadastrada.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1" data-testid="plan-integrations-list">
                {commercialIntegrations.map((it) => {
                  const checked = selectedIntegrations.includes(it.providerKey);
                  return (
                    <label
                      key={it.providerKey}
                      className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer"
                      data-testid={`plan-integration-${it.providerKey}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setIntegrationsTouched(true);
                          setSelectedIntegrations((prev) =>
                            e.target.checked
                              ? [...prev, it.providerKey]
                              : prev.filter((s) => s !== it.providerKey),
                          );
                        }}
                      />
                      <span className="flex-1">{it.name}</span>
                      {it.technicalCapability !== "implemented" && (
                        <span className="text-[10px] text-yellow-500">sem conector</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground  tracking-wider">Funcionalidades</Label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {form.features.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">Nenhuma funcionalidade adicionada.</p>
              )}
              {form.features.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 group/feat">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: form.color }} />
                  <span className="flex-1 text-[12px] text-muted-foreground">{f}</span>
                  <button
                    onClick={() => removeFeature(idx)}
                    className="opacity-0 group-hover/feat:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20 text-red-400"
                    data-testid={`remove-feature-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nova funcionalidade... (Enter para adicionar)"
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFeature()}
                className="h-7 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                data-testid="input-new-feature"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 border-border text-muted-foreground hover:text-foreground"
                onClick={addFeature}
                data-testid="btn-add-feature"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground text-xs"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => {
              // Entitlements live in billing_plans.integrations and are saved
              // by the dedicated endpoint — only for already existing plans (a new
              // plan does not have a persisted slug to associate yet).
              if (plan?.tier && integrationsTouched) {
                saveIntegrations.mutate({ planSlug: plan.tier, integrations: selectedIntegrations });
              }
              onSave(form);
            }}
            data-testid="btn-save-plan"
          >
            <Save className="h-3.5 w-3.5" />
            {isNew ? "Criar plano" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── View Dialog ─────────────── */
function ViewPlanDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-[15px]">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: plan.color }} />
            {plan.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Price */}
          <div className="rounded-xl bg-muted border border-border p-4">
            <p className="text-2xl font-bold text-foreground">
              {fmtBRL(plan.price_monthly)}
              <span className="text-[12px] font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">ou {fmtBRL(plan.price_annual)}/ano</p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Assinantes", value: plan.active_subscribers },
              { label: "MRR", value: fmtBRL(plan.mrr) },
              { label: "Máx. Usuários", value: plan.max_users === 999 ? "Ilimitado" : plan.max_users },
              { label: "Máx. Artistas", value: plan.max_artists === 999 ? "Ilimitados" : plan.max_artists },
              { label: "Armazenamento", value: plan.max_storage_gb === 1000 ? "1 TB" : `${plan.max_storage_gb} GB` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted border border-border p-3">
                <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                <p className="text-[13px] font-semibold text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground  tracking-wider">Funcionalidades</p>
            <div className="space-y-1.5">
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: plan.color }} />
                  <span className="text-[12px] text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground text-xs"
            onClick={onClose}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Delete Confirm Dialog ─────────────── */
function DeletePlanDialog({ plan, onConfirm, onClose }: { plan: AdminPlan; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-[15px]">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Excluir Plano
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Tem certeza que deseja excluir o plano{" "}
            <span className="font-semibold text-foreground">{plan.name}</span>?
          </p>
          {plan.active_subscribers > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">
                Este plano possui <strong>{plan.active_subscribers} assinante(s)</strong> ativo(s).
                Excluí-lo pode afetar esses clientes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground text-xs"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-500 text-foreground text-xs gap-1.5"
            onClick={onConfirm}
            data-testid="btn-confirm-delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Plan Card ─────────────── */
interface PlanCardProps {
  plan: AdminPlan;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onSyncStripe: () => void;
  onDelete: () => void;
}

function PlanCard({ plan, onView, onEdit, onToggleActive, onSyncStripe, onDelete }: PlanCardProps) {
  const isActive = plan.active !== false;
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 space-y-4 group/card relative"
      data-testid={`plan-${plan.id}`}
    >
      {/* Dropdown */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground"
              data-testid={`actions-plan-${plan.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 bg-card border-border text-muted-foreground"
          >
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
              onClick={onView}
              data-testid={`view-plan-${plan.id}`}
            >
              <Eye className="h-3.5 w-3.5 text-primary" />
              Ver
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
              onClick={onEdit}
              data-testid={`edit-plan-${plan.id}`}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
              onClick={onToggleActive}
              data-testid={`toggle-plan-${plan.id}`}
            >
              {isActive
                ? <><PowerOff className="h-3.5 w-3.5 text-amber-400" /> Desativar</>
                : <><Power className="h-3.5 w-3.5 text-emerald-400" /> Ativar</>}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
              onClick={onSyncStripe}
              data-testid={`sync-plan-${plan.id}`}
            >
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              Sincronizar Stripe
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted" />
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400"
              onClick={onDelete}
              data-testid={`delete-plan-${plan.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 pr-8">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: plan.color }} />
        <span className="text-[14px] font-bold text-foreground">{plan.name}</span>
        <Badge
          variant={isActive ? "success" : "neutral"}
          className="ml-auto text-[10px]"
        >
          {isActive ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {/* Subscribers */}
      <p className="text-[11px] text-muted-foreground -mt-2">{plan.active_subscribers} clientes</p>

      {/* Price */}
      <div>
        <p className="text-2xl font-bold text-foreground">
          {fmtBRL(plan.price_monthly)}
          <span className="text-[12px] font-normal text-muted-foreground">/mês</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          ou {fmtBRL(plan.price_annual)}/ano
        </p>
      </div>

      {/* Limits */}
      <div className="space-y-2 border-t border-border pt-3">
        {[
          { icon: Users,      label: `${plan.max_users === 999 ? "Ilimitado" : plan.max_users} usuários` },
          { icon: Tag,        label: `${plan.max_artists === 999 ? "Ilimitados" : plan.max_artists} artistas` },
          { icon: HardDrive,  label: `${plan.max_storage_gb === 1000 ? "1 TB" : `${plan.max_storage_gb} GB`} storage` },
          { icon: DollarSign, label: `MRR: ${fmtBRL(plan.mrr)}` },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="space-y-1.5 border-t border-border pt-3">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: plan.color }} />
            <span className="text-[11px] text-muted-foreground">{f}</span>
          </div>
        ))}
        {plan.features.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">Sem funcionalidades</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
type ModalMode = "view" | "edit" | "create" | "delete" | null;

export default function AdminPlans() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [active, setActive] = useState<AdminPlan | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);

  // Persisted plans (the Admin's source of truth) — no longer in-memory.
  useEffect(() => {
    void adminPlansService.list().then(setPlans);
  }, []);

  function open(plan: AdminPlan, m: ModalMode) { setActive(plan); setMode(m); }
  function close() { setActive(null); setMode(null); }

  function handleSave(updated: AdminPlan) {
    void adminPlansService.save(updated).then(setPlans);
    close();
  }

  function handleDelete() {
    if (!active) return;
    void adminPlansService.remove(active.id).then(setPlans);
    close();
  }

  function handleToggleActive(plan: AdminPlan) {
    void adminPlansService.save({ ...plan, active: plan.active === false }).then(setPlans);
  }

  function handleSyncStripe(plan: AdminPlan) {
    void adminPlansService.syncStripe(plan.id).then(setPlans);
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Planos</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">Gerenciamento de planos e preços</p>
          </div>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setMode("create")}
            data-testid="btn-new-plan"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Plano
          </Button>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onView={() => open(plan, "view")}
              onEdit={() => open(plan, "edit")}
              onToggleActive={() => handleToggleActive(plan)}
              onSyncStripe={() => handleSyncStripe(plan)}
              onDelete={() => open(plan, "delete")}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {mode === "create" && (
        <PlanFormDialog plan={null} onSave={handleSave} onClose={close} />
      )}
      {mode === "edit" && active && (
        <PlanFormDialog plan={active} onSave={handleSave} onClose={close} />
      )}
      {mode === "view" && active && (
        <ViewPlanDialog plan={active} onClose={close} />
      )}
      {mode === "delete" && active && (
        <DeletePlanDialog plan={active} onConfirm={handleDelete} onClose={close} />
      )}
    </AdminLayout>
  );
}
