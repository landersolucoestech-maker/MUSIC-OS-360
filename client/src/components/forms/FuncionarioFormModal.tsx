import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Briefcase, Link2 } from "lucide-react";
import {
  useFuncionarios,
  SETORES,
  TIPOS_CONTRATO,
  STATUS_FUNCIONARIO,
} from "@/hooks/useFuncionarios";
import type { Funcionario } from "@/hooks/useFuncionarios";
import { useUsuarios } from "@/hooks/useUsuarios";
import { maskCPF, maskPhone } from "@/lib/masks";
import { toast } from "sonner";

interface FuncionarioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario?: Funcionario | null;
  mode: "create" | "edit" | "view";
}

export function FuncionarioFormModal({
  open,
  onOpenChange,
  funcionario,
  mode,
}: FuncionarioFormModalProps) {
  const { addFuncionario, updateFuncionario } = useFuncionarios();
  const { usuarios, isLoading: loadingUsuarios } = useUsuarios();
  const isViewMode = mode === "view";

  const [activeTab, setActiveTab] = useState("pessoal");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");

  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [tipoContrato, setTipoContrato] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [salarioBase, setSalarioBase] = useState<number | "">("");
  const [status, setStatus] = useState("ativo");
  const [observacoes, setObservacoes] = useState("");
  const [vinculoUsuarioId, setVinculoUsuarioId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if ((mode === "edit" || mode === "view") && funcionario) {
        setNomeCompleto(funcionario.nome_completo || "");
        setCpf(funcionario.cpf || "");
        setRg(funcionario.rg || "");
        setDataNascimento(funcionario.data_nascimento || "");
        setEmail(funcionario.email || "");
        setTelefone(funcionario.telefone || "");
        setEndereco(funcionario.endereco || "");
        setCargo(funcionario.cargo || "");
        setSetor(funcionario.setor || "");
        setTipoContrato(funcionario.tipo_contrato || "");
        setDataAdmissao(funcionario.data_admissao || "");
        setSalarioBase(funcionario.salario_base ?? "");
        setStatus(funcionario.status || "ativo");
        setObservacoes(funcionario.observacoes || "");
        setVinculoUsuarioId(funcionario.vinculo_usuario_id || "");
      } else {
        setNomeCompleto("");
        setCpf("");
        setRg("");
        setDataNascimento("");
        setEmail("");
        setTelefone("");
        setEndereco("");
        setCargo("");
        setSetor("");
        setTipoContrato("");
        setDataAdmissao("");
        setSalarioBase("");
        setStatus("ativo");
        setObservacoes("");
        setVinculoUsuarioId("");
      }
      setErrors({});
      setActiveTab("pessoal");
    }
  }, [open, mode, funcionario]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!nomeCompleto.trim()) {
      newErrors.nome_completo = "Nome completo é obrigatório";
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.nome_completo) {
        setActiveTab("pessoal");
      }
      return false;
    }
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
      nome_completo: nomeCompleto.trim(),
      cpf: cpf.trim() || null,
      rg: rg.trim() || null,
      data_nascimento: dataNascimento || null,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      cargo: cargo.trim() || null,
      setor: setor || null,
      tipo_contrato: tipoContrato || null,
      data_admissao: dataAdmissao || null,
      salario_base: salarioBase !== "" ? Number(salarioBase) : null,
      status,
      observacoes: observacoes.trim() || null,
      vinculo_usuario_id: vinculoUsuarioId || null,
    };

    try {
      if (mode === "create") {
        await addFuncionario.mutateAsync(data as any);
      } else if (mode === "edit" && funcionario) {
        await updateFuncionario.mutateAsync({ id: funcionario.id, ...data } as any);
      }
      onOpenChange(false);
    } catch {
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
                value={nomeCompleto}
                onChange={(e) => {
                  setNomeCompleto(e.target.value);
                  if (errors.nome_completo) {
                    setErrors((prev) => {
                      const n = { ...prev };
                      delete n.nome_completo;
                      return n;
                    });
                  }
                }}
                disabled={isViewMode}
                className={errors.nome_completo ? "border-destructive" : ""}
                data-testid="input-nome-completo"
              />
              {errors.nome_completo && (
                <p className="text-xs text-destructive">{errors.nome_completo}</p>
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
                <Input
                  id="data_nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-data-nascimento"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
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
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  disabled={isViewMode}
                  data-testid="input-telefone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  placeholder="Endereço completo"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
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
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-cargo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setor">Setor</Label>
                <Select
                  value={setor}
                  onValueChange={setSetor}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-setor">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                <Select
                  value={tipoContrato}
                  onValueChange={setTipoContrato}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-tipo-contrato">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_admissao">Data de Admissão</Label>
                <Input
                  id="data_admissao"
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  disabled={isViewMode}
                  data-testid="input-data-admissao"
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
                  value={salarioBase}
                  onChange={(e) =>
                    setSalarioBase(e.target.value ? Number(e.target.value) : "")
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
                    {STATUS_FUNCIONARIO.map((s) => (
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
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
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
                  value={vinculoUsuarioId || "none"}
                  onValueChange={(v) => setVinculoUsuarioId(v === "none" ? "" : v)}
                  disabled={isViewMode}
                >
                  <SelectTrigger data-testid="select-vinculo-usuario">
                    <SelectValue placeholder={loadingUsuarios ? "Carregando..." : "Nenhum (sem vínculo)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (sem vínculo)</SelectItem>
                    {usuarios.map((u) => (
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
