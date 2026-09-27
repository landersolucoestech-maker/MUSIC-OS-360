import { useState, useEffect } from "react";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Loader2, User, Briefcase, Link2 } from "lucide-react";
import {
  useEmployees,
  DEPARTMENTS,
  CONTRACT_TYPES,
  EMPLOYEE_STATUS,
} from "@/modules/hr/hooks/useEmployees";
import type { Employee } from "@/modules/hr/hooks/useEmployees";
import { useUsers } from "@/modules/settings/hooks/useUsuarios";
import { maskCPF, maskPhone } from "@/shared/lib/masks";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { toast } from "sonner";
import { employeeSchema } from "@/modules/hr/schemas/employee-schema";

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  mode: "create" | "edit" | "view";
}

export function EmployeeFormModal({
  open,
  onOpenChange,
  employee,
  mode,
}: EmployeeFormModalProps) {
  const { addEmployee, updateEmployee } = useEmployees();
  const { users, isLoading: loadingUsers } = useUsers();
  const isViewMode = mode === "view";

  const [activeTab, setActiveTab] = useState("pessoal");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [contractType, setContractType] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [baseSalary, setBaseSalary] = useState<number | "">("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [linkUserId, setLinkUserId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if ((mode === "edit" || mode === "view") && employee) {
        setFullName((employee.name as string) || "");
        setCpf((employee.cpf as string) || "");
        setRg((employee.rg as string) || "");
        setBirthDate((employee.data_nascimento as string) || "");
        setEmail((employee.email as string) || "");
        setPhone((employee.telefone as string) || "");
        setAddress((employee.endereco as string) || "");
        setPosition((employee.cargo as string) || "");
        setDepartment((employee.departamento as string) || "");
        setContractType((employee.tipo_contrato as string) || "");
        setHireDate((employee.data_admissao as string) || "");
        setBaseSalary(employee.salario != null ? Number(employee.salario) : "");
        setStatus((employee.status as string) || "active");
        setNotes((employee.observacoes as string) || "");
        setLinkUserId((employee.vinculo_usuario_id as string) || "");
      } else {
        setFullName("");
        setCpf("");
        setRg("");
        setBirthDate("");
        setEmail("");
        setPhone("");
        setAddress("");
        setPosition("");
        setDepartment("");
        setContractType("");
        setHireDate("");
        setBaseSalary("");
        setStatus("active");
        setNotes("");
        setLinkUserId("");
      }
      setErrors({});
      setActiveTab("pessoal");
    }
  }, [open, mode, employee]);

  const validate = (): boolean => {
    const result = employeeSchema.safeParse({
      fullName,
      email: email || "",
      cpf: cpf || "",
      rg: rg || "",
      birthDate: birthDate || "",
      phone: phone || "",
      address: address || "",
      position: position || "",
      department: department || "",
      contractType: contractType || "",
      hireDate: hireDate || "",
      baseSalary: baseSalary !== "" ? Number(baseSalary) : null,
      status: status as "active" | "inactive" | "on_vacation" | "on_leave",
      notes: notes || "",
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field && !newErrors[String(field)]) {
          newErrors[String(field)] = err.message;
        }
      });
      setErrors(newErrors);
      if (newErrors.fullName || newErrors.email || newErrors.cpf || newErrors.rg || newErrors.birthDate || newErrors.phone || newErrors.address) {
        setActiveTab("pessoal");
      }
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (isViewMode) return;
    if (!validate()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    setSaving(true);

    const data: Record<string, unknown> = {
      name: fullName.trim(),
      cpf: cpf.trim() || null,
      email: email.trim() || null,
      telefone: phone.trim() || null,
      cargo: position.trim() || null,
      departamento: department || null,
      tipo_contrato: contractType || null,
      data_admissao: hireDate || null,
      salario: baseSalary !== "" ? String(baseSalary) : null,
      status,
    };

    try {
      if (mode === "create") {
        await addEmployee.mutateAsync(data as any);
      } else if (mode === "edit" && employee) {
        await updateEmployee.mutateAsync({
          id: employee.id,
          ...data,
          expectedUpdatedAt: getExpectedUpdatedAt(employee),
        } as any);
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "funcionário")) return;
      toast.error("Erro ao salvar funcionário");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "create"
      ? "Novo Funcionário"
      : mode === "edit"
        ? "Editar Funcionário"
        : "Detalhes do Funcionário";

  const description =
    mode === "create"
      ? "Cadastre um novo funcionário"
      : mode === "edit"
        ? "Edite os dados do funcionário"
        : "Visualize os dados do funcionário";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="funcionario-form-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="funcionario-form-title">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger
              value="pessoal"
              className="flex items-center gap-2"
              data-testid="tab-dados-pessoais"
            >
              <User className="h-4 w-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger
              value="profissional"
              className="flex items-center gap-2"
              data-testid="tab-profissional"
            >
              <Briefcase className="h-4 w-4" />
              Profissional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pessoal" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome_completo">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome_completo"
                placeholder="Nome completo do funcionário"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) {
                    setErrors((prev) => {
                      const n = { ...prev };
                      delete n.fullName;
                      return n;
                    });
                  }
                }}
                disabled={isViewMode}
                className={errors.fullName ? "border-destructive" : ""}
                data-testid="input-nome-completo"
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  disabled={isViewMode}
                  data-testid="input-cpf"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg">RG</Label>
                <Input
                  id="rg"
                  placeholder="RG do funcionário"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-rg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <DatePickerField
                  value={birthDate}
                  onChange={setBirthDate}
                  disabled={isViewMode}
                  placeholder="Selecione a data"
                  data-testid="datepicker-data-nascimento"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n.email;
                        return n;
                      });
                    }
                  }}
                  disabled={isViewMode}
                  className={errors.email ? "border-destructive" : ""}
                  data-testid="input-email"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  disabled={isViewMode}
                  data-testid="input-telefone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  placeholder="Endereço completo"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-endereco"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profissional" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  placeholder="Ex: Analista, Coordenador"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-cargo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setor">Setor</Label>
                <Select
                  value={department}
                  onValueChange={setDepartment}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-setor">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                <Select
                  value={contractType}
                  onValueChange={setContractType}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-type-contrato">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_admissao">Data de Admissão</Label>
                <DatePickerField
                  value={hireDate}
                  onChange={setHireDate}
                  disabled={isViewMode}
                  placeholder="Selecione a data"
                  data-testid="datepicker-data-admissao"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="salario_base">Salário Base (R$)</Label>
                <Input
                  id="salario_base"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={baseSalary}
                  onChange={(e) =>
                    setBaseSalary(e.target.value ? Number(e.target.value) : "")
                  }
                  disabled={isViewMode}
                  data-testid="input-salario-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações sobre o funcionário"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isViewMode}
                rows={3}
                data-testid="input-observacoes"
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="vinculo_usuario" className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular a Usuário do Sistema
                </Label>
                <Select
                  value={linkUserId || "none"}
                  onValueChange={(v) => setLinkUserId(v === "none" ? "" : v)}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-vinculo-usuario">
                    <SelectValue placeholder={loadingUsers ? "Carregando..." : "Nenhum (sem vínculo)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (sem vínculo)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Opcional — vincule este funcionário a um usuário que já tem acesso ao sistema
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {!isViewMode && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              data-testid="button-save-funcionario"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Cadastrar" : "Salvar"}
            </Button>
          </DialogFooter>
        )}

        {isViewMode && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close"
            >
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
