import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Upload, User, Plus, Trash2, Loader2, AlertCircle, Building2, MapPin, 
  Calendar, MessageSquare, Phone, Mail, FileText, Tags, X, DollarSign, 
  Briefcase, Link2, Users, FolderOpen, Clock
} from "lucide-react";
import { maskCPFCNPJ, maskPhone, maskCEP, fetchAddressByCEP } from "@/lib/masks";
import { validateCPFCNPJ } from "@/lib/validators";
import {
  TIPOS_PESSOA,
  ORIGENS_CONTATO,
  STATUS_RELACIONAMENTO,
  TEMPERATURAS_LEAD,
  PRIORIDADES,
  TIPOS_INTERACAO,
  CATEGORIAS_CONTATO,
  SUBCATEGORIAS_POR_CATEGORIA,
  Contato,
  CategoriaContato,
} from "@/lib/contato-types";

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

interface ContatoPessoa {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  whatsapp: string;
  redesSociais: string;
  preferenciaContato: string;
}

interface Interacao {
  id: string;
  tipo: string;
  data: string;
  descricao: string;
  status: "pendente" | "concluida" | "atrasada";
}

interface ContatoFormModalProps { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  contato?: Partial<Contato>; 
  mode: "create" | "edit" | "view"; 
}

const estadosBrasileiros = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const PREFERENCIAS_CONTATO = [
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
];

