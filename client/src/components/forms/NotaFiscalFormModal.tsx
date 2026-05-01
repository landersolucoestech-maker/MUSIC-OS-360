import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Upload, FileText, X, ExternalLink, Plus, Trash2, Calculator, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotasFiscais } from "@/hooks/useNotasFiscais";
import { useClientes } from "@/hooks/useClientes";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useStorage } from "@/hooks/useStorage";
import { Badge } from "@/components/ui/badge";
import { isValidCpfCnpj, isValidCEP, isValidEmail, formatCpfCnpj, formatCEP, onlyDigits } from "@/lib/br-validators";
import { parseTipoOperacao, serializeTipoOperacao, type TipoOperacaoNF } from "@/lib/nota-fiscal-tipo";

interface NotaFiscalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaFiscal?: any;
  mode: "create" | "edit" | "view";
  defaultTipoOperacao?: TipoOperacaoNF;
}

interface ItemNota {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  codigo_servico: string;
}

const statusOptions = [
  { value: "emitida", label: "Emitida" },
  { value: "pendente", label: "Pendente" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

const tipoNotaOptions = [
  { value: "nfse", label: "NFS-e (Serviço)" },
  { value: "nfe", label: "NF-e (Produto)" },
  { value: "nfce", label: "NFC-e (Consumidor)" },
];

const formaPagamentoOptions = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cheque", label: "Cheque" },
];

const codigosServicoComuns = [
  { value: "12.07", label: "12.07 - Shows, festivais e congêneres" },
  { value: "12.13", label: "12.13 - Produção de eventos artísticos" },
  { value: "13.02", label: "13.02 - Fonografia ou gravação de sons" },
  { value: "10.05", label: "10.05 - Agenciamento, corretagem ou intermediação artística" },
  { value: "17.01", label: "17.01 - Assessoria, consultoria, gestão" },
  { value: "17.06", label: "17.06 - Propaganda e publicidade" },
];

const ufOptions = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const initialItem: ItemNota = {
  descricao: "",
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
  codigo_servico: "12.07",
};

export function NotaFiscalFormModal({ open, onOpenChange, notaFiscal, mode, defaultTipoOperacao }: NotaFiscalFormModalProps) {
  const { addNotaFiscal, updateNotaFiscal } = useNotasFiscais();
  const { clientes } = useClientes();
  const { companySettings } = useCompanySettings();
  const { uploadFile, uploading, getPublicUrl } = useStorage();

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacaoNF>(defaultTipoOperacao ?? "saida");
  const isEntrada = tipoOperacao === "entrada";
  const [formData, setFormData] = useState<any>({
    numero: "",
    serie: "001",
    tipo_nota: "nfse",
    cliente_id: "",
    natureza_operacao: "Prestação de Serviços Artísticos",
    codigo_servico_municipal: "12.07",
    codigo_municipio: "3550308",
    cfop: "5933",
    descricao_servicos: "",
    data_emissao: undefined as Date | undefined,
    vencimento: undefined as Date | undefined,
    status: "emitida",
    // Tomador
    tomador_cnpj: "",
    tomador_razao_social: "",
    tomador_inscricao_estadual: "ISENTO",
    tomador_inscricao_municipal: "",
    tomador_email: "",
    tomador_endereco: "",
    tomador_cidade: "",
    tomador_uf: "SP",
    tomador_cep: "",
    // Tributos
    valor_servicos: 0,
    valor_deducoes: 0,
    base_calculo: 0,
    aliquota_iss: 5,
    valor_iss: 0,
    iss_retido: false,
    valor_pis: 0,
    valor_cofins: 0,
    valor_inss: 0,
    valor_ir: 0,
    valor_csll: 0,
    valor_liquido: 0,
    // Pagamento
    forma_pagamento: "transferencia",
    condicao_pagamento: "30 dias",
    // Itens
    itens: [{ ...initialItem }] as ItemNota[],
    // Outros
    url_pdf: "",
    observacoes: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const isViewMode = mode === "view";
  const isSubmitting = addNotaFiscal.isPending || updateNotaFiscal.isPending;

  useEffect(() => {
    if (notaFiscal && (mode === "edit" || mode === "view")) {
      const { tipo, observacoesLimpas } = parseTipoOperacao(notaFiscal.observacoes);
      setTipoOperacao(tipo);
      setFormData({
        ...formData,
        ...notaFiscal,
        observacoes: observacoesLimpas,
        data_emissao: notaFiscal.data_emissao ? new Date(notaFiscal.data_emissao) : undefined,
        vencimento: notaFiscal.vencimento ? new Date(notaFiscal.vencimento) : undefined,
        itens: Array.isArray(notaFiscal.itens) && notaFiscal.itens.length > 0
          ? notaFiscal.itens
          : [{ ...initialItem, descricao: notaFiscal.descricao_servicos || "", valor_unitario: notaFiscal.valor || 0, valor_total: notaFiscal.valor || 0 }],
      });
    } else if (!notaFiscal && open) {
      setTipoOperacao(defaultTipoOperacao ?? "saida");
      setFormData({
        numero: "",
        serie: "001",
        tipo_nota: "nfse",
        cliente_id: "",
        natureza_operacao: "Prestação de Serviços Artísticos",
        codigo_servico_municipal: "12.07",
        codigo_municipio: "3550308",
        cfop: "5933",
        descricao_servicos: "",
        data_emissao: new Date(),
        vencimento: undefined,
        status: "emitida",
        tomador_cnpj: "",
        tomador_razao_social: "",
        tomador_inscricao_estadual: "ISENTO",
        tomador_inscricao_municipal: "",
        tomador_email: "",
        tomador_endereco: "",
        tomador_cidade: "",
        tomador_uf: "SP",
        tomador_cep: "",
        valor_servicos: 0,
        valor_deducoes: 0,
        base_calculo: 0,
        aliquota_iss: 5,
        valor_iss: 0,
        iss_retido: false,
        valor_pis: 0,
        valor_cofins: 0,
        valor_inss: 0,
        valor_ir: 0,
        valor_csll: 0,
        valor_liquido: 0,
        forma_pagamento: "transferencia",
        condicao_pagamento: "30 dias",
        itens: [{ ...initialItem }],
        url_pdf: "",
        observacoes: "",
      });
    }
    setSelectedFile(null);
    setValidationErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaFiscal, mode, open, defaultTipoOperacao]);

  // Auto-fill município do prestador a partir do company_settings (apenas no create)
  useEffect(() => {
    if (mode !== "create" || !open || !companySettings) return;
    setFormData((prev: any) => {
      // Só preenche se ainda estiver vazio/default
      const muniDefault = !prev.codigo_municipio || prev.codigo_municipio === "3550308";
      if (!muniDefault) return prev;
      // Heurística simples: SP capital -> 3550308
      const cidade = (companySettings.cidade || "").toLowerCase();
      const codigo = cidade.includes("são paulo") ? "3550308" : prev.codigo_municipio;
      return { ...prev, codigo_municipio: codigo };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySettings, mode, open]);

  // Auto-fill tomador quando cliente selecionado
  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((c: any) => c.id === clienteId);
    if (cliente) {
      setFormData({
        ...formData,
        cliente_id: clienteId,
        tomador_cnpj: (cliente as any).cpf_cnpj || "",
        tomador_razao_social: cliente.nome || "",
        tomador_email: (cliente as any).email || "",
        tomador_endereco: (cliente as any).endereco || "",
        tomador_cidade: (cliente as any).cidade || "",
        tomador_uf: (cliente as any).estado || "SP",
      });
    } else {
      setFormData({ ...formData, cliente_id: clienteId });
    }
  };

  // Recalcular tributos sempre que valor_servicos / aliquota mudar
  const recalcularTributos = () => {
    const valor = parseFloat(formData.valor_servicos) || 0;
    const deducoes = parseFloat(formData.valor_deducoes) || 0;
    const baseCalculo = valor - deducoes;
    const aliquotaIss = parseFloat(formData.aliquota_iss) || 0;
    const valorIss = +(baseCalculo * (aliquotaIss / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const issDescontado = formData.iss_retido ? valorIss : 0;
    const valorInss = parseFloat(formData.valor_inss) || 0;
    const valorLiquido = +(valor - issDescontado - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);

    setFormData({
      ...formData,
      base_calculo: baseCalculo,
      valor_iss: valorIss,
      valor_pis: valorPis,
      valor_cofins: valorCofins,
      valor_ir: valorIr,
      valor_csll: valorCsll,
      valor_liquido: valorLiquido,
    });
    toast.success("Tributos recalculados");
  };

  // Recálculo automático ao mudar valor/aliquota/iss_retido/INSS
  useEffect(() => {
    if (isViewMode) return;
    const valor = parseFloat(formData.valor_servicos) || 0;
    if (valor === 0) return;
    const deducoes = parseFloat(formData.valor_deducoes) || 0;
    const baseCalculo = +(valor - deducoes).toFixed(2);
    const aliquotaIss = parseFloat(formData.aliquota_iss) || 0;
    const valorIss = +(baseCalculo * (aliquotaIss / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const valorInss = parseFloat(formData.valor_inss) || 0;
    const issDescontado = formData.iss_retido ? valorIss : 0;
    const valorLiquido = +(valor - issDescontado - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);

    setFormData((prev: any) => {
      if (
        prev.base_calculo === baseCalculo &&
        prev.valor_iss === valorIss &&
        prev.valor_pis === valorPis &&
        prev.valor_cofins === valorCofins &&
        prev.valor_ir === valorIr &&
        prev.valor_csll === valorCsll &&
        prev.valor_liquido === valorLiquido
      ) return prev;
      return { ...prev, base_calculo: baseCalculo, valor_iss: valorIss, valor_pis: valorPis, valor_cofins: valorCofins, valor_ir: valorIr, valor_csll: valorCsll, valor_liquido: valorLiquido };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.valor_servicos, formData.valor_deducoes, formData.aliquota_iss, formData.iss_retido, formData.valor_inss, isViewMode]);

  // Atualizar item
  const updateItem = (index: number, field: keyof ItemNota, value: any) => {
    const novos = [...formData.itens];
    novos[index] = { ...novos[index], [field]: value };
    if (field === "quantidade" || field === "valor_unitario") {
      novos[index].valor_total = +((novos[index].quantidade || 0) * (novos[index].valor_unitario || 0)).toFixed(2);
    }
    const total = novos.reduce((acc: number, it: ItemNota) => acc + (it.valor_total || 0), 0);
    setFormData({ ...formData, itens: novos, valor_servicos: total });
  };

  const addItem = () => setFormData({ ...formData, itens: [...formData.itens, { ...initialItem }] });
  const removeItem = (i: number) => {
    if (formData.itens.length === 1) return;
    const novos = formData.itens.filter((_: any, idx: number) => idx !== i);
    const total = novos.reduce((acc: number, it: ItemNota) => acc + (it.valor_total || 0), 0);
    setFormData({ ...formData, itens: novos, valor_servicos: total });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") return toast.error("Apenas PDF");
      if (file.size > 10 * 1024 * 1024) return toast.error("Máx 10MB");
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;
    const errors: Record<string, string> = {};
    if (!formData.numero?.trim()) errors.numero = "Número obrigatório";
    if (!formData.tomador_razao_social?.trim()) errors.tomador_razao_social = "Razão social obrigatória";
    if (!formData.tomador_cnpj?.trim()) errors.tomador_cnpj = "CNPJ/CPF obrigatório";
    else if (!isValidCpfCnpj(formData.tomador_cnpj)) errors.tomador_cnpj = "CNPJ/CPF inválido (dígito verificador não confere)";
    if (formData.tomador_cep && !isValidCEP(formData.tomador_cep)) errors.tomador_cep = "CEP inválido";
    if (formData.tomador_email && !isValidEmail(formData.tomador_email)) errors.tomador_email = "E-mail inválido";
    if (!(parseFloat(formData.valor_servicos) > 0)) errors.valor_servicos = "Informe o valor dos serviços";
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    let pdfUrl = formData.url_pdf;
    if (selectedFile) {
      const result = await uploadFile(selectedFile, { folder: "notas-fiscais" });
      if (result) pdfUrl = getPublicUrl(result.path);
    }

    const data: any = {
      numero: formData.numero.trim(),
      serie: formData.serie?.trim() || null,
      tipo_nota: formData.tipo_nota,
      cliente_id: formData.cliente_id || null,
      venda_id: null,
      valor: parseFloat(formData.valor_servicos) || 0,
      data_emissao: formData.data_emissao ? format(formData.data_emissao, "yyyy-MM-dd") : null,
      vencimento: formData.vencimento ? format(formData.vencimento, "yyyy-MM-dd") : null,
      status: formData.status,
      url_pdf: pdfUrl || null,
      observacoes: serializeTipoOperacao(tipoOperacao, formData.observacoes?.trim() || "") || null,
      natureza_operacao: formData.natureza_operacao,
      codigo_servico_municipal: formData.codigo_servico_municipal,
      codigo_municipio: formData.codigo_municipio,
      cfop: formData.cfop,
      descricao_servicos: formData.descricao_servicos,
      tomador_cnpj: formData.tomador_cnpj,
      tomador_razao_social: formData.tomador_razao_social,
      tomador_inscricao_estadual: formData.tomador_inscricao_estadual,
      tomador_inscricao_municipal: formData.tomador_inscricao_municipal || null,
      tomador_email: formData.tomador_email,
      tomador_endereco: formData.tomador_endereco,
      tomador_cidade: formData.tomador_cidade,
      tomador_uf: formData.tomador_uf,
      tomador_cep: formData.tomador_cep,
      valor_servicos: parseFloat(formData.valor_servicos) || 0,
      valor_deducoes: parseFloat(formData.valor_deducoes) || 0,
      base_calculo: parseFloat(formData.base_calculo) || 0,
      aliquota_iss: parseFloat(formData.aliquota_iss) || 0,
      valor_iss: parseFloat(formData.valor_iss) || 0,
      iss_retido: !!formData.iss_retido,
      valor_pis: parseFloat(formData.valor_pis) || 0,
      valor_cofins: parseFloat(formData.valor_cofins) || 0,
      valor_inss: parseFloat(formData.valor_inss) || 0,
      valor_ir: parseFloat(formData.valor_ir) || 0,
      valor_csll: parseFloat(formData.valor_csll) || 0,
      valor_liquido: parseFloat(formData.valor_liquido) || 0,
      forma_pagamento: formData.forma_pagamento,
      condicao_pagamento: formData.condicao_pagamento,
      itens: formData.itens,
    };

    if (mode === "create") {
      addNotaFiscal.mutate(data, { onSuccess: () => onOpenChange(false) });
    } else {
      updateNotaFiscal.mutate({ id: notaFiscal.id, ...data }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="modal-nota-fiscal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {mode === "create"
              ? (isEntrada ? "Registrar Nota de Entrada" : "Emitir Nota Fiscal")
              : mode === "edit"
                ? (isEntrada ? "Editar Nota de Entrada" : "Editar Nota Fiscal")
                : (isEntrada ? "Visualizar Nota de Entrada" : "Visualizar Nota Fiscal")}
            {formData.numero && <Badge variant="outline" className="ml-2">Nº {formData.numero}/{formData.serie}</Badge>}
            <Badge variant={isEntrada ? "secondary" : "default"} className="ml-1 gap-1">
              {isEntrada ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {isEntrada ? "Entrada" : "Saída"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 mt-2">
            {/* TIPO DE OPERAÇÃO */}
            <section className="space-y-3" data-testid="section-tipo-operacao">
              <h3 className="text-base font-semibold border-b pb-1">Tipo de Operação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => !isViewMode && setTipoOperacao("saida")}
                  disabled={isViewMode}
                  data-testid="button-tipo-saida"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
                    tipoOperacao === "saida"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    isViewMode && "cursor-not-allowed opacity-70",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    tipoOperacao === "saida" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">Saída</p>
                    <p className="text-xs text-muted-foreground">Nota emitida para cliente / tomador</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => !isViewMode && setTipoOperacao("entrada")}
                  disabled={isViewMode}
                  data-testid="button-tipo-entrada"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
                    tipoOperacao === "entrada"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    isViewMode && "cursor-not-allowed opacity-70",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    tipoOperacao === "entrada" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">Entrada</p>
                    <p className="text-xs text-muted-foreground">Nota recebida de fornecedor / terceiro</p>
                  </div>
                </button>
              </div>
            </section>

            {/* IDENTIFICAÇÃO */}
            <section className="space-y-4" data-testid="section-identificacao">
              <h3 className="text-base font-semibold border-b pb-1">Identificação</h3>
              {/* PRESTADOR/TOMADOR (auto-fill de company_settings, somente leitura) */}
              {companySettings && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {isEntrada
                        ? "Tomador (sua empresa, configurada em Empresa)"
                        : "Prestador (configurado em Empresa)"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Razão Social</p>
                      <p className="font-medium">{companySettings.company_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CNPJ</p>
                      <p className="font-medium">{companySettings.cnpj ? formatCpfCnpj(companySettings.cnpj) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Insc. Estadual</p>
                      <p className="font-medium">{companySettings.inscricao_estadual || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {[companySettings.logradouro, companySettings.numero, companySettings.cidade, companySettings.estado, companySettings.cep && formatCEP(companySettings.cep)].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="font-medium">{companySettings.banco ? `${companySettings.banco} • Ag ${companySettings.agencia || "—"} • CC ${companySettings.conta || "—"}` : "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número <span className="text-destructive">*</span></Label>
                  <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} placeholder="000001234" disabled={isViewMode} data-testid="input-numero" />
                </div>
                <div className="space-y-2">
                  <Label>Série</Label>
                  <Input value={formData.serie} onChange={(e) => setFormData({ ...formData, serie: e.target.value })} placeholder="001" disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Nota</Label>
                  <Select value={formData.tipo_nota} onValueChange={(v) => setFormData({ ...formData, tipo_nota: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tipoNotaOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Emissão</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.data_emissao && "text-muted-foreground")} disabled={isViewMode}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.data_emissao ? format(formData.data_emissao, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={formData.data_emissao} onSelect={(d) => setFormData({ ...formData, data_emissao: d })} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Natureza da Operação</Label>
                  <Input value={formData.natureza_operacao} onChange={(e) => setFormData({ ...formData, natureza_operacao: e.target.value })} disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>CFOP</Label>
                  <Input value={formData.cfop} onChange={(e) => setFormData({ ...formData, cfop: e.target.value })} placeholder="5933" disabled={isViewMode} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código Serviço Municipal</Label>
                  <Select value={formData.codigo_servico_municipal} onValueChange={(v) => setFormData({ ...formData, codigo_servico_municipal: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {codigosServicoComuns.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Código Município (IBGE)</Label>
                  <Input value={formData.codigo_municipio} onChange={(e) => setFormData({ ...formData, codigo_municipio: e.target.value })} placeholder="3550308" disabled={isViewMode} />
                </div>
              </div>
            </section>

            {/* TOMADOR / FORNECEDOR */}
            <section className="space-y-4" data-testid="section-tomador">
              <h3 className="text-base font-semibold border-b pb-1">{isEntrada ? "Fornecedor / Emitente" : "Tomador"}</h3>
              <div className="space-y-2">
                <Label>{isEntrada ? "Fornecedor Cadastrado (preenche automaticamente)" : "Cliente Cadastrado (preenche automaticamente)"}</Label>
                <Select value={formData.cliente_id} onValueChange={handleClienteChange} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ / CPF <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.tomador_cnpj}
                    onChange={(e) => setFormData({ ...formData, tomador_cnpj: e.target.value })}
                    onBlur={(e) => setFormData({ ...formData, tomador_cnpj: formatCpfCnpj(e.target.value) })}
                    placeholder="00.000.000/0001-00"
                    disabled={isViewMode}
                    data-testid="input-tomador-cnpj"
                    aria-invalid={!!validationErrors.tomador_cnpj}
                    className={validationErrors.tomador_cnpj ? "border-destructive" : ""}
                  />
                  {validationErrors.tomador_cnpj && <p className="text-xs text-destructive">{validationErrors.tomador_cnpj}</p>}
                  {formData.tomador_cnpj && !validationErrors.tomador_cnpj && isValidCpfCnpj(formData.tomador_cnpj) && (
                    <p className="text-xs text-green-600">✓ Documento válido</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Razão Social / Nome <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.tomador_razao_social}
                    onChange={(e) => setFormData({ ...formData, tomador_razao_social: e.target.value })}
                    disabled={isViewMode}
                    aria-invalid={!!validationErrors.tomador_razao_social}
                    className={validationErrors.tomador_razao_social ? "border-destructive" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input value={formData.tomador_inscricao_estadual} onChange={(e) => setFormData({ ...formData, tomador_inscricao_estadual: e.target.value })} disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Municipal</Label>
                  <Input value={formData.tomador_inscricao_municipal} onChange={(e) => setFormData({ ...formData, tomador_inscricao_municipal: e.target.value })} disabled={isViewMode} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.tomador_email}
                  onChange={(e) => setFormData({ ...formData, tomador_email: e.target.value })}
                  disabled={isViewMode}
                  aria-invalid={!!validationErrors.tomador_email}
                  className={validationErrors.tomador_email ? "border-destructive" : ""}
                />
                {validationErrors.tomador_email && <p className="text-xs text-destructive">{validationErrors.tomador_email}</p>}
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={formData.tomador_endereco} onChange={(e) => setFormData({ ...formData, tomador_endereco: e.target.value })} placeholder="Av. Paulista, 1000" disabled={isViewMode} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={formData.tomador_cidade} onChange={(e) => setFormData({ ...formData, tomador_cidade: e.target.value })} disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Select value={formData.tomador_uf} onValueChange={(v) => setFormData({ ...formData, tomador_uf: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ufOptions.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={formData.tomador_cep}
                    onChange={(e) => setFormData({ ...formData, tomador_cep: e.target.value })}
                    onBlur={(e) => setFormData({ ...formData, tomador_cep: formatCEP(e.target.value) })}
                    placeholder="00000-000"
                    disabled={isViewMode}
                    aria-invalid={!!validationErrors.tomador_cep}
                    className={validationErrors.tomador_cep ? "border-destructive" : ""}
                  />
                  {validationErrors.tomador_cep && <p className="text-xs text-destructive">{validationErrors.tomador_cep}</p>}
                </div>
              </div>
            </section>

            {/* SERVIÇOS / ITENS */}
            <section className="space-y-4" data-testid="section-servicos">
              <h3 className="text-base font-semibold border-b pb-1">Serviços</h3>
              <div className="space-y-2">
                <Label>Descrição dos Serviços</Label>
                <Textarea value={formData.descricao_servicos} onChange={(e) => setFormData({ ...formData, descricao_servicos: e.target.value })} placeholder="Descrição completa dos serviços prestados..." rows={3} disabled={isViewMode} />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Itens da Nota</CardTitle>
                  {!isViewMode && (
                    <Button type="button" size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                      <Plus className="h-4 w-4 mr-1" />Adicionar Item
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData.itens.map((item: ItemNota, i: number) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-lg" data-testid={`item-nota-${i}`}>
                      <div className="col-span-12 md:col-span-5 space-y-1">
                        <Label className="text-xs">Descrição</Label>
                        <Input value={item.descricao} onChange={(e) => updateItem(i, "descricao", e.target.value)} disabled={isViewMode} />
                      </div>
                      <div className="col-span-4 md:col-span-2 space-y-1">
                        <Label className="text-xs">Cód. Serviço</Label>
                        <Input value={item.codigo_servico} onChange={(e) => updateItem(i, "codigo_servico", e.target.value)} disabled={isViewMode} />
                      </div>
                      <div className="col-span-3 md:col-span-1 space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input type="number" min="0" step="0.01" value={item.quantidade} onChange={(e) => updateItem(i, "quantidade", parseFloat(e.target.value) || 0)} disabled={isViewMode} />
                      </div>
                      <div className="col-span-5 md:col-span-2 space-y-1">
                        <Label className="text-xs">Vlr Unit.</Label>
                        <Input type="number" min="0" step="0.01" value={item.valor_unitario} onChange={(e) => updateItem(i, "valor_unitario", parseFloat(e.target.value) || 0)} disabled={isViewMode} />
                      </div>
                      <div className="col-span-10 md:col-span-1 space-y-1">
                        <Label className="text-xs">Total</Label>
                        <p className="text-sm font-semibold pt-2">{fmt(item.valor_total)}</p>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        {!isViewMode && formData.itens.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} data-testid={`button-remove-item-${i}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t border-border">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total dos Serviços</p>
                      <p className="text-xl font-bold text-foreground" data-testid="text-total-servicos">{fmt(formData.valor_servicos)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* TRIBUTOS */}
            <section className="space-y-4" data-testid="section-tributos">
              <h3 className="text-base font-semibold border-b pb-1">Tributos</h3>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{isEntrada ? "Tributos retidos / pagos sobre o valor da nota." : "Tributos calculados automaticamente sobre o valor dos serviços."}</p>
                {!isViewMode && (
                  <Button type="button" variant="outline" size="sm" onClick={recalcularTributos} data-testid="button-recalcular">
                    <Calculator className="h-4 w-4 mr-1" />Recalcular
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor dos Serviços</Label>
                  <Input type="number" step="0.01" value={formData.valor_servicos} onChange={(e) => setFormData({ ...formData, valor_servicos: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>Deduções</Label>
                  <Input type="number" step="0.01" value={formData.valor_deducoes} onChange={(e) => setFormData({ ...formData, valor_deducoes: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>Base de Cálculo</Label>
                  <Input type="number" step="0.01" value={formData.base_calculo} onChange={(e) => setFormData({ ...formData, base_calculo: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                </div>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">ISS</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Alíquota ISS (%)</Label>
                    <Input type="number" step="0.01" value={formData.aliquota_iss} onChange={(e) => setFormData({ ...formData, aliquota_iss: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor ISS</Label>
                    <Input type="number" step="0.01" value={formData.valor_iss} onChange={(e) => setFormData({ ...formData, valor_iss: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Label>ISS Retido na Fonte?</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={formData.iss_retido} onCheckedChange={(v) => setFormData({ ...formData, iss_retido: v })} disabled={isViewMode} />
                      <span className="text-sm">{formData.iss_retido ? "Sim (retido pelo tomador)" : "Não (recolhido pelo prestador)"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Retenções Federais</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>PIS</Label>
                    <Input type="number" step="0.01" value={formData.valor_pis} onChange={(e) => setFormData({ ...formData, valor_pis: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2">
                    <Label>COFINS</Label>
                    <Input type="number" step="0.01" value={formData.valor_cofins} onChange={(e) => setFormData({ ...formData, valor_cofins: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2">
                    <Label>IRRF</Label>
                    <Input type="number" step="0.01" value={formData.valor_ir} onChange={(e) => setFormData({ ...formData, valor_ir: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2">
                    <Label>CSLL</Label>
                    <Input type="number" step="0.01" value={formData.valor_csll} onChange={(e) => setFormData({ ...formData, valor_csll: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                  <div className="space-y-2">
                    <Label>INSS</Label>
                    <Input type="number" step="0.01" value={formData.valor_inss} onChange={(e) => setFormData({ ...formData, valor_inss: parseFloat(e.target.value) || 0 })} disabled={isViewMode} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{isEntrada ? "Valor Líquido a Pagar" : "Valor Líquido a Receber"}</p>
                    <p className="text-2xl font-bold text-primary" data-testid="text-valor-liquido">{fmt(formData.valor_liquido)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Bruto: {fmt(formData.valor_servicos)}</p>
                    <p>Total Retenções: {fmt((formData.iss_retido ? formData.valor_iss : 0) + formData.valor_pis + formData.valor_cofins + formData.valor_ir + formData.valor_csll + (formData.valor_inss || 0))}</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* PAGAMENTO */}
            <section className="space-y-4" data-testid="section-pagamento">
              <h3 className="text-base font-semibold border-b pb-1">Pagamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v })} disabled={isViewMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {formaPagamentoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condição</Label>
                  <Input value={formData.condicao_pagamento} onChange={(e) => setFormData({ ...formData, condicao_pagamento: e.target.value })} placeholder="30 dias / À vista / 30/60/90" disabled={isViewMode} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.vencimento && "text-muted-foreground")} disabled={isViewMode}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.vencimento ? format(formData.vencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={formData.vencimento} onSelect={(d) => setFormData({ ...formData, vencimento: d })} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Arquivo PDF da Nota</Label>
                {formData.url_pdf && !selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm flex-1 truncate">Nota fiscal anexada</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => window.open(formData.url_pdf, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {!isViewMode && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, url_pdf: "" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {!isViewMode && !selectedFile && !formData.url_pdf && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="pdf-upload-nf" />
                    <label htmlFor="pdf-upload-nf" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Anexar PDF da NF (máx 10MB)</p>
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Observações adicionais..." rows={3} disabled={isViewMode} />
              </div>
            </section>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancelar-nf">
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" disabled={isSubmitting || uploading} data-testid="button-salvar-nf">
                {(isSubmitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create"
                  ? (isEntrada ? "Registrar Entrada" : "Emitir Nota")
                  : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
