import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Shield, Building2, UserCheck, Info, AlertTriangle, Eye, Plus, Pencil, Trash2, CheckCircle, Download, Music } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usuarioSchema, type UsuarioFormData } from "@/lib/validation-schemas";
import { FormField, FieldError } from "@/components/forms/FormField";
import { useUsuarios } from "@/hooks/useUsuarios";
interface UsuarioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario?: any;
  mode: "create" | "edit" | "view";
}

type PermissionAction = "visualizar" | "criar" | "editar" | "excluir" | "aprovar" | "exportar";

interface ModulePermissions {
  [module: string]: PermissionAction[];
}

const SETORES = [
  "Administrativo",
  "Artístico",
  "Comercial",
  "Eventos",
  "Financeiro",
  "Jurídico",
  "Marketing",
  "Produção",
  "Recursos Humanos",
  "Técnico",
  "TI",
];

const NIVEIS_ACESSO = [
  { value: "admin_master", label: "Administrador Master", description: "Acesso total a todos os módulos e configurações do sistema." },
  { value: "ar_gestao", label: "A&R / Gestão Artística", description: "Gestão de artistas, projetos, lançamentos e repertório." },
  { value: "financeiro_contabil", label: "Financeiro / Contábil", description: "Acesso a módulos financeiros, royalties e notas fiscais." },
  { value: "juridico", label: "Jurídico", description: "Gestão de contratos, licenciamentos e questões legais." },
  { value: "marketing", label: "Marketing", description: "Campanhas, métricas e gestão de conteúdo promocional." },
  { value: "artista", label: "Artista", description: "Acesso restrito aos próprios dados e projetos vinculados." },
  { value: "colaborador", label: "Colaborador / Freelancer", description: "Acesso limitado a tarefas específicas designadas." },
  { value: "leitor", label: "Leitor (somente leitura)", description: "Visualização sem permissão de edição ou criação." },
];