export function ContatoFormModal({ open, onOpenChange, contato, mode }: ContatoFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [cpfCnpjError, setCpfCnpjError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ nome?: string; tipoCRM?: string }>({});
  
  // Contatos da empresa (lista dinâmica)
  const [contatosPessoas, setContatosPessoas] = useState<ContatoPessoa[]>([]);
  
  // Interações e follow-ups
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({ tipo: "", descricao: "" });

  const [formData, setFormData] = useState({
    // Seção: Identificação
    nome: "",
    tipoCRM: "" as CategoriaContato | "",
    subcategorias: [] as string[],
    tipoPessoa: "pessoa_fisica" as "pessoa_fisica" | "pessoa_juridica",
    cpfCnpj: "",
    statusRelacionamento: "prospect" as string,
    responsavelNome: "",
    tags: [] as string[],
    observacoes: "",
    foto: null as File | null,
    
    // Seção: Classificação & Funil
    temperatura: "" as string,
    scoreValue: "",
    origem: "" as string,
    valorPotencial: "",
    prioridade: "" as string,
    
    // Seção: Endereço
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    
    // Seção: Follow-ups
    proximaAcao: "",
    dataProximaAcao: "",
    
    // Seção: Projetos e Financeiro
    projetosVinculados: "",
    papelProjeto: "",
    contratosAssociados: "",
    valorReceita: "",
    valorCusto: "",
    formaPagamento: "",
    centroCusto: "",
    
    // Seção: Marketing e Mídia
    campanhasAssociadas: "",
    linksMidia: "",
    plataformasVinculadas: "",
    
    // Seção: Documentos
    arquivosUpload: "",
    linksExternos: "",
  });

  const [newTag, setNewTag] = useState("");

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Registro" : mode === "edit" ? "Editar Registro" : "Detalhes do Registro";

  // Get subcategorias based on selected tipoCRM
  const subcategoriasDisponiveis = formData.tipoCRM 
    ? SUBCATEGORIAS_POR_CATEGORIA[formData.tipoCRM] || []
    : [];

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        nome: contato?.nome || "",
        tipoCRM: contato?.categoria || "",
        subcategorias: contato?.subcategorias || [],
        tipoPessoa: contato?.tipoPessoa || "pessoa_fisica",
        cpfCnpj: contato?.cpfCnpj || "",
        statusRelacionamento: contato?.statusRelacionamento || "prospect",
        responsavelNome: contato?.responsavelNome || "",
        tags: contato?.tags || [],
        observacoes: contato?.notas || "",
        foto: null,
        temperatura: contato?.temperatura || "",
        scoreValue: "",
        origem: contato?.origem || "",
        valorPotencial: contato?.valorPotencial?.toString() || "",
        prioridade: contato?.prioridade || "",
        endereco: contato?.endereco || "",
        cidade: contato?.cidade || "",
        estado: contato?.estado || "",
        cep: contato?.cep || "",
        proximaAcao: contato?.proximaAcao || "",
        dataProximaAcao: contato?.dataProximaAcao || "",
        projetosVinculados: contato?.projetosVinculados?.join(", ") || "",
        papelProjeto: "",
        contratosAssociados: contato?.contratosVinculados?.join(", ") || "",
        valorReceita: "",
        valorCusto: "",
        formaPagamento: "",
        centroCusto: "",
        campanhasAssociadas: "",
        linksMidia: "",
        plataformasVinculadas: "",
        arquivosUpload: "",
        linksExternos: "",
      });
      setFotoPreview(contato?.fotoUrl || null);
      setContatosPessoas([]);
      setInteracoes([]);
      setCpfCnpjError("");
      setFormErrors({});
    }
  }, [open, contato]);

  const handleCEPChange = async (value: string) => {
    const maskedCEP = maskCEP(value);
    setFormData({ ...formData, cep: maskedCEP });

    const cleanCEP = value.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setLoadingCEP(true);
      const address = await fetchAddressByCEP(cleanCEP);
      setLoadingCEP(false);
      
      if (address) {
        setFormData(prev => ({
          ...prev,
          cep: maskedCEP,
          endereco: address.logradouro || prev.endereco,
          cidade: address.localidade || prev.cidade,
          estado: address.uf || prev.estado,
        }));
        toast.success("Endereço encontrado!");
      } else {
        toast.error("CEP não encontrado");
      }
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A foto deve ter no máximo 5MB");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Formato inválido. Use JPG, PNG ou WebP");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result as string);
      reader.readAsDataURL(file);
      setFormData({ ...formData, foto: file });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const toggleSubcategoria = (value: string) => {
    if (isViewMode) return;
    setFormData(prev => ({
      ...prev,
      subcategorias: prev.subcategorias.includes(value)
        ? prev.subcategorias.filter(s => s !== value)
        : [...prev.subcategorias, value]
    }));
  };

  // Contatos pessoas (lista dinâmica)
  const handleAddContatoPessoa = () => {
    const novo: ContatoPessoa = {
      id: Date.now().toString(),
      nome: "",
      cargo: "",
      email: "",
      telefone: "",
      whatsapp: "",
      redesSociais: "",
      preferenciaContato: "email",
    };
    setContatosPessoas([...contatosPessoas, novo]);
  };

  const handleUpdateContatoPessoa = (id: string, field: keyof ContatoPessoa, value: string) => {
    setContatosPessoas(contatosPessoas.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleRemoveContatoPessoa = (id: string) => {
    setContatosPessoas(contatosPessoas.filter(c => c.id !== id));
  };

  // Interações
  const handleAddInteracao = () => {
    if (!novaInteracao.tipo || !novaInteracao.descricao) {
      toast.error("Preencha tipo e descrição da interação");
      return;
    }
    const nova: Interacao = {
      id: Date.now().toString(),
      tipo: novaInteracao.tipo,
      data: new Date().toLocaleDateString("pt-BR"),
      descricao: novaInteracao.descricao,
      status: "concluida",
    };
    setInteracoes([nova, ...interacoes]);
    setNovaInteracao({ tipo: "", descricao: "" });
    setShowInteracaoForm(false);
    toast.success("Interação registrada!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.tipoCRM) {
      toast.error("Selecione o Tipo CRM");
      return;
    }

    if (formData.cpfCnpj) {
      const validation = validateCPFCNPJ(formData.cpfCnpj);
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    toast.success(mode === "create" ? "Registro criado com sucesso!" : "Registro atualizado com sucesso!");
    onOpenChange(false);
  };

  const getInteracaoIcon = (tipo: string) => {
    switch (tipo) {
      case "ligacao": return <Phone className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "whatsapp": return <MessageSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <form onSubmit={handleSubmit} className="space-y-8 pb-4">
            
            {/* ========== SEÇÃO: IDENTIFICAÇÃO ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Identificação</h3>
              </div>
              <Separator />
              
              {/* Foto */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFotoChange}
                    className="hidden"
                    disabled={isViewMode}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isViewMode}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {fotoPreview ? "Alterar" : "Foto"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input 
                    value={formData.nome} 
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                    placeholder="Nome completo ou razão social"
                    disabled={isViewMode} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo CRM *</Label>
                  <Select 
                    value={formData.tipoCRM} 
                    onValueChange={(v: CategoriaContato) => setFormData({ ...formData, tipoCRM: v, subcategorias: [] })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_CONTATO.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subcategorias */}
              {subcategoriasDisponiveis.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoria(s)</Label>
                  <div className="flex flex-wrap gap-2">
                    {subcategoriasDisponiveis.map(sub => (
                      <Badge
                        key={sub.value}
                        variant={formData.subcategorias.includes(sub.value) ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${
                          formData.subcategorias.includes(sub.value) 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted"
                        }`}
                        onClick={() => toggleSubcategoria(sub.value)}
                      >
                        {sub.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Pessoa</Label>
                  <Select 
                    value={formData.tipoPessoa} 
                    onValueChange={(v: "pessoa_fisica" | "pessoa_juridica") => setFormData({ ...formData, tipoPessoa: v })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_PESSOA.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{formData.tipoPessoa === "pessoa_juridica" ? "CNPJ" : "CPF"}</Label>
                  <div className="relative">
                    <Input 
                      value={formData.cpfCnpj} 
                      onChange={(e) => {
                        const masked = maskCPFCNPJ(e.target.value);
                        setFormData({ ...formData, cpfCnpj: masked });
                        if (masked.replace(/\D/g, '').length >= 11) {
                          const validation = validateCPFCNPJ(masked);
                          setCpfCnpjError(validation.valid ? "" : validation.message);
                        } else {
                          setCpfCnpjError("");
                        }
                      }} 
                      placeholder={formData.tipoPessoa === "pessoa_juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
                      disabled={isViewMode}
                      className={cpfCnpjError ? "border-destructive" : ""}
                    />
                    {cpfCnpjError && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
                    )}
                  </div>
                  {cpfCnpjError && <p className="text-xs text-destructive">{cpfCnpjError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={formData.statusRelacionamento} 
                    onValueChange={(v) => setFormData({ ...formData, statusRelacionamento: v })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_RELACIONAMENTO.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável Interno</Label>
                  <Input 
                    value={formData.responsavelNome} 
                    onChange={(e) => setFormData({ ...formData, responsavelNome: e.target.value })} 
                    placeholder="Nome do responsável"
                    disabled={isViewMode} 
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {!isViewMode && (
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(tag)} />
                      )}
                    </Badge>
                  ))}
                </div>
                {!isViewMode && (
                  <div className="flex gap-2">
                    <Input 
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Nova tag..."
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea 
                  value={formData.observacoes} 
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} 
                  placeholder="Observações gerais..."
                  rows={3}
                  disabled={isViewMode} 
                />
              </div>
            </div>

            {/* ========== SEÇÃO: CONTATOS (lista dinâmica) ========== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Contatos</h3>
                </div>
                {!isViewMode && (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddContatoPessoa}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Contato
                  </Button>
                )}
              </div>
              <Separator />
              
              {contatosPessoas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum contato cadastrado. {!isViewMode && "Clique em 'Adicionar Contato' para começar."}
                </p>
              ) : (
                <div className="space-y-4">
                  {contatosPessoas.map((pessoa, index) => (
                    <div key={pessoa.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Contato {index + 1}</span>
                        {!isViewMode && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveContatoPessoa(pessoa.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Input 
                          placeholder="Nome" 
                          value={pessoa.nome}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "nome", e.target.value)}
                          disabled={isViewMode}
                        />
                        <Input 
                          placeholder="Cargo / Função" 
                          value={pessoa.cargo}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "cargo", e.target.value)}
                          disabled={isViewMode}
                        />
                        <Input 
                          placeholder="E-mail" 
                          type="email"
                          value={pessoa.email}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "email", e.target.value)}
                          disabled={isViewMode}
                        />
                        <Input 
                          placeholder="Telefone" 
                          value={pessoa.telefone}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "telefone", maskPhone(e.target.value))}
                          disabled={isViewMode}
                        />
                        <Input 
                          placeholder="WhatsApp" 
                          value={pessoa.whatsapp}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "whatsapp", maskPhone(e.target.value))}
                          disabled={isViewMode}
                        />
                        <Input 
                          placeholder="Redes Sociais" 
                          value={pessoa.redesSociais}
                          onChange={(e) => handleUpdateContatoPessoa(pessoa.id, "redesSociais", e.target.value)}
                          disabled={isViewMode}
                        />
                        <Select 
                          value={pessoa.preferenciaContato} 
                          onValueChange={(v) => handleUpdateContatoPessoa(pessoa.id, "preferenciaContato", v)}
                          disabled={isViewMode}
                        >
                          <SelectTrigger><SelectValue placeholder="Preferência" /></SelectTrigger>
                          <SelectContent>
                            {PREFERENCIAS_CONTATO.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========== SEÇÃO: CLASSIFICAÇÃO & FUNIL ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Classificação & Funil</h3>
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estágio (Temperatura)</Label>
                  <Select 
                    value={formData.temperatura} 
                    onValueChange={(v) => setFormData({ ...formData, temperatura: v })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TEMPERATURAS_LEAD.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Score do Lead</Label>
                  <Input 
                    type="number"
                    value={formData.scoreValue} 
                    onChange={(e) => setFormData({ ...formData, scoreValue: e.target.value })} 
                    placeholder="0-100"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem do Contato</Label>
                  <Select 
                    value={formData.origem} 
                    onValueChange={(v) => setFormData({ ...formData, origem: v })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ORIGENS_CONTATO.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Potencial Comercial (R$)</Label>
                  <Input 
                    value={formData.valorPotencial} 
                    onChange={(e) => setFormData({ ...formData, valorPotencial: e.target.value })} 
                    placeholder="0,00"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select 
                    value={formData.prioridade} 
                    onValueChange={(v) => setFormData({ ...formData, prioridade: v })} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ========== SEÇÃO: INTERAÇÕES & FOLLOW-UPS ========== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Interações & Follow-ups</h3>
                </div>
                {!isViewMode && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowInteracaoForm(!showInteracaoForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Interação
                  </Button>
                )}
              </div>
              <Separator />

              {/* Follow-up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Próxima Ação</Label>
                  <Input 
                    value={formData.proximaAcao} 
                    onChange={(e) => setFormData({ ...formData, proximaAcao: e.target.value })} 
                    placeholder="Ex: Enviar proposta, Agendar reunião..."
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data do Follow-up</Label>
                  <Input 
                    type="date"
                    value={formData.dataProximaAcao} 
                    onChange={(e) => setFormData({ ...formData, dataProximaAcao: e.target.value })} 
                    disabled={isViewMode} 
                  />
                </div>
              </div>

              {/* Nova interação form */}
              {showInteracaoForm && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select value={novaInteracao.tipo} onValueChange={(v) => setNovaInteracao({ ...novaInteracao, tipo: v })}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_INTERACAO.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Descrição da interação"
                      className="md:col-span-2"
                      value={novaInteracao.descricao}
                      onChange={(e) => setNovaInteracao({ ...novaInteracao, descricao: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleAddInteracao}>Registrar</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowInteracaoForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {interacoes.length > 0 && (
                <div className="space-y-2">
                  {interacoes.map(i => (
                    <div key={i.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-full">
                        {getInteracaoIcon(i.tipo)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{TIPOS_INTERACAO.find(t => t.value === i.tipo)?.label}</span>
                          <span className="text-xs text-muted-foreground">{i.data}</span>
                          <Badge variant={i.status === "concluida" ? "secondary" : i.status === "atrasada" ? "destructive" : "outline"} className="text-xs">
                            {i.status === "concluida" ? "Concluída" : i.status === "atrasada" ? "Atrasada" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{i.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========== SEÇÃO: PROJETOS, CONTRATOS E FINANCEIRO ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Projetos, Contratos e Financeiro</h3>
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Projetos Vinculados</Label>
                  <Input 
                    value={formData.projetosVinculados} 
                    onChange={(e) => setFormData({ ...formData, projetosVinculados: e.target.value })} 
                    placeholder="IDs ou nomes dos projetos"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel no Projeto</Label>
                  <Input 
                    value={formData.papelProjeto} 
                    onChange={(e) => setFormData({ ...formData, papelProjeto: e.target.value })} 
                    placeholder="Ex: Fornecedor, Parceiro..."
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contratos Associados</Label>
                  <Input 
                    value={formData.contratosAssociados} 
                    onChange={(e) => setFormData({ ...formData, contratosAssociados: e.target.value })} 
                    placeholder="Números dos contratos"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Input 
                    value={formData.formaPagamento} 
                    onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })} 
                    placeholder="Ex: Pix, Boleto, Cartão..."
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Receita (R$)</Label>
                  <Input 
                    value={formData.valorReceita} 
                    onChange={(e) => setFormData({ ...formData, valorReceita: e.target.value })} 
                    placeholder="0,00"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Custo (R$)</Label>
                  <Input 
                    value={formData.valorCusto} 
                    onChange={(e) => setFormData({ ...formData, valorCusto: e.target.value })} 
                    placeholder="0,00"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Input 
                    value={formData.centroCusto} 
                    onChange={(e) => setFormData({ ...formData, centroCusto: e.target.value })} 
                    placeholder="Ex: Marketing, Produção..."
                    disabled={isViewMode} 
                  />
                </div>
              </div>
            </div>

            {/* ========== SEÇÃO: MARKETING, MÍDIA E PLATAFORMA ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Marketing, Mídia e Plataforma</h3>
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Campanhas Associadas</Label>
                  <Input 
                    value={formData.campanhasAssociadas} 
                    onChange={(e) => setFormData({ ...formData, campanhasAssociadas: e.target.value })} 
                    placeholder="Nome das campanhas"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Links de Mídia</Label>
                  <Input 
                    value={formData.linksMidia} 
                    onChange={(e) => setFormData({ ...formData, linksMidia: e.target.value })} 
                    placeholder="URLs de mídia"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plataformas Vinculadas</Label>
                  <Input 
                    value={formData.plataformasVinculadas} 
                    onChange={(e) => setFormData({ ...formData, plataformasVinculadas: e.target.value })} 
                    placeholder="Spotify, YouTube..."
                    disabled={isViewMode} 
                  />
                </div>
              </div>
            </div>

            {/* ========== SEÇÃO: DOCUMENTOS E ANEXOS ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Documentos e Anexos</h3>
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Upload de Arquivos</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Arraste arquivos ou clique para upload</p>
                    <p className="text-xs">(Funcionalidade requer integração com storage)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Links Externos</Label>
                  <Textarea 
                    value={formData.linksExternos} 
                    onChange={(e) => setFormData({ ...formData, linksExternos: e.target.value })} 
                    placeholder="Cole links de documentos externos, um por linha"
                    rows={4}
                    disabled={isViewMode} 
                  />
                </div>
              </div>
            </div>

            {/* ========== SEÇÃO: ENDEREÇO ========== */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Endereço</h3>
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input 
                      value={formData.cep} 
                      onChange={(e) => handleCEPChange(e.target.value)} 
                      placeholder="00000-000"
                      disabled={isViewMode || loadingCEP}
                    />
                    {loadingCEP && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endereço</Label>
                  <Input 
                    value={formData.endereco} 
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} 
                    placeholder="Rua, número, complemento"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input 
                    value={formData.cidade} 
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} 
                    placeholder="Cidade"
                    disabled={isViewMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {estadosBrasileiros.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isViewMode ? "Fechar" : "Cancelar"}
          </Button>
          {!isViewMode && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "create" ? "Criar Registro" : "Salvar Alterações"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
