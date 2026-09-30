import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { toast } from "sonner";
import { User, UserCheck, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema, type UserFormData } from "@/modules/settings/lib/user-schema";
import { FormField, FieldError } from "@/shared/components/FormField";
import { useUsers } from "@/modules/settings/hooks/useUsers";
interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  mode: "create" | "edit" | "view";
}

const ACCESS_LEVELS = [
  { value: "admin_master", label: "Administrador Master", description: "Acesso total a todos os módulos e configurações do sistema." },
  { value: "ar_gestao", label: "A&R / Gestão Artística", description: "Gestão de artistas, projetos, lançamentos e repertório." },
  { value: "financeiro_contabil", label: "Contabilidade", description: "Acesso ao módulo de Contabilidade: transações e notas fiscais." },
  { value: "juridico", label: "Jurídico", description: "Gestão de contratos, licenciamentos e questões legais." },
  { value: "marketing", label: "Marketing", description: "Campanhas, métricas e gestão de conteúdo promocional." },
  { value: "artista", label: "Artista", description: "Acesso restrito aos próprios dados e projetos vinculados." },
  { value: "colaborador", label: "Colaborador / Freelancer", description: "Acesso limitado a tarefas específicas designadas." },
  { value: "leitor", label: "Leitor (somente leitura)", description: "Visualização sem permissão de edição ou criação." },
];

export function UserFormModal({ open, onOpenChange, user: member, mode }: UserFormModalProps) {
  const { updateUser } = useUsers();

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Usuário" : mode === "edit" ? "Editar Usuário" : "Detalhes do Usuário";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "ativo",
      accessLevel: "",
    },
  });

  const accessLevel = watch("accessLevel");

  useEffect(() => {
    if (open) {
      if (member && (mode === "edit" || mode === "view")) {
        reset({
          name: member.name || "",
          email: member.email || "",
          phone: member.phone || "",
          status: member.status || "ativo",
          accessLevel: member.role || "",
        });
      } else {
        reset({
          name: "",
          email: "",
          phone: "",
          status: "ativo",
          accessLevel: "",
        });
      }
    }
  }, [member, mode, open, reset]);

  const onSubmit = async (data: UserFormData) => {
    if (isViewMode) return;

    try {
      if (mode === "edit" && member?.id) {
        await updateUser.mutateAsync({
          id: member.id,
          full_name: data.name,
          phone: data.phone ?? undefined,
          cargo: data.accessLevel || undefined,
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

  const selectedAccessLevel = ACCESS_LEVELS.find((level) => level.value === accessLevel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  {...register("name")}
                  disabled={isViewMode}
                  placeholder="Digite o nome completo"
                  error={errors.name?.message}
                />

                <FormField
                  label="E-mail"
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
                  {...register("phone")}
                  disabled={isViewMode}
                  placeholder="(00) 00000-0000"
                  error={errors.phone?.message}
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

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="accessLevel">Nível de Acesso (Perfil)</Label>
                  <Select
                    value={accessLevel || ""}
                    onValueChange={(v) => setValue("accessLevel", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.accessLevel?.message} />
                </div>
              </div>

              {selectedAccessLevel && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{selectedAccessLevel.description}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
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
