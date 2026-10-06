import { useState, useEffect } from "react";
import { CONTRACT_TYPE_OPTIONS } from "@/modules/hr/constants";
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
  EMPLOYEE_STATUS,
} from "@/modules/hr/hooks/useEmployees";
import type { Employee } from "@/modules/hr/hooks/useEmployees";
import { useUsers } from "@/modules/settings/hooks/useUsers";
import { maskCpf, maskPhone } from "@/shared/lib/masks";
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

  const [activeTab, setActiveTab] = useState("personal");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
        setEmail((employee.email as string) || "");
        setPhone((employee.phone as string) || "");
        setPosition((employee.job_title as string) || "");
        setDepartment((employee.department as string) || "");
        setContractType((employee.contract_type as string) || "");
        setHireDate((employee.hired_at as string) || "");
        setBaseSalary(employee.salary != null ? Number(employee.salary) : "");
        setStatus((employee.status as string) || "active");
        setNotes((employee.notes as string) || "");
        setLinkUserId((employee.linked_user_id as string) || "");
      } else {
        setFullName("");
        setCpf("");
        setEmail("");
        setPhone("");
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
      setActiveTab("personal");
    }
  }, [open, mode, employee]);

  const validate = (): boolean => {
    const result = employeeSchema.safeParse({
      fullName,
      email: email || "",
      cpf: cpf || "",
      phone: phone || "",
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
      if (newErrors.fullName || newErrors.email || newErrors.cpf || newErrors.phone) {
        setActiveTab("personal");
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
      phone: phone.trim() || null,
      job_title: position.trim() || null,
      department: department || null,
      contract_type: contractType || null,
      hired_at: hireDate || null,
      salary: baseSalary !== "" ? String(baseSalary) : null,
      notes: notes.trim() || null,
      linked_user_id: linkUserId || null,
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
        data-testid="employee-form-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="employee-form-title">
            <User className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger
              value="personal"
              className="flex items-center gap-2"
              data-testid="tab-personal-data"
            >
              <User className="h-4 w-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger
              value="professional"
              className="flex items-center gap-2"
              data-testid="tab-professional"
            >
              <Briefcase className="h-4 w-4" />
              Profissional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
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
                data-testid="input-full-name"
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
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  disabled={isViewMode}
                  data-testid="input-cpf"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  disabled={isViewMode}
                  data-testid="input-phone"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="job_title">Cargo</Label>
                <Input
                  id="job_title"
                  placeholder="Ex: Analista, Coordenador"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-job-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Setor</Label>
                <Select
                  value={department}
                  onValueChange={setDepartment}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-department">
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
                <Label htmlFor="contract_type">Tipo de Contrato</Label>
                <Select
                  value={contractType}
                  onValueChange={setContractType}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hired_at">Data de Admissão</Label>
                <DatePickerField
                  value={hireDate}
                  onChange={setHireDate}
                  disabled={isViewMode}
                  placeholder="Selecione a data"
                  data-testid="datepicker-admission-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="base_salary">Salário Base (R$)</Label>
                <Input
                  id="base_salary"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={baseSalary}
                  onChange={(e) =>
                    setBaseSalary(e.target.value ? Number(e.target.value) : "")
                  }
                  disabled={isViewMode}
                  data-testid="input-base-salary"
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
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações sobre o funcionário"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isViewMode}
                rows={3}
                data-testid="input-notes"
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="linked_user" className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular a Usuário do Sistema
                </Label>
                <Select
                  value={linkUserId || "none"}
                  onValueChange={(v) => setLinkUserId(v === "none" ? "" : v)}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-linked-user">
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
              data-testid="button-save-employee"
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
