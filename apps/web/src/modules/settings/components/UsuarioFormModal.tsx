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
import { usuarioSchema, type UsuarioFormData } from "@/modules/settings/lib/usuario-schema";
import { FormField, FieldError } from "@/shared/components/FormField";
import { useUsuarios } from "@/modules/settings/hooks/useUsuarios";
interface UsuarioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario?: any;
  mode: "create" | "edit" | "view";
}

const NIVEIS_ACESSO = [
  { value: "admin_master", label: "Administrador Master", description: "Acesso total a todos os módulos e configurações do sistema." },
  { value: "ar_gestao", label: "A&R / Gestão Artística", description: "Gestão de artistas, projetos, lançamentos e repertório." },
  { value: "financeiro_contabil", label: "Accounting / Contábil", description: "Acesso ao módulo Accounting: transações e notas fiscais." },
  { value: "juridico", label: "Jurídico", description: "Gestão de contratos, licenciamentos e questões legais." },
  { value: "marketing", label: "Marketing", description: "Campanhas, métricas e gestão de conteúdo promocional." },
  { value: "artista", label: "Artista", description: "Acesso restrito aos próprios dados e projetos vinculados." },
  { value: "colaborador", label: "Colaborador / Freelancer", description: "Acesso limitado a tarefas específicas designadas." },
  { value: "leitor", label: "Leitor (somente leitura)", description: "Visualização sem permissão de edição ou criação." },
];

export function UsuarioFormModal({ open, onOpenChange, usuario, mode }: UsuarioFormModalProps) {
  const { updateUsuario } = useUsuarios();

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
      nivel_acesso: "",
    },
  });

  const nivelAcesso = watch("nivel_acesso");

  useEffect(() => {
    if (open) {
      if (usuario && (mode === "edit" || mode === "view")) {
        reset({
          nome: usuario.name || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
          status: usuario.status || "ativo",
          nivel_acesso: usuario.role || "",
        });
      } else {
        reset({
          nome: "",
          email: "",
          telefone: "",
          status: "ativo",
          nivel_acesso: "",
        });
      }
    }
  }, [usuario, mode, open, reset]);

  const onSubmit = async (data: UsuarioFormData) => {
    if (isViewMode) return;

    try {
      if (mode === "edit" && usuario?.id) {
        await updateUsuario.mutateAsync({
          id: usuario.id,
          full_name: data.nome,
          phone: data.telefone ?? undefined,
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

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="nivelAcesso">Nível de Acesso (Perfil)</Label>
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
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{selectedNivel.description}</AlertDescription>
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
