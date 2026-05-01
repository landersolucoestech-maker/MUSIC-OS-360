import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useUsuarios, Usuario } from "@/hooks/useUsuarios";
import { useRoles, Role } from "@/hooks/useRoles";
import { UsuarioFormModal } from "@/components/forms/UsuarioFormModal";
import { UsuarioViewModal } from "@/components/forms/UsuarioViewModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  User, Building2, Zap, Shield, Palette, Globe, Link, 
  Bell, Mail, Calendar, Clock, Key, Smartphone, Eye, EyeOff,
  Sun, Moon, Monitor, Check, ExternalLink, RefreshCw, Trash2,
  Music, FileText, DollarSign, Users, Loader2, Search, UserCog,
  Send, X, ChevronRight, Plus, Pencil, Download, CheckCircle, LucideIcon, Settings
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { LeadIntegrationsDialog } from "@/components/forms/LeadIntegrationsDialog";
import { AbramusConfigDialog } from "@/components/forms/AbramusConfigDialog";
import { useAbramusStatus } from "@/hooks/useAbramus";
import { MetaAdsConfigDialog } from "@/components/forms/MetaAdsConfigDialog";
import { useMetaAdsStatus } from "@/hooks/useMetaAds";
import { ResendConfigDialog } from "@/components/forms/ResendConfigDialog";
import { useResendStatus } from "@/hooks/useResend";
import { AutentiqueConfigDialog } from "@/components/forms/AutentiqueConfigDialog";
import { useAutentiqueStatus } from "@/hooks/useAutentique";
import {
  IntegrationStatusBadges,
  type IntegrationNotice,
} from "@/components/shared/IntegrationStatusBadges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Database, Sparkles } from "lucide-react";
import { resetMockData } from "@/data/mockData";

const PERMISSION_TYPES: { id: string; label: string; icon?: LucideIcon }[] = [
  { id: "view", label: "Visualizar", icon: Eye },
  { id: "create", label: "+ Criar", icon: Plus },
  { id: "edit", label: "Editar", icon: Pencil },
  { id: "delete", label: "Excluir", icon: Trash2 },
  { id: "approve", label: "Aprovar", icon: CheckCircle },
  { id: "export", label: "Exportar", icon: Download },
];

const PERMISSION_MODULES = [
  { id: "artistas", name: "Artistas" },
  { id: "projetos", name: "Projetos" },
  { id: "lancamentos", name: "Lançamentos" },
  { id: "contratos", name: "Contratos" },
  { id: "royalties", name: "Royalties" },
  { id: "financeiro", name: "Financeiro" },
  { id: "marketing", name: "Marketing" },
  { id: "integracoes", name: "Integrações" },
  { id: "usuarios", name: "Usuários" },
  { id: "relatorios", name: "Relatórios" },
  { id: "configuracoes", name: "Configurações" },
  { id: "registro_musicas", name: "Registro de Músicas" },
  { id: "crm", name: "CRM" },
  { id: "agenda", name: "Agenda" },
  { id: "inventario", name: "Inventário" },
  { id: "servicos", name: "Serviços" },
  { id: "nota_fiscal", name: "Nota Fiscal" },
  { id: "landerzap", name: "LanderZap" },
];

