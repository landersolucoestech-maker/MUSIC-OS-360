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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes } from "@/hooks/useClientes";
import { toast } from "sonner";

// Types
type TipoPessoa = "pessoa_fisica" | "pessoa_juridica";
type StatusCRM = "lead" | "cliente_ativo" | "inativo";

interface ClienteCRM {
  id: string;
  tipo_pessoa: TipoPessoa;
  nome: string;
  cpf_cnpj?: string | null;
  responsavel?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  status: StatusCRM;
}
import { Plus, Trash2, CalendarIcon, AlertCircle } from "lucide-react";
import { FileUpload, UploadedFile } from "@/components/shared/FileUpload";

// FieldError component padronizado
const FieldError = ({ error }: { error?: string }) => {
  if (!error) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3" />
      {error}
    </p>
  );
};
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { maskCPF, maskCNPJ, maskPhone, maskCEP, fetchAddressByCEP } from "@/lib/masks";

// Tipos principais
type TipoContatoPrincipal = "pessoa_fisica" | "pessoa_juridica";
type StatusContato = "frio" | "morno" | "quente" | "negociacao" | "fechado" | "perdido";
type PrioridadeContato = "baixa" | "media" | "alta";
type TipoInteracao = "nota" | "ligacao" | "email" | "reuniao" | "whatsapp";

interface Interacao {
  id: string;
  data: Date;
  tipo: TipoInteracao;
  descricao: string;
}

const TIPOS_INTERACAO = [
  { value: "nota", label: "Nota" },
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Reunião" },
  { value: "whatsapp", label: "WhatsApp" },
];




interface CRMFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: ClienteCRM;
  mode: "create" | "edit";
}

