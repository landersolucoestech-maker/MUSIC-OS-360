import { useRef, useState, useEffect } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { Pencil, User, Mail, Phone, Shield, Smartphone, History, X, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserSettings } from "@/modules/settings/hooks/useUserSettings";
import { useAuth } from "@/app/providers/AuthContext";
import { cn } from "@/shared/lib/utils";
import { ROLE_LABELS, type AppRole } from "@/shared/hooks/useHasRole";

const DEPARTMENT_OPTIONS = [
  "Administrativo", "A&R", "Comercial", "Financeiro", "Jurídico",
  "Marketing", "Produção Musical", "Tecnologia", "Recursos Humanos", "Outro",
];
const POSITION_OPTIONS = [
  "Diretor(a)", "Gerente", "Coordenador(a)", "Analista",
  "Assistente", "Produtor(a)", "Estagiário(a)", "Outro",
];
const ACCESS_LEVEL_OPTIONS = ["Administrador", "Gestor", "Editor", "Usuário"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Profile() {
  const { user } = useAuth();
  const { userSettings, saveUserSettings, saving, loading } = useUserSettings();

  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedName = userSettings.full_name
    || (user?.user_metadata?.full_name as string | undefined)
    || user?.email?.split("@")[0]
    || "";

  const resolvedRole = (() => {
    const r = user?.role as string | undefined;
    if (!r || r === "viewer") return "Usuário";
    if (r === "admin" || r === "owner" || r === "super_admin") return "Administrador";
    if (r === "manager") return "Gestor";
    if (r === "editor") return "Editor";
    return ROLE_LABELS[r as AppRole] ?? r;
  })();

  const [formData, setFormData] = useState({
    name: resolvedName,
    email: user?.email || "",
    phone: userSettings.phone || "",
    department: userSettings.department || "",
    position: userSettings.position || "",
    accessLevel: resolvedRole,
  });

  // Syncs the form when userSettings loads from localStorage or the user changes
  useEffect(() => {
    if (loading) return;
    setFormData({
      name: userSettings.full_name
        || (user?.user_metadata?.full_name as string | undefined)
        || user?.email?.split("@")[0]
        || "",
      email: user?.email || "",
      phone: userSettings.phone || "",
      department: userSettings.department || "",
      position: userSettings.position || "",
      accessLevel: resolvedRole,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userSettings.full_name, userSettings.phone, userSettings.position, userSettings.department, user?.id]);

  const handleSave = async () => {
    await saveUserSettings({
      full_name: formData.name,
      phone: formData.phone,
      department: formData.department,
      position: formData.position,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: userSettings.full_name
        || (user?.user_metadata?.full_name as string | undefined)
        || user?.email?.split("@")[0]
        || "",
      email: user?.email || "",
      phone: userSettings.phone || "",
      department: userSettings.department || "",
      position: userSettings.position || "",
      accessLevel: resolvedRole,
    });
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`A imagem deve ter no máximo ${MAX_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      await saveUserSettings({ avatar_url: dataUrl });
      setUploadingAvatar(false);
      e.target.value = "";
    };
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo. Tente novamente.");
      setUploadingAvatar(false);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    await saveUserSettings({ avatar_url: "" });
    toast.success("Avatar removido.");
  };

  const displayName = userSettings.full_name || formData.name;
  const avatarUrl = userSettings.avatar_url;

  return (
    <MainLayout title="Meu Perfil" description="Gerencie suas informações pessoais">
      <div className="space-y-6">

        {/* Profile Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">

                {/* Avatar with upload */}
                <div className="relative mb-4 group">
                  <Avatar className="h-24 w-24">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={displayName} data-testid="img-avatar" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(displayName) || "MO"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Overlay de upload */}
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    data-testid="button-upload-avatar"
                    className="absolute inset-0 rounded-full flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Alterar foto de perfil"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-foreground animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-foreground" />
                    )}
                  </button>
                </div>

                {/* Input file oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  data-testid="input-avatar-file"
                  onChange={handleFileChange}
                />

                {/* Action buttons below the avatar */}
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    data-testid="button-change-photo"
                  >
                    <Camera className="h-3 w-3" />
                    {uploadingAvatar ? "Enviando..." : "Alterar foto"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      data-testid="button-remove-avatar"
                    >
                      <X className="h-3 w-3" />
                      Remover
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">JPG, PNG, WEBP ou GIF · Máx. 5 MB</p>

                <h2 className="text-xl font-semibold mt-4">{displayName}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{formData.email}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Função:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {formData.accessLevel}
                  </Badge>
                </div>
                {formData.position && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cargo:</span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {formData.position}
                    </Badge>
                  </div>
                )}
                {formData.department && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Setor:</span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {formData.department}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">{formData.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Info Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Seus dados cadastrados no sistema</CardDescription>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="shrink-0"
                  data-testid="button-edit-profile"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={formData.name}
                    readOnly={!isEditing}
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={formData.email}
                    readOnly
                    className="bg-muted"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    readOnly={!isEditing}
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select
                    value={formData.department || undefined}
                    onValueChange={(v) => setFormData({ ...formData, department: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger
                      className={cn("h-9", !isEditing && "bg-muted")}
                      data-testid="select-department"
                    >
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select
                    value={formData.position || undefined}
                    onValueChange={(v) => setFormData({ ...formData, position: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger
                      className={cn("h-9", !isEditing && "bg-muted")}
                      data-testid="select-position"
                    >
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <Select value={formData.accessLevel || undefined} disabled>
                  <SelectTrigger className="h-9 bg-muted" data-testid="select-access-level">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVEL_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleSave}
                    disabled={saving}
                    data-testid="button-save-profile"
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Gerencie suas configurações de segurança</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div
                className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid="card-change-password"
              >
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span>Alterar Senha</span>
              </div>
              <div
                className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid="card-enable-2fa"
              >
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span>Ativar 2FA</span>
              </div>
              <div
                className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid="card-history-login"
              >
                <History className="h-5 w-5 text-muted-foreground" />
                <span>Histórico de Login</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
