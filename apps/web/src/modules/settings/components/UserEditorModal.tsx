import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { toast } from "sonner";
import { useUsers, type UserAccount } from "@/modules/settings/hooks/useUsers";
import { useRoles } from "@/modules/settings/hooks/useRoles";

import { toUserMessage } from "@/shared/lib/errors";
interface UserEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserAccount;
  mode: "create" | "edit";
}

export function UserEditorModal({ open, onOpenChange, user: member, mode }: UserEditorModalProps) {
  const { updateUser } = useUsers();
  const { roles, inviteUser } = useRoles();
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.is_assignable !== false && !role.archived_at),
    [roles],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [roleSlug, setRoleSlug] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(member?.full_name ?? "");
    setEmail(member?.email ?? "");
    setPhone(member?.phone ?? "");
    setStatus(member?.status ?? "ativo");
    setRoleSlug(member?.role ?? "");
  }, [open, member]);

  const isSaving = updateUser.isPending || inviteUser.isPending;

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("E-mail é obrigatório");
      return;
    }
    if (!roleSlug) {
      toast.error("Selecione um papel");
      return;
    }

    try {
      if (mode === "create") {
        const role = assignableRoles.find((item) => item.slug === roleSlug);
        if (!role) {
          toast.error("Papel selecionado não está disponível para convite");
          return;
        }
        await inviteUser.mutateAsync({ email: normalizedEmail, roleId: role.id });
        toast.success("Convite enviado com sucesso");
      } else {
        if (!member) return;
        if (name.trim().length < 2) {
          toast.error("Nome deve ter pelo menos 2 caracteres");
          return;
        }
        await updateUser.mutateAsync({
          id: member.id,
          full_name: name.trim(),
          phone: phone.trim(),
          status,
          role: roleSlug,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(toUserMessage(error, "Não foi possível salvar o usuário"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Convidar usuário" : "Editar usuário"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "edit" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Nome completo</Label>
                <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-phone">Telefone</Label>
                <Input id="user-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as "ativo" | "inativo")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="user-email">E-mail</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
              disabled={mode === "edit"}
            />
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">
                A alteração de e-mail exige um fluxo de confirmação do provedor de autenticação e não é feita por este formulário.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={roleSlug} onValueChange={setRoleSlug}>
              <SelectTrigger><SelectValue placeholder="Selecione um papel" /></SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.slug}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "create" && (
            <p className="text-xs text-muted-foreground">
              O usuário receberá um convite para concluir o cadastro. Nome, telefone e demais dados serão preenchidos após o aceite.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={submit} disabled={isSaving}>
            {isSaving ? "Salvando..." : mode === "create" ? "Enviar convite" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