const MODULOS = [
  { id: "artistas", label: "Artistas", icon: Music, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "projetos", label: "Projetos", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"] as PermissionAction[] },
  { id: "lancamentos", label: "Lançamentos", icon: Music, actions: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"] as PermissionAction[] },
  { id: "registro_musicas", label: "Registro de Músicas", icon: Music, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "contratos", label: "Contratos", icon: Shield, actions: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"] as PermissionAction[] },
  { id: "financeiro", label: "Financeiro", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"] as PermissionAction[] },
  { id: "royalties", label: "Royalties", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "marketing", label: "Marketing", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"] as PermissionAction[] },
  { id: "crm", label: "CRM", icon: UserCheck, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "agenda", label: "Agenda", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "inventario", label: "Inventário", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "servicos", label: "Serviços", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "nota_fiscal", label: "Nota Fiscal", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir", "exportar"] as PermissionAction[] },
  { id: "relatorios", label: "Relatórios", icon: Building2, actions: ["visualizar", "exportar"] as PermissionAction[] },
  { id: "usuarios", label: "Usuários", icon: User, actions: ["visualizar", "criar", "editar", "excluir"] as PermissionAction[] },
  { id: "configuracoes", label: "Configurações", icon: Shield, actions: ["visualizar", "editar"] as PermissionAction[] },
  { id: "landerzap", label: "LanderZap", icon: Building2, actions: ["visualizar", "criar", "editar", "excluir"] as PermissionAction[] },
];

const ACTION_ICONS: Record<PermissionAction, React.ReactNode> = {
  visualizar: <Eye className="h-3 w-3" />,
  criar: <Plus className="h-3 w-3" />,
  editar: <Pencil className="h-3 w-3" />,
  excluir: <Trash2 className="h-3 w-3" />,
  aprovar: <CheckCircle className="h-3 w-3" />,
  exportar: <Download className="h-3 w-3" />,
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
  exportar: "Exportar",
};

const ARTISTAS_OPCOES: { id: string; nome: string }[] = [];

const PERMISSION_TEMPLATES: Record<string, ModulePermissions> = {
  admin_master: MODULOS.reduce((acc, mod) => ({ ...acc, [mod.id]: mod.actions }), {}),
  ar_gestao: {
    artistas: ["visualizar", "criar", "editar", "excluir", "exportar"],
    projetos: ["visualizar", "criar", "editar", "aprovar", "exportar"],
    lancamentos: ["visualizar", "criar", "editar", "aprovar", "exportar"],
    registro_musicas: ["visualizar", "criar", "editar", "exportar"],
    contratos: ["visualizar", "exportar"],
    agenda: ["visualizar", "criar", "editar", "excluir", "exportar"],
    relatorios: ["visualizar", "exportar"],
  },
  financeiro_contabil: {
    financeiro: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"],
    royalties: ["visualizar", "criar", "editar", "excluir", "exportar"],
    nota_fiscal: ["visualizar", "criar", "editar", "excluir", "exportar"],
    contratos: ["visualizar", "exportar"],
    relatorios: ["visualizar", "exportar"],
  },
  juridico: {
    contratos: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"],
    artistas: ["visualizar"],
    projetos: ["visualizar"],
    relatorios: ["visualizar", "exportar"],
  },
  marketing: {
    marketing: ["visualizar", "criar", "editar", "excluir", "aprovar", "exportar"],
    artistas: ["visualizar"],
    lancamentos: ["visualizar"],
    crm: ["visualizar", "criar", "editar", "exportar"],
    relatorios: ["visualizar", "exportar"],
  },
  artista: {
    artistas: ["visualizar"],
    projetos: ["visualizar"],
    lancamentos: ["visualizar"],
    agenda: ["visualizar"],
    relatorios: ["visualizar"],
  },
  colaborador: {
    artistas: ["visualizar"],
    projetos: ["visualizar"],
    agenda: ["visualizar", "criar", "editar"],
  },
  leitor: MODULOS.reduce((acc, mod) => {
    if (mod.actions.includes("visualizar")) {
      return { ...acc, [mod.id]: ["visualizar"] };
    }
    return acc;
  }, {}),
};

const SETOR_PERMISSIONS: Record<string, ModulePermissions> = {
  Artístico: { artistas: ["visualizar"], projetos: ["visualizar"], lancamentos: ["visualizar"] },
  Financeiro: { financeiro: ["visualizar"], royalties: ["visualizar"] },
  Jurídico: { contratos: ["visualizar"] },
  Marketing: { marketing: ["visualizar"], crm: ["visualizar"] },
  Eventos: { agenda: ["visualizar", "criar", "editar"] },
  TI: { configuracoes: ["visualizar"], usuarios: ["visualizar"] },
};


export function UsuarioFormModal({ open, onOpenChange, usuario, mode }: UsuarioFormModalProps) {
  const { updateUsuario } = useUsuarios();
  const [activeTab, setActiveTab] = useState("basico");
  const [permissions, setPermissions] = useState<ModulePermissions>({});
  const [modoPermissao, setModoPermissao] = useState("automatico");
  const [templatePermissao, setTemplatePermissao] = useState("");
  const [artistaVinculado, setArtistaVinculado] = useState("");

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Usuário" : mode === "edit" ? "Editar Usuário" : "Detalhes do Usuário";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    mode: "onChange",
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      status: "ativo",
      setor: "",
      nivel_acesso: "",
    },
  });

  const setor = watch("setor");
  const nivelAcesso = watch("nivel_acesso");

  useEffect(() => {
    if (open) {
      if (usuario && (mode === "edit" || mode === "view")) {
        reset({
          nome: usuario.name || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
          status: usuario.status || "ativo",
          setor: usuario.department || "",
          nivel_acesso: usuario.role || "",
        });
        setArtistaVinculado(usuario.artistaVinculado || "");
        setModoPermissao(usuario.customPermissions ? "manual" : "automatico");
        if (usuario.permissions) {
          setPermissions(usuario.permissions);
        }
      } else {
        reset({
          nome: "",
          email: "",
          telefone: "",
          status: "ativo",
          setor: "",
          nivel_acesso: "",
        });
        setArtistaVinculado("");
        setPermissions({});
        setModoPermissao("automatico");
        setTemplatePermissao("");
      }
      setActiveTab("basico");
    }
  }, [usuario, mode, open, reset]);

  useEffect(() => {
    if (modoPermissao === "automatico" && nivelAcesso) {
      const basePermissions = PERMISSION_TEMPLATES[nivelAcesso] || {};
      const sectorPermissions = setor ? SETOR_PERMISSIONS[setor] || {} : {};

      const mergedPermissions: ModulePermissions = { ...basePermissions };
      Object.entries(sectorPermissions).forEach(([module, actions]) => {
        if (mergedPermissions[module]) {
          const existingActions = new Set(mergedPermissions[module]);
          actions.forEach((action) => existingActions.add(action));
          mergedPermissions[module] = Array.from(existingActions) as PermissionAction[];
        } else {
          mergedPermissions[module] = actions;
        }
      });

      setPermissions(mergedPermissions);
    }
  }, [nivelAcesso, setor, modoPermissao]);

  useEffect(() => {
    if (nivelAcesso !== "artista" && artistaVinculado) {
      setArtistaVinculado("");
    }
  }, [nivelAcesso, artistaVinculado]);

  const handleTemplateChange = (templateId: string) => {
    setTemplatePermissao(templateId);
    if (templateId && PERMISSION_TEMPLATES[templateId]) {
      setPermissions({ ...PERMISSION_TEMPLATES[templateId] });
    }
  };

  const togglePermission = (moduleId: string, action: PermissionAction) => {
    if (modoPermissao === "automatico") return;

    if (templatePermissao) {
      setTemplatePermissao("");
    }

    setPermissions((prev) => {
      const modulePerms = prev[moduleId] || [];
      if (modulePerms.includes(action)) {
        return { ...prev, [moduleId]: modulePerms.filter((a) => a !== action) };
      } else {
        return { ...prev, [moduleId]: [...modulePerms, action] };
      }
    });
  };

  const onSubmit = async (data: UsuarioFormData) => {
    if (isViewMode) return;

    if (modoPermissao === "automatico" && !data.nivel_acesso) {
      toast.error("Nível de acesso é obrigatório no modo automático");
      return;
    }

    if (data.nivel_acesso === "artista" && !artistaVinculado) {
      toast.error("Artista vinculado é obrigatório para o perfil Artista");
      return;
    }

    try {
      if (mode === "edit" && usuario?.id) {
        await updateUsuario.mutateAsync({
          id: usuario.id,
          full_name: data.nome,
          phone: data.telefone,
          cargo: data.nivel_acesso || undefined,
        });
      } else if (mode === "create") {
        // Users are created through the auth signup flow
        toast.info("Novos usuários devem se cadastrar através da página de login.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar usuário");
    }
  };

  const selectedNivel = NIVEIS_ACESSO.find((n) => n.value === nivelAcesso);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="basico" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações Básicas
              </TabsTrigger>
              <TabsTrigger value="permissoes" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCheck className="h-5 w-5" />
                    Dados do Usuário
                  </CardTitle>
                  <CardDescription>Informações principais do usuário no sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Nome Completo"
                      required
                      containerClassName="md:col-span-2"
                      {...register("nome")}
                      disabled={isViewMode}
                      placeholder="Digite o nome completo"
                      error={errors.nome?.message}
                    />

                    <FormField
                      label="Email"
                      required
                      type="email"
                      {...register("email")}
                      disabled={isViewMode}
                      placeholder="usuario@empresa.com"
                      error={errors.email?.message}
                      description={mode === "edit" ? "Alterar o email irá disparar um processo de confirmação" : undefined}
                    />

                    <FormField
                      label="Telefone"
                      {...register("telefone")}
                      disabled={isViewMode}
                      placeholder="(00) 00000-0000"
                      error={errors.telefone?.message}
                    />

                    <div className="space-y-1.5">
                      <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                      <Select
                        value={watch("status")}
                        onValueChange={(v) => setValue("status", v as any, { shouldValidate: true })}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.status?.message} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissoes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5" />
                    Configuração de Permissões
                  </CardTitle>
                  <CardDescription>Defina o setor, nível de acesso e permissões do usuário</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="setor">Setor</Label>
                      <Select
                        value={setor || ""}
                        onValueChange={(v) => setValue("setor", v)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {SETORES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nivelAcesso">Nível de Acesso (Perfil) *</Label>
                      <Select
                        value={nivelAcesso || ""}
                        onValueChange={(v) => setValue("nivel_acesso", v)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          {NIVEIS_ACESSO.map((nivel) => (
                            <SelectItem key={nivel.value} value={nivel.value}>
                              {nivel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.nivel_acesso?.message} />
                    </div>
                  </div>

                  {selectedNivel && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>{selectedNivel.description}</AlertDescription>
                    </Alert>
                  )}

                  <Separator />

                  {nivelAcesso === "artista" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Music className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Vinculação de Artista</h4>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="artistaVinculado">Artista Vinculado *</Label>
                        <Select
                          value={artistaVinculado}
                          onValueChange={setArtistaVinculado}
                          disabled={isViewMode}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um artista" />
                          </SelectTrigger>
                          <SelectContent>
                            {ARTISTAS_OPCOES.map((artista) => (
                              <SelectItem key={artista.id} value={artista.id}>
                                {artista.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          O usuário terá acesso apenas aos dados deste artista.
                        </p>
                      </div>
                      <Separator />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Modo de Configuração</Label>
                      <Select
                        value={modoPermissao}
                        onValueChange={(v) => {
                          setModoPermissao(v);
                          setTemplatePermissao("");
                        }}
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatico">Automático</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {modoPermissao === "automatico" ? (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          As permissões são atribuídas automaticamente com base no nível de acesso e setor selecionados.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 [&>svg]:text-amber-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Configuração avançada. Você pode customizar permissões detalhadas por módulo.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {modoPermissao === "manual" && (
                    <div className="space-y-2">
                      <Label>Template de Permissão (opcional)</Label>
                      <Select
                        value={templatePermissao}
                        onValueChange={handleTemplateChange}
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template como ponto de partida" />
                        </SelectTrigger>
                        <SelectContent>
                          {NIVEIS_ACESSO.map((nivel) => (
                            <SelectItem key={nivel.value} value={nivel.value}>
                              {nivel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Permissões por Módulo
                    </h4>

                    <div className="grid gap-3">
                      {MODULOS.map((modulo) => {
                        const modulePerms = permissions[modulo.id] || [];
                        const ModuleIcon = modulo.icon;

                        return (
                          <div key={modulo.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{modulo.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {modulo.actions.map((action) => {
                                const isChecked = modulePerms.includes(action);
                                const isDisabled = isViewMode || modoPermissao === "automatico";

                                return (
                                  <label
                                    key={action}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
                                      isChecked
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "bg-muted/50 border-border text-muted-foreground"
                                    } ${isDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-muted"}`}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => togglePermission(modulo.id, action)}
                                      disabled={isDisabled}
                                      className="h-3 w-3"
                                    />
                                    {ACTION_ICONS[action]}
                                    {ACTION_LABELS[action]}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : mode === "create" ? "Criar Usuário" : "Atualizar Usuário"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