export function CRMFormModal({ open, onOpenChange, cliente, mode }: CRMFormModalProps) {
  const { clientes, addCliente, updateCliente } = useClientes();

  // Tipo principal de contato
  const [tipoContato, setTipoContato] = useState<TipoContatoPrincipal>("pessoa_fisica");
  
  // Campos comuns PF/PJ
  const [statusContato, setStatusContato] = useState<StatusContato>("frio");
  const [prioridadeContato, setPrioridadeContato] = useState<PrioridadeContato>("media");
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);

  // Campos Pessoa Física
  const [fotoPF, setFotoPF] = useState<UploadedFile[]>([]);
  const [nomeCompletoPF, setNomeCompletoPF] = useState("");
  const [cpfPF, setCpfPF] = useState("");
  const [emailPF, setEmailPF] = useState("");
  const [telefonePF, setTelefonePF] = useState("");
  const [categoriaPF, setCategoriaPF] = useState("");
  const [funcaoPF, setFuncaoPF] = useState("");
  
  // Campos Pessoa Jurídica
  const [categoriaPJ, setCategoriaPJ] = useState("");
  const [razaoSocialPJ, setRazaoSocialPJ] = useState("");
  const [cnpjPJ, setCnpjPJ] = useState("");
  const [emailPJ, setEmailPJ] = useState("");
  const [telefonePJ, setTelefonePJ] = useState("");
  const [nomeResponsavelPJ, setNomeResponsavelPJ] = useState("");
  const [emailResponsavelPJ, setEmailResponsavelPJ] = useState("");
  const [telefoneResponsavelPJ, setTelefoneResponsavelPJ] = useState("");
  const [cargoPJ, setCargoPJ] = useState("");

  // Endereço comum
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open && mode === "edit" && cliente) {
      setTipoContato(cliente.tipo_pessoa as TipoContatoPrincipal);
      setObservacoes(cliente.observacoes || "");
      setLogradouro(cliente.endereco || "");
      setCidade(cliente.cidade || "");
      setEstado(cliente.estado || "");
      if (cliente.tipo_pessoa === "pessoa_fisica") {
        setNomeCompletoPF(cliente.nome);
        setCpfPF(cliente.cpf_cnpj || "");
        setEmailPF(cliente.email || "");
        setTelefonePF(cliente.telefone || "");
      } else {
        setRazaoSocialPJ(cliente.nome);
        setCnpjPJ(cliente.cpf_cnpj || "");
        setEmailPJ(cliente.email || "");
        setTelefonePJ(cliente.telefone || "");
        setNomeResponsavelPJ(cliente.responsavel || "");
      }
    } else if (open && mode === "create") {
      resetForm();
    }
  }, [open, mode, cliente]);

  const resetForm = () => {
    setTipoContato("pessoa_fisica");
    setStatusContato("frio");
    setPrioridadeContato("media");
    setInteracoes([]);
    // PF
    setFotoPF([]);
    setNomeCompletoPF("");
    setCpfPF("");
    setEmailPF("");
    setTelefonePF("");
    setCategoriaPF("");
    setFuncaoPF("");
    // PJ
    setCategoriaPJ("");
    setRazaoSocialPJ("");
    setCnpjPJ("");
    setEmailPJ("");
    setTelefonePJ("");
    setNomeResponsavelPJ("");
    setEmailResponsavelPJ("");
    setTelefoneResponsavelPJ("");
    setCargoPJ("");
    // Endereço
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setObservacoes("");
  };

  const handleCEPChange = async (value: string) => {
    const masked = maskCEP(value);
    setCep(masked);
    if (masked.replace(/\D/g, "").length === 8) {
      const address = await fetchAddressByCEP(masked);
      if (address) {
        setLogradouro(address.logradouro);
        setBairro(address.bairro);
        setCidade(address.localidade);
        setEstado(address.uf);
      }
    }
  };


  const addInteracao = () => {
    setInteracoes([
      ...interacoes,
      {
        id: crypto.randomUUID(),
        data: new Date(),
        tipo: "nota",
        descricao: "",
      },
    ]);
  };

  const removeInteracao = (id: string) => {
    setInteracoes(interacoes.filter((i) => i.id !== id));
  };

  const updateInteracao = (id: string, field: keyof Interacao, value: any) => {
    setInteracoes(
      interacoes.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleSubmit = () => {
    if (tipoContato === "pessoa_fisica") {
      if (!nomeCompletoPF.trim()) {
        toast.error("Nome completo é obrigatório");
        return;
      }
      if (!emailPF.trim()) {
        toast.error("Email é obrigatório");
        return;
      }
    } else if (tipoContato === "pessoa_juridica") {
      if (!razaoSocialPJ.trim()) {
        toast.error("Razão social é obrigatória");
        return;
      }
      if (!emailPJ.trim()) {
        toast.error("Email é obrigatório");
        return;
      }
    }

    const clienteData = {
      tipo_pessoa: tipoContato === "pessoa_juridica" ? "pessoa_juridica" : "pessoa_fisica",
      nome: tipoContato === "pessoa_fisica" ? nomeCompletoPF : razaoSocialPJ,
      cpf_cnpj: tipoContato === "pessoa_fisica" ? cpfPF : cnpjPJ,
      responsavel: tipoContato === "pessoa_juridica" ? nomeResponsavelPJ : undefined,
      email: tipoContato === "pessoa_fisica" ? emailPF : emailPJ,
      telefone: tipoContato === "pessoa_fisica" ? telefonePF : telefonePJ,
      endereco: numero || bairro
        ? `${logradouro}, ${numero}${complemento ? ` - ${complemento}` : ""}, ${bairro}`
        : logradouro,
      cidade,
      estado,
      observacoes,
      status: "lead" as const,
    };

    if (mode === "create") {
      addCliente.mutate(clienteData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    } else if (cliente) {
      updateCliente.mutate({ id: cliente.id, ...clienteData }, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  // ========== RENDER FORMULÁRIO PESSOA FÍSICA ==========
  const renderPessoaFisicaForm = () => (
    <>
      {/* Foto */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">1.</span>
          <h3 className="text-lg font-semibold">Dados Pessoais</h3>
        </div>
        <Separator />

        <div className="space-y-2">
          <Label>Foto</Label>
          <FileUpload
            folder="contatos/fotos"
            accept="image/*"
            maxSize={5}
            value={fotoPF}
            onChange={setFotoPF}
          />
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Input 
            placeholder="Digite a categoria"
            value={categoriaPF}
            onChange={(e) => setCategoriaPF(e.target.value)}
          />
        </div>

        {/* Nome e CPF */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input 
              placeholder="Nome completo"
              value={nomeCompletoPF}
              onChange={(e) => setNomeCompletoPF(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input 
              placeholder="000.000.000-00"
              value={cpfPF}
              onChange={(e) => setCpfPF(maskCPF(e.target.value))}
            />
          </div>
        </div>

        {/* Email e Telefone */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input 
              type="email"
              placeholder="email@exemplo.com"
              value={emailPF}
              onChange={(e) => setEmailPF(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone / WhatsApp *</Label>
            <Input 
              placeholder="(00) 00000-0000"
              value={telefonePF}
              onChange={(e) => setTelefonePF(maskPhone(e.target.value))}
            />
          </div>
        </div>

        {/* Endereço Completo */}
        <div className="space-y-2">
          <Label>Endereço Completo</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">CEP</Label>
              <Input 
                placeholder="00000-000"
                value={cep}
                onChange={(e) => handleCEPChange(e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-muted-foreground">Logradouro</Label>
              <Input 
                placeholder="Rua, Avenida, etc."
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Número</Label>
              <Input 
                placeholder="Nº"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Complemento</Label>
              <Input 
                placeholder="Apto, Sala"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bairro</Label>
              <Input 
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cidade/UF</Label>
              <Input 
                placeholder="Cidade - UF"
                value={cidade ? `${cidade} - ${estado}` : ""}
                onChange={(e) => {
                  const parts = e.target.value.split(" - ");
                  setCidade(parts[0] || "");
                  setEstado(parts[1] || "");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status e Prioridade */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">2.</span>
          <h3 className="text-lg font-semibold">Status e Classificação</h3>
        </div>
        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={statusContato} onValueChange={(v) => setStatusContato(v as StatusContato)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="frio">Frio</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="negociacao">Negociação</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select value={prioridadeContato} onValueChange={(v) => setPrioridadeContato(v as PrioridadeContato)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Função */}
        <div className="space-y-2">
          <Label>Função</Label>
          <Input 
            placeholder="Digite a função"
            value={funcaoPF}
            onChange={(e) => setFuncaoPF(e.target.value)}
          />
        </div>
      </div>

      {/* Histórico de Interações */}
      {renderHistoricoInteracoes()}
    </>
  );

  // ========== RENDER FORMULÁRIO PESSOA JURÍDICA ==========
  const renderPessoaJuridicaForm = () => (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">1.</span>
          <h3 className="text-lg font-semibold">Dados da Empresa</h3>
        </div>
        <Separator />

        {/* Categoria da Empresa */}
        <div className="space-y-2">
          <Label>Categoria da Empresa *</Label>
          <Input 
            placeholder="Digite a categoria da empresa"
            value={categoriaPJ}
            onChange={(e) => setCategoriaPJ(e.target.value)}
          />
        </div>

        {/* Razão Social e CNPJ */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Razão Social / Nome Fantasia *</Label>
            <Input 
              placeholder="Nome da empresa"
              value={razaoSocialPJ}
              onChange={(e) => setRazaoSocialPJ(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ *</Label>
            <Input 
              placeholder="00.000.000/0001-00"
              value={cnpjPJ}
              onChange={(e) => setCnpjPJ(maskCNPJ(e.target.value))}
            />
          </div>
        </div>

        {/* Email e Telefone */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input 
              type="email"
              placeholder="contato@empresa.com"
              value={emailPJ}
              onChange={(e) => setEmailPJ(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone / WhatsApp *</Label>
            <Input 
              placeholder="(00) 00000-0000"
              value={telefonePJ}
              onChange={(e) => setTelefonePJ(maskPhone(e.target.value))}
            />
          </div>
        </div>

        {/* Endereço Completo */}
        <div className="space-y-2">
          <Label>Endereço Completo</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">CEP</Label>
              <Input 
                placeholder="00000-000"
                value={cep}
                onChange={(e) => handleCEPChange(e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-muted-foreground">Logradouro</Label>
              <Input 
                placeholder="Rua, Avenida, etc."
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Número</Label>
              <Input 
                placeholder="Nº"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Complemento</Label>
              <Input 
                placeholder="Sala, Andar"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bairro</Label>
              <Input 
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cidade/UF</Label>
              <Input 
                placeholder="Cidade - UF"
                value={cidade ? `${cidade} - ${estado}` : ""}
                onChange={(e) => {
                  const parts = e.target.value.split(" - ");
                  setCidade(parts[0] || "");
                  setEstado(parts[1] || "");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status e Prioridade */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">2.</span>
          <h3 className="text-lg font-semibold">Status e Classificação</h3>
        </div>
        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={statusContato} onValueChange={(v) => setStatusContato(v as StatusContato)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="frio">Frio</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="negociacao">Negociação</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select value={prioridadeContato} onValueChange={(v) => setPrioridadeContato(v as PrioridadeContato)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Responsável pela Empresa */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">3.</span>
          <h3 className="text-lg font-semibold">Responsável pela Empresa</h3>
        </div>
        <Separator />

        <div className="space-y-2">
          <Label>Nome do Responsável *</Label>
          <Input 
            placeholder="Nome completo do responsável"
            value={nomeResponsavelPJ}
            onChange={(e) => setNomeResponsavelPJ(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              type="email"
              placeholder="email@exemplo.com"
              value={emailResponsavelPJ}
              onChange={(e) => setEmailResponsavelPJ(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone / WhatsApp</Label>
            <Input 
              placeholder="(00) 00000-0000"
              value={telefoneResponsavelPJ}
              onChange={(e) => setTelefoneResponsavelPJ(maskPhone(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cargo</Label>
          <Input 
            placeholder="Digite o cargo"
            value={cargoPJ}
            onChange={(e) => setCargoPJ(e.target.value)}
          />
        </div>
      </div>

      {/* Histórico de Interações */}
      {renderHistoricoInteracoes()}
    </>
  );

  // ========== RENDER HISTÓRICO DE INTERAÇÕES ==========
  const renderHistoricoInteracoes = () => (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">{tipoContato === "pessoa_juridica" ? "4." : "3."}</span>
          <h3 className="text-lg font-semibold">Histórico de Interações</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addInteracao}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Interação
        </Button>
      </div>
      <Separator />

      {interacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma interação registrada. Clique em "Adicionar Interação" para começar.
        </p>
      ) : (
        <div className="space-y-4">
          {interacoes.map((interacao) => (
            <div key={interacao.id} className="p-4 border rounded-lg space-y-4 bg-muted/20 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeInteracao(interacao.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <div className="grid grid-cols-2 gap-4 pr-10">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !interacao.data && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {interacao.data ? format(interacao.data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border border-border z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={interacao.data}
                        onSelect={(date) => date && updateInteracao(interacao.id, "data", date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={interacao.tipo}
                    onValueChange={(v) => updateInteracao(interacao.id, "tipo", v as TipoInteracao)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {TIPOS_INTERACAO.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva a interação..."
                  value={interacao.descricao}
                  onChange={(e) => updateInteracao(interacao.id, "descricao", e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getDialogTitle = () => {
    if (mode === "edit") return "Editar Contato";
    if (tipoContato === "pessoa_fisica") return "Cadastro de Pessoa Física";
    return "Cadastro de Pessoa Jurídica";
  };

  const getDialogDescription = () => {
    if (mode === "edit") return "Edite os dados do contato";
    if (tipoContato === "pessoa_fisica") return "Preencha os dados da pessoa física";
    return "Preencha os dados da empresa";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 max-h-[calc(95vh-180px)]">
          <div className="space-y-4 pb-4">
            {/* Tipo de Contato Dropdown */}
            <div className="space-y-2">
              <Label>Tipo de Contato *</Label>
              <Select value={tipoContato} onValueChange={(v) => setTipoContato(v as TipoContatoPrincipal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                  <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoContato === "pessoa_fisica" && renderPessoaFisicaForm()}
            {tipoContato === "pessoa_juridica" && renderPessoaJuridicaForm()}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {mode === "create" ? "Cadastrar" : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