export default function Configuracoes() {
  const { user, updatePassword } = useAuth();
  const { 
    userSettings, 
    companySettings, 
    orgSlug,
    loading, 
    saving,
    setUserSettings, 
    setCompanySettings,
    setOrgSlug,
    saveUserSettings, 
    saveCompanySettings,
    saveOrgSlug,
  } = useUserSettings();
  const [slugError, setSlugError] = useState<string>("");
  const { usuarios, isLoading: usuariosLoading } = useUsuarios();
  const currentUserRole = useMemo(
    () => usuarios.find((u) => u.id === user?.id)?.role,
    [usuarios, user?.id],
  );
  const isAdmin = currentUserRole === "admin";
  const [seedLoading, setSeedLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const handleLoadDemoData = async () => {
    setSeedLoading(true);
    try {
      resetMockData();
      toast.success("Dados de demonstração restaurados.");
    } finally {
      setSeedLoading(false);
    }
  };

  const handleClearDemoData = async () => {
    setClearLoading(true);
    setClearConfirmOpen(false);
    try {
      try {
        localStorage.removeItem("lander_mock_data");
      } catch {
        // ignora falha de quota / acesso
      }
      window.location.reload();
    } finally {
      setClearLoading(false);
    }
  };
  const { 
    roles, 
    teamInvites,
    isLoading: rolesLoading,
    inviteUser,
    cancelInvite,
    assignRoleToUser,
    getPermissionsForRole,
    createRole,
    getPermissionsByCategory,
  } = useRoles();

  const [showPassword, setShowPassword] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>("");
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  // Estados para modal de criar papel
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [leadIntegrationsOpen, setLeadIntegrationsOpen] = useState(false);
  const [abramusConfigOpen, setAbramusConfigOpen] = useState(false);
  const [metaAdsConfigOpen, setMetaAdsConfigOpen] = useState(false);
  const [resendConfigOpen, setResendConfigOpen] = useState(false);
  const [autentiqueConfigOpen, setAutentiqueConfigOpen] = useState(false);
  const { data: abramusStatus } = useAbramusStatus();
  const { data: metaAdsStatus } = useMetaAdsStatus();
  const { data: resendStatus } = useResendStatus();
  const { data: autentiqueStatus } = useAutentiqueStatus();

  // Estados para aba de Usuários
  const [usuarioFormModal, setUsuarioFormModal] = useState<{ open: boolean; mode: "create" | "edit"; usuario?: Usuario }>({ open: false, mode: "create" });
  const [usuarioViewModal, setUsuarioViewModal] = useState<{ open: boolean; usuario?: Usuario }>({ open: false });
  const [usuarioSearchTerm, setUsuarioSearchTerm] = useState("");
  const [usuarioCargoFilter, setUsuarioCargoFilter] = useState("all-cargo");
  const [usuarioStatusFilter, setUsuarioStatusFilter] = useState("all-status");

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((usuario) => {
      const matchesSearch = 
        (usuario.full_name?.toLowerCase().includes(usuarioSearchTerm.toLowerCase()) || false) ||
        (usuario.email?.toLowerCase().includes(usuarioSearchTerm.toLowerCase()) || false);
      const matchesCargo = usuarioCargoFilter === "all-cargo" || 
        (usuarioCargoFilter === "admin" && usuario.role === "admin") ||
        (usuarioCargoFilter === "usuario" && usuario.role !== "admin");
      const matchesStatus = usuarioStatusFilter === "all-status" || usuario.status === usuarioStatusFilter;
      return matchesSearch && matchesCargo && matchesStatus;
    });
  }, [usuarios, usuarioSearchTerm, usuarioCargoFilter, usuarioStatusFilter]);

  const hasActiveUsuarioFilters = usuarioSearchTerm !== "" || usuarioCargoFilter !== "all-cargo" || usuarioStatusFilter !== "all-status";

  const clearUsuarioFilters = () => {
    setUsuarioSearchTerm("");
    setUsuarioCargoFilter("all-cargo");
    setUsuarioStatusFilter("all-status");
  };

  const getUsuarioInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const formatUsuarioDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Digite um email válido");
      return;
    }
    try {
      await inviteUser.mutateAsync({ email: inviteEmail, roleId: inviteRoleId || undefined });
      toast.success("Convite enviado com sucesso!");
      setInviteEmail("");
      setInviteRoleId("");
    } catch (error) {
      toast.error("Erro ao enviar convite");
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await assignRoleToUser.mutateAsync({ userId, roleId });
      toast.success("Papel atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar papel");
    }
  };

  const handleViewPermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsModalOpen(true);
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Digite um nome para o papel");
      return;
    }
    try {
      await createRole.mutateAsync({ 
        name: newRoleName, 
        description: newRoleDescription || undefined,
        is_system: false,
        priority: 50,
      });
      toast.success("Papel criado com sucesso!");
      setCreateRoleModalOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedPermissions([]);
    } catch (error) {
      toast.error("Erro ao criar papel");
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId) 
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const metaAdsNotices: IntegrationNotice[] = [];
  if (!metaAdsStatus?.connected && !metaAdsStatus?.has_token) {
    if (metaAdsStatus?.global_fallback_status === "valid") {
      metaAdsNotices.push({
        id: "global-fallback",
        label: "Token global",
        tooltip:
          "Esta organização ainda usa o token global compartilhado (META_ACCESS_TOKEN). Configure credenciais próprias para isolar acessos por conta.",
        variant: "warning",
      });
    } else if (metaAdsStatus?.global_fallback_status === "invalid") {
      metaAdsNotices.push({
        id: "global-fallback-invalid",
        label: "Token global inválido",
        tooltip:
          metaAdsStatus.global_fallback_error
            ? `O token global compartilhado (META_ACCESS_TOKEN) está expirado ou inválido: ${metaAdsStatus.global_fallback_error}. Configure credenciais próprias.`
            : "O token global compartilhado (META_ACCESS_TOKEN) está expirado ou inválido. Configure credenciais próprias para esta organização.",
        variant: "destructive",
      });
    }
  }

  const integracoes: Array<{
    id: string;
    name: string;
    icon: string;
    status: "conectado" | "desconectado";
    description: string;
    configurable?: boolean;
    notices?: IntegrationNotice[];
  }> = [
    { id: "ecad", name: "ECAD", icon: "📊", status: "desconectado", description: "Integração com relatórios ECAD" },
    {
      id: "abramus",
      name: "ABRAMUS",
      icon: "🎼",
      status: abramusStatus?.connected ? "conectado" : "desconectado",
      description: "Buscar e importar obras/fonogramas registrados",
      configurable: true,
    },
    {
      id: "meta_ads",
      name: "Meta Ads",
      icon: "📣",
      status: metaAdsStatus?.connected ? "conectado" : "desconectado",
      description: "Métricas de campanhas do Facebook e Instagram Ads",
      configurable: true,
      notices: metaAdsNotices,
    },
    {
      id: "resend",
      name: "Resend",
      icon: "✉️",
      status: resendStatus?.connected ? "conectado" : "desconectado",
      description: "Envio de e-mails transacionais a partir do seu domínio",
      configurable: true,
    },
    {
      id: "autentique",
      name: "Autentique",
      icon: "✍️",
      status: autentiqueStatus?.connected ? "conectado" : "desconectado",
      description: "Envio e acompanhamento de contratos com assinatura digital",
      configurable: true,
    },
    { id: "distrokid", name: "DistroKid", icon: "📀", status: "desconectado", description: "Importar lançamentos e royalties" },
    { id: "google", name: "Google Drive", icon: "📁", status: "desconectado", description: "Backup automático de documentos" },
  ];

  const integrationConfigHandlers: Record<string, () => void> = {
    abramus: () => setAbramusConfigOpen(true),
    meta_ads: () => setMetaAdsConfigOpen(true),
    resend: () => setResendConfigOpen(true),
    autentique: () => setAutentiqueConfigOpen(true),
  };

  const handleSaveProfile = () => {
    saveUserSettings({
      full_name: userSettings.full_name,
      phone: userSettings.phone,
      cargo: userSettings.cargo,
      notify_email: userSettings.notify_email,
      notify_push: userSettings.notify_push,
    });
  };

  const handleSaveCompany = async () => {
    if (orgSlug) {
      const normalized = orgSlug.trim().toLowerCase();
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(normalized)) {
        setSlugError("Use apenas letras minúsculas, números e hífens.");
        return;
      }
      setSlugError("");
      if (normalized !== orgSlug) setOrgSlug(normalized);
      const slugSaved = await saveOrgSlug(normalized);
      if (!slugSaved) return;
    }
    saveCompanySettings(companySettings);
  };

  const handleSaveAutomacoes = () => {
    saveUserSettings({
      auto_notificar_vencimento: userSettings.auto_notificar_vencimento,
      auto_lembrete_renovacao: userSettings.auto_lembrete_renovacao,
      auto_alerta_financeiro: userSettings.auto_alerta_financeiro,
      auto_backup: userSettings.auto_backup,
      auto_relatorio_semanal: userSettings.auto_relatorio_semanal,
    });
  };

  const handleSaveAparencia = () => {
    saveUserSettings({
      theme: userSettings.theme,
      accent_color: userSettings.accent_color,
      sidebar_compact: userSettings.sidebar_compact,
      animations_enabled: userSettings.animations_enabled,
    });
  };

  const handleSaveIdioma = () => {
    saveUserSettings({
      language: userSettings.language,
      timezone: userSettings.timezone,
      date_format: userSettings.date_format,
      time_format: userSettings.time_format,
      currency: userSettings.currency,
    });
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    const { error } = await updatePassword(passwords.new);
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setPasswords({ current: "", new: "", confirm: "" });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Configurações" description="Gerencie as configurações do sistema e preferências">
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs defaultValue="empresa">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="empresa" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="automacoes" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="aparencia" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="idioma" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Idioma
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* Empresa */}
          <TabsContent value="empresa" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>Informações da empresa para contratos e documentos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Razão Social</Label>
                    <Input 
                      placeholder="Lander Records Produções Artísticas LTDA" 
                      value={companySettings.company_name}
                      onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input 
                      placeholder="Lander Records" 
                      value={companySettings.fantasy_name}
                      onChange={(e) => setCompanySettings({ ...companySettings, fantasy_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input 
                    placeholder="50.056.858/0001-46" 
                    value={companySettings.cnpj}
                    onChange={(e) => setCompanySettings({ ...companySettings, cnpj: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endereço Completo</Label>
                  <Input 
                    placeholder="Rua A, nº 58, Bairro Vila Império, Governador Valadares/MG, CEP 35050-560" 
                    value={companySettings.logradouro}
                    onChange={(e) => setCompanySettings({ ...companySettings, logradouro: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Telefone/WhatsApp</Label>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      value={companySettings.telefone}
                      onChange={(e) => setCompanySettings({ ...companySettings, telefone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Input 
                      placeholder="Deyvisson Lander Andrade" 
                      value={companySettings.responsavel}
                      onChange={(e) => setCompanySettings({ ...companySettings, responsavel: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-slug">Slug da organização</Label>
                  <Input
                    id="org-slug"
                    data-testid="input-org-slug"
                    placeholder="minha-gravadora"
                    value={orgSlug}
                    onChange={(e) => {
                      setOrgSlug(e.target.value);
                      setSlugError("");
                    }}
                  />
                  {slugError && (
                    <p className="text-sm text-destructive" data-testid="text-slug-error">{slugError}</p>
                  )}
                  {orgSlug && !slugError && (
                    <p className="text-sm text-muted-foreground" data-testid="text-slug-preview">
                      Link de cadastro:{" "}
                      <span className="font-mono">{window.location.origin}/signup/artista/{orgSlug}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Usado no link público de cadastro de artistas. Apenas letras minúsculas, números e hífens.
                  </p>
                </div>

                <Button 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={handleSaveCompany}
                  disabled={saving}
                  data-testid="button-save-company"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Dados
                </Button>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card data-testid="card-demo-data">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Dados de Demonstração
                  </CardTitle>
                  <CardDescription>
                    Carregue a base fictícia da Lander Records (8 artistas, contratos,
                    finanças, marketing, RH, leads etc.) para apresentações comerciais
                    e testes. Disponível apenas para administradores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    O sistema opera totalmente em modo standalone. Todas as alterações
                    são salvas localmente no navegador (localStorage). Você pode
                    restaurar os dados originais ou limpar tudo a qualquer momento.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleLoadDemoData}
                      disabled={seedLoading || clearLoading}
                      data-testid="button-load-demo-data"
                    >
                      {seedLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Carregar dados demo
                    </Button>

                    <AlertDialog
                      open={clearConfirmOpen}
                      onOpenChange={setClearConfirmOpen}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={seedLoading || clearLoading}
                          data-testid="button-clear-demo-data"
                        >
                          {clearLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Limpar dados demo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remover dados de demonstração?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os registros com UUIDs iniciados em{" "}
                            <code>5eed</code> serão apagados permanentemente.
                            Dados reais, contas de usuário e configurações da
                            aplicação não serão afetados. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-clear-demo">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleClearDemoData}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid="button-confirm-clear-demo"
                          >
                            Sim, limpar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Automações */}
          <TabsContent value="automacoes" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Automações & Notificações
                </CardTitle>
                <CardDescription>Configure quando, como e por qual canal o sistema deve notificar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Canais de Notificação */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Canais de Notificação
                  </h4>
                  <p className="text-sm text-muted-foreground">Configuração de meios de envio</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">E-mail</span>
                      </div>
                      <Switch 
                        checked={userSettings.notify_email} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, notify_email: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">SMS</span>
                      </div>
                      <Switch checked={false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Push/In-App</span>
                      </div>
                      <Switch 
                        checked={userSettings.notify_push} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, notify_push: checked })} 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contratos */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Contratos
                  </h4>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Novo contrato criado</p>
                        <p className="text-xs text-muted-foreground">Notificar quando um novo contrato for cadastrado</p>
                      </div>
                      <Switch 
                        checked={userSettings.notify_contratos} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, notify_contratos: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Contrato próximo do vencimento</p>
                        <p className="text-xs text-muted-foreground">Notificar 30, 15 e 7 dias antes do vencimento</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_notificar_vencimento} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_notificar_vencimento: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Contrato vencido</p>
                        <p className="text-xs text-muted-foreground">Alertar quando um contrato expirar</p>
                      </div>
                      <Switch checked={true} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Sugestão automática de renovação</p>
                        <p className="text-xs text-muted-foreground">Disparada quando o contrato entra no período final</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_lembrete_renovacao} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_lembrete_renovacao: checked })} 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Financeiro */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financeiro
                  </h4>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Alerta de saldo baixo</p>
                        <p className="text-xs text-muted-foreground">Configurável por valor mínimo</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_alerta_financeiro} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_alerta_financeiro: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Movimentação financeira relevante</p>
                        <p className="text-xs text-muted-foreground">Ex: novos lançamentos, cobranças ou pagamentos</p>
                      </div>
                      <Switch 
                        checked={userSettings.notify_financeiro} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, notify_financeiro: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Resumo financeiro semanal</p>
                        <p className="text-xs text-muted-foreground">Receba um resumo das movimentações da semana</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_relatorio_semanal} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_relatorio_semanal: checked })} 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Relatórios & Resumos */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Relatórios & Resumos
                  </h4>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Relatório semanal de atividades</p>
                        <p className="text-xs text-muted-foreground">Atividades, financeiro e contratos</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_relatorio_semanal} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_relatorio_semanal: checked })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Lembretes semanais automáticos</p>
                        <p className="text-xs text-muted-foreground">Pendências, contratos a vencer e ações recomendadas</p>
                      </div>
                      <Switch checked={true} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sistema */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sistema
                  </h4>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Alertas críticos do sistema</p>
                        <p className="text-xs text-muted-foreground">Erros, falhas de integração e eventos importantes</p>
                      </div>
                      <Switch checked={true} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Notificações operacionais</p>
                        <p className="text-xs text-muted-foreground">Atualizações relevantes e ações pendentes do usuário</p>
                      </div>
                      <Switch checked={true} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Backup automático</p>
                        <p className="text-xs text-muted-foreground">Realizar backup diário dos dados</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_backup} 
                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, auto_backup: checked })} 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Frequência & Regras */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Frequência & Preferências
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Frequência de envio</Label>
                      <Select defaultValue="imediato">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imediato">Imediato</SelectItem>
                          <SelectItem value="diario">Diário (resumo)</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="evento">Por evento/gatilho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Horário preferido de recebimento</Label>
                      <Select defaultValue="09:00">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o horário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="08:00">08:00</SelectItem>
                          <SelectItem value="09:00">09:00</SelectItem>
                          <SelectItem value="10:00">10:00</SelectItem>
                          <SelectItem value="12:00">12:00</SelectItem>
                          <SelectItem value="14:00">14:00</SelectItem>
                          <SelectItem value="18:00">18:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={handleSaveAutomacoes}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Segurança */}
          <TabsContent value="seguranca" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança da Conta
                </CardTitle>
                <CardDescription>Gerencie a segurança e acesso da sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Alterar Senha</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Senha Atual</Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••"
                          value={passwords.current}
                          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div />
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <Input 
                        type="password" 
                        placeholder="••••••••"
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Nova Senha</Label>
                      <Input 
                        type="password" 
                        placeholder="••••••••"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleChangePassword}>
                    <Key className="h-4 w-4 mr-2" />
                    Alterar Senha
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Autenticação em Duas Etapas</h4>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Autenticação 2FA</p>
                        <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
                      </div>
                    </div>
                    <Button variant="outline">Configurar</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Sessões Ativas</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">Sessão Atual</p>
                          <p className="text-sm text-muted-foreground">Chrome • Windows • São Paulo, BR</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600">Ativa</Badge>
                    </div>
                  </div>
                  <Button variant="outline" className="text-red-500 hover:text-red-600">
                    Encerrar Todas as Outras Sessões
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-red-500">Zona de Perigo</h4>
                  <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Excluir Conta</p>
                        <p className="text-sm text-muted-foreground">Esta ação é irreversível</p>
                      </div>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aparência */}
          <TabsContent value="aparencia" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Aparência
                </CardTitle>
                <CardDescription>Personalize a aparência do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Tema</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setUserSettings({ ...userSettings, theme: "light" })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        userSettings.theme === "light" ? "border-red-600 bg-muted/30" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Sun className="h-8 w-8" />
                        <span className="text-sm font-medium">Claro</span>
                        {userSettings.theme === "light" && <Check className="h-4 w-4 text-red-600" />}
                      </div>
                    </button>
                    <button
                      onClick={() => setUserSettings({ ...userSettings, theme: "dark" })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        userSettings.theme === "dark" ? "border-red-600 bg-muted/30" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Moon className="h-8 w-8" />
                        <span className="text-sm font-medium">Escuro</span>
                        {userSettings.theme === "dark" && <Check className="h-4 w-4 text-red-600" />}
                      </div>
                    </button>
                    <button
                      onClick={() => setUserSettings({ ...userSettings, theme: "system" })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        userSettings.theme === "system" ? "border-red-600 bg-muted/30" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Monitor className="h-8 w-8" />
                        <span className="text-sm font-medium">Sistema</span>
                        {userSettings.theme === "system" && <Check className="h-4 w-4 text-red-600" />}
                      </div>
                    </button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Cor de Destaque</h4>
                  <div className="flex gap-3">
                    {[
                      { name: "red", label: "Vermelho", color: "bg-red-600" },
                      { name: "blue", label: "Azul", color: "bg-blue-600" },
                      { name: "green", label: "Verde", color: "bg-green-600" },
                      { name: "purple", label: "Roxo", color: "bg-purple-600" },
                      { name: "orange", label: "Laranja", color: "bg-orange-600" },
                      { name: "pink", label: "Rosa", color: "bg-pink-600" },
                    ].map((cor) => (
                      <button
                        key={cor.name}
                        onClick={() => setUserSettings({ ...userSettings, accent_color: cor.name })}
                        className={`w-10 h-10 rounded-full ${cor.color} ring-2 ring-offset-2 ring-offset-background ${
                          userSettings.accent_color === cor.name ? "ring-current" : "ring-transparent hover:ring-muted-foreground"
                        }`}
                        title={cor.label}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Layout</h4>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Sidebar compacta</p>
                      <p className="text-xs text-muted-foreground">Reduzir largura da barra lateral</p>
                    </div>
                    <Switch 
                      checked={userSettings.sidebar_compact}
                      onCheckedChange={(checked) => setUserSettings({ ...userSettings, sidebar_compact: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Animações</p>
                      <p className="text-xs text-muted-foreground">Habilitar animações de transição</p>
                    </div>
                    <Switch 
                      checked={userSettings.animations_enabled}
                      onCheckedChange={(checked) => setUserSettings({ ...userSettings, animations_enabled: checked })}
                    />
                  </div>
                </div>

                <Button 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={handleSaveAparencia}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Preferências
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Idioma */}
          <TabsContent value="idioma" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Idioma e Região
                </CardTitle>
                <CardDescription>Configure idioma, formato de data e moeda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Idioma do Sistema</Label>
                    <Select 
                      value={userSettings.language} 
                      onValueChange={(value) => setUserSettings({ ...userSettings, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                        <SelectItem value="es">🇪🇸 Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fuso Horário</Label>
                    <Select 
                      value={userSettings.timezone}
                      onValueChange={(value) => setUserSettings({ ...userSettings, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                        <SelectItem value="America/New_York">Nova York (GMT-5)</SelectItem>
                        <SelectItem value="Europe/London">Londres (GMT+0)</SelectItem>
                        <SelectItem value="Europe/Lisbon">Lisboa (GMT+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Formato de Data</Label>
                    <Select 
                      value={userSettings.date_format}
                      onValueChange={(value) => setUserSettings({ ...userSettings, date_format: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/AAAA (27/12/2025)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/AAAA (12/27/2025)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">AAAA-MM-DD (2025-12-27)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select 
                      value={userSettings.currency}
                      onValueChange={(value) => setUserSettings({ ...userSettings, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">R$ Real Brasileiro (BRL)</SelectItem>
                        <SelectItem value="USD">$ Dólar Americano (USD)</SelectItem>
                        <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Formato de Hora
                  </h4>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setUserSettings({ ...userSettings, time_format: "24h" })}
                      className={`flex-1 p-4 rounded-lg border-2 ${
                        userSettings.time_format === "24h" ? "border-red-600 bg-muted/30" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="text-center">
                        <p className="text-lg font-bold">14:30</p>
                        <p className="text-sm text-muted-foreground">24 horas</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => setUserSettings({ ...userSettings, time_format: "12h" })}
                      className={`flex-1 p-4 rounded-lg border-2 ${
                        userSettings.time_format === "12h" ? "border-red-600 bg-muted/30" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="text-center">
                        <p className="text-lg font-bold">2:30 PM</p>
                        <p className="text-sm text-muted-foreground">12 horas</p>
                      </div>
                    </button>
                  </div>
                </div>

                <Button 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={handleSaveIdioma}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrações */}
          <TabsContent value="integracoes" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Integrações
                </CardTitle>
                <CardDescription>Conecte serviços externos para automatizar processos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integracoes.map((integracao) => {
                  const handler = integrationConfigHandlers[integracao.id];
                  const isConfigurable = Boolean(handler);
                  return (
                    <div
                      key={integracao.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`integration-row-${integracao.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl">
                          {integracao.icon}
                        </div>
                        <div>
                          <p className="font-medium">{integracao.name}</p>
                          <p className="text-sm text-muted-foreground">{integracao.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IntegrationStatusBadges
                          status={integracao.status}
                          notices={integracao.notices}
                          testIdPrefix={`badge-integration-${integracao.id}`}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handler}
                          disabled={!isConfigurable}
                          data-testid={`button-integration-${integracao.id}`}
                        >
                          {isConfigurable
                            ? integracao.status === "conectado"
                              ? "Gerenciar"
                              : "Conectar"
                            : "Em breve"}
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <Separator className="my-6" />

                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">Não encontrou a integração que precisa?</p>
                  <Button variant="outline">
                    Solicitar Nova Integração
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Captação de Leads
                </CardTitle>
                <CardDescription>Configure webhooks para receber leads automaticamente de plataformas de anúncios e formulários do site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Facebook Ads, Instagram Ads, Google Ads e Website</p>
                    <p className="text-sm text-muted-foreground">URLs de webhook, instruções de configuração e formulário público de captação</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLeadIntegrationsOpen(true)} data-testid="button-lead-integrations">
                    Configurar
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <LeadIntegrationsDialog
              open={leadIntegrationsOpen}
              onOpenChange={setLeadIntegrationsOpen}
            />
            <AbramusConfigDialog
              open={abramusConfigOpen}
              onOpenChange={setAbramusConfigOpen}
            />
            <MetaAdsConfigDialog
              open={metaAdsConfigOpen}
              onOpenChange={setMetaAdsConfigOpen}
            />
            <ResendConfigDialog
              open={resendConfigOpen}
              onOpenChange={setResendConfigOpen}
            />
            <AutentiqueConfigDialog
              open={autentiqueConfigOpen}
              onOpenChange={setAutentiqueConfigOpen}
            />
          </TabsContent>

          {/* Usuários */}
          <TabsContent value="usuarios" className="mt-6 space-y-6">
            {/* Gerenciar Equipe */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gerenciar Equipe
                </CardTitle>
                <CardDescription>Gerencie o acesso dos usuários</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Convite de Usuário */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Digite o endereço de email" 
                      className="pl-10" 
                      value={inviteEmail} 
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <Select value={usuarioCargoFilter} onValueChange={setUsuarioCargoFilter}>
                    <SelectTrigger className="w-[120px]" data-testid="select-filter-all">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-cargo">Todos</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="usuario">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    className="gap-2" 
                    onClick={handleInviteUser}
                    disabled={inviteUser.isPending}
                    data-testid="button-invite"
                  >
                    {inviteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Convidar
                  </Button>
                </div>

                {/* Lista de Membros */}
                {usuariosLoading || rolesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredUsuarios.length === 0 && teamInvites.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum membro na equipe"
                    description="Convide membros para sua equipe usando o campo acima."
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Usuários ativos */}
                    {filteredUsuarios.map((usuario) => (
                      <div 
                        key={usuario.id} 
                        className="flex items-center gap-4 py-3 border-b border-border last:border-0"
                        data-testid={`row-user-${usuario.id}`}
                      >
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-foreground font-medium text-sm">
                          {getUsuarioInitials(usuario.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{usuario.full_name || "Usuário"}</p>
                          <p className="text-sm text-muted-foreground truncate">{usuario.email}</p>
                        </div>
                        <Select 
                          value={usuario.role === "admin" ? "admin" : "usuario"}
                          onValueChange={(value) => {
                            // Update role logic
                          }}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-role-${usuario.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.length > 0 ? (
                              roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="usuario">Usuário</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <Select 
                          value={usuario.status || "ativo"}
                          onValueChange={(value) => {
                            // Update status logic
                          }}
                        >
                          <SelectTrigger className="w-[120px]" data-testid={`select-status-${usuario.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-remove-user-${usuario.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Convites pendentes */}
                    {teamInvites.map((invite) => (
                      <div 
                        key={invite.id} 
                        className="flex items-center gap-4 py-3 border-b border-border last:border-0 opacity-60"
                        data-testid={`row-invite-${invite.id}`}
                      >
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-medium text-sm">
                          {invite.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{invite.email}</p>
                          <p className="text-sm text-muted-foreground">Convite enviado</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {invite.role?.name || "Sem papel"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Pendente
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => cancelInvite.mutate(invite.id)}
                          data-testid={`button-cancel-invite-${invite.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Papéis e Permissões */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Papéis e Permissões
                  </CardTitle>
                  <CardDescription>Crie e edite papéis com permissões específicas</CardDescription>
                </div>
                <Button 
                  onClick={() => setCreateRoleModalOpen(true)}
                  data-testid="button-create-role"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Papel
                </Button>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : roles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Nenhum papel configurado ainda.</p>
                    <p className="text-sm text-muted-foreground">Os papéis padrão serão criados automaticamente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <div 
                        key={role.id} 
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                        data-testid={`row-role-${role.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{role.name}</p>
                            {role.description && (
                              <p className="text-sm text-muted-foreground">{role.description}</p>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-2 text-muted-foreground hover:text-foreground"
                          onClick={() => handleViewPermissions(role)}
                          data-testid={`button-view-permissions-${role.id}`}
                        >
                          Ver Permissões
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {(
          <Card className="mt-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-base">
                <Database className="h-4 w-4" />
                Dados de Demonstração
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                O sistema está em modo demo. Todas as alterações são salvas no navegador e persistem entre sessões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    data-testid="button-reset-demo-data"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restaurar dados originais
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restaurar dados de demonstração?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso apagará todas as alterações feitas durante a demonstração (artistas, leads, contratos, etc.) e restaurará os dados originais. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={resetMockData}
                      className="bg-amber-600 hover:bg-amber-700"
                      data-testid="button-confirm-reset-demo"
                    >
                      Restaurar dados originais
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>

      <UsuarioViewModal 
        open={usuarioViewModal.open} 
        onOpenChange={(open) => setUsuarioViewModal({ ...usuarioViewModal, open })} 
        usuario={usuarioViewModal.usuario} 
      />
      <UsuarioFormModal 
        open={usuarioFormModal.open} 
        onOpenChange={(open) => setUsuarioFormModal({ ...usuarioFormModal, open })} 
        usuario={usuarioFormModal.usuario} 
        mode={usuarioFormModal.mode} 
      />

      {/* Modal de Permissões */}
      <Dialog open={permissionsModalOpen} onOpenChange={setPermissionsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedRole?.description || "Visualize as permissões deste papel"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {selectedRole && (() => {
              const rolePerms = getPermissionsForRole(selectedRole.id);
              if (rolePerms.length === 0) {
                return (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma permissão configurada para este papel.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      As permissões serão configuradas pelo administrador.
                    </p>
                  </div>
                );
              }

              const grouped: Record<string, typeof rolePerms> = {};
              rolePerms.forEach(p => {
                if (!grouped[p.category]) grouped[p.category] = [];
                grouped[p.category].push(p);
              });

              return Object.entries(grouped).map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-foreground">{category}</h4>
                  <div className="grid gap-2">
                    {perms.map((perm) => (
                      <div 
                        key={perm.id}
                        className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{perm.label}</p>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criar Papel */}
      <Dialog open={createRoleModalOpen} onOpenChange={setCreateRoleModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Criar Novo Papel
            </DialogTitle>
            <DialogDescription>
              Defina um novo papel e suas permissões
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nome do Papel</Label>
              <Input
                id="role-name"
                placeholder="Ex: Produtor Musical"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                data-testid="input-role-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role-description">Descrição</Label>
              <Textarea
                id="role-description"
                placeholder="Descreva as responsabilidades deste papel..."
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-role-description"
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <Label className="text-base font-semibold">Permissões Detalhadas</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure permissões específicas para cada módulo do sistema
              </p>
              
              <div className="space-y-1 pt-4">
                {PERMISSION_MODULES.map((module) => (
                  <div 
                    key={module.id}
                    className="flex items-center gap-4 py-2 border-b border-border last:border-0"
                  >
                    <div className="w-40 font-medium text-sm text-foreground">
                      {module.name}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {PERMISSION_TYPES.map((type) => (
                        <label 
                          key={`${module.id}-${type.id}`}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <div 
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              selectedPermissions.includes(`${module.id}:${type.id}`)
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/40'
                            }`}
                            onClick={() => togglePermission(`${module.id}:${type.id}`)}
                            data-testid={`radio-permission-${module.id}-${type.id}`}
                          >
                            {selectedPermissions.includes(`${module.id}:${type.id}`) && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {type.icon && <type.icon className="h-3 w-3" />}
                            {type.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setCreateRoleModalOpen(false)}
              data-testid="button-cancel-create-role"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateRole}
              disabled={createRole.isPending}
              data-testid="button-confirm-create-role"
            >
              {createRole.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar Papel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
