import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { useArtistas } from "@/hooks/useArtistas";
import { useClientes } from "@/hooks/useClientes";
import { useProjetos } from "@/hooks/useProjetos";
import { useEventos } from "@/hooks/useEventos";
import { useContratos } from "@/hooks/useContratos";

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
import {
  TransacaoFormData,
  initialFormData,
  tiposTransacao,
  tiposCliente,
  tiposClienteReceita,
  statusTransacao,
  formasPagamento,
  tiposPagamento,
  intervalosParcelas,
  getCategoriasParaTipoTransacao,
  getSubcategoriasParaCategoria,
  getItensInvestimentoPorCategoria,
  orgaosArrecadadores,
  servicosDespesaComArtistaEProjeto,
  produtosDespesaComEvento,
  receitasMusicaisComArtistaEProjeto,
  servicosReceitaComArtistaEProjeto,
  servicosReceitaComArtista,
} from "@/lib/transacao-constants";

interface TransacaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao?: any;
  mode: "create" | "edit" | "view";
}

export function TransacaoFormModal({ open, onOpenChange, transacao, mode }: TransacaoFormModalProps) {
  const [formData, setFormData] = useState<TransacaoFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof TransacaoFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { artistas } = useArtistas();
  const { clientes } = useClientes();
  const { projetos } = useProjetos();
  const { eventos } = useEventos();
  const { contratos } = useContratos();

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Nova Transação Financeira" : mode === "edit" ? "Editar Transação" : "Visualizar Transação";

  // ==================== INICIALIZAÇÃO ====================

  useEffect(() => {
    if (transacao && open) {
      setFormData({ ...initialFormData, ...transacao });
    } else if (!transacao && open) {
      setFormData(initialFormData);
    }
    setErrors({});
  }, [transacao, open]);

  // ==================== RESET DE CAMPOS DEPENDENTES ====================

  // Reset quando tipo de transação muda
  useEffect(() => {
    if (formData.tipoTransacao) {
      setFormData(prev => ({
        ...prev,
        tipoCliente: prev.tipoTransacao === "imposto" || prev.tipoTransacao === "transferencia" || prev.tipoTransacao === "investimento" ? "" : prev.tipoCliente,
        categoria: "",
        subcategoria: "",
        itemInvestimento: "",
        artistaVinculado: "",
        projetoVinculado: "",
        contratoVinculado: "",
        eventoVinculado: "",
        motivoViagem: "",
        nomePublicidade: "",
        orgaoArrecadador: "",
      }));
    }
  }, [formData.tipoTransacao]);

  // Reset quando tipo de cliente muda
  useEffect(() => {
    if (formData.tipoCliente) {
      setFormData(prev => ({
        ...prev,
        categoria: "",
        subcategoria: "",
        artistaVinculado: "",
        projetoVinculado: "",
        contratoVinculado: "",
        eventoVinculado: "",
        motivoViagem: "",
        nomePublicidade: "",
      }));
    }
  }, [formData.tipoCliente]);

  // Reset quando categoria muda
  useEffect(() => {
    if (formData.categoria) {
      setFormData(prev => ({
        ...prev,
        subcategoria: "",
        itemInvestimento: "",
        artistaVinculado: "",
        projetoVinculado: "",
        contratoVinculado: "",
        eventoVinculado: "",
        motivoViagem: "",
        nomePublicidade: "",
      }));
    }
  }, [formData.categoria]);

  // Reset projeto e evento quando artista muda
  useEffect(() => {
    if (formData.artistaVinculado) {
      setFormData(prev => ({
        ...prev,
        projetoVinculado: "",
        eventoVinculado: "",
        contratoVinculado: "",
      }));
    }
  }, [formData.artistaVinculado]);

  // Reset campos de parcelamento quando tipo de pagamento muda para à vista
  useEffect(() => {
    if (formData.tipoPagamento === "avista") {
      setFormData(prev => ({
        ...prev,
        quantidadeParcelas: "",
        intervaloParcelas: "mensal",
        dataPrimeiraParcela: "",
      }));
    }
  }, [formData.tipoPagamento]);

  // ==================== CONDIÇÕES DE EXIBIÇÃO ====================

  const isImposto = formData.tipoTransacao === "imposto";
  const isTransferencia = formData.tipoTransacao === "transferencia";
  const isInvestimento = formData.tipoTransacao === "investimento";
  const isDespesa = formData.tipoTransacao === "despesa";
  const isReceita = formData.tipoTransacao === "receita";

  const isEmpresa = formData.tipoCliente === "empresa";
  const isArtista = formData.tipoCliente === "artista";
  const isPessoa = formData.tipoCliente === "pessoa";
  const isEmpresaOuPessoa = isEmpresa || isPessoa;

  // Exibir tipo de cliente (não para imposto, transferência, investimento)
  const exibirTipoCliente = formData.tipoTransacao && !isImposto && !isTransferencia && !isInvestimento;

  // Categorias
  const categorias = useMemo(() => 
    getCategoriasParaTipoTransacao(formData.tipoTransacao, formData.tipoCliente), 
    [formData.tipoTransacao, formData.tipoCliente]
  );
  const exibirCategoria = categorias.length > 0 && (formData.tipoCliente || isImposto || isTransferencia || isInvestimento);

  // Subcategorias
  const subcategorias = useMemo(() => 
    getSubcategoriasParaCategoria(formData.tipoTransacao, formData.tipoCliente, formData.categoria),
    [formData.tipoTransacao, formData.tipoCliente, formData.categoria]
  );
  const exibirSubcategoria = subcategorias.length > 0;

  // Itens de investimento
  const itensInvestimento = useMemo(() => 
    getItensInvestimentoPorCategoria(formData.categoria),
    [formData.categoria]
  );
  const exibirItemInvestimento = isInvestimento && formData.categoria && itensInvestimento.length > 0;

  // ==================== REGRAS ESPECÍFICAS PARA DESPESAS EMPRESA/PESSOA ====================

  // SERVIÇOS - Artista + Projeto obrigatórios para alguns tipos
  const isDespesaServico = isDespesa && isEmpresaOuPessoa && formData.categoria === "servicos";
  const exibirArtistaServicoObrigatorio = isDespesaServico && servicosDespesaComArtistaEProjeto.includes(formData.subcategoria);
  const exibirProjetoServicoObrigatorio = exibirArtistaServicoObrigatorio;

  // MARKETING - Artista obrigatório, Projeto opcional
  const isDespesaMarketing = isDespesa && isEmpresaOuPessoa && formData.categoria === "marketing";
  const exibirArtistaMarketingObrigatorio = isDespesaMarketing && formData.subcategoria;
  const exibirProjetoMarketingOpcional = exibirArtistaMarketingObrigatorio && formData.artistaVinculado;

  // VIAGENS - Artista obrigatório + Motivo obrigatório
  const isDespesaViagem = isDespesa && isEmpresaOuPessoa && formData.categoria === "viagens";
  const exibirArtistaViagemObrigatorio = isDespesaViagem && formData.subcategoria;
  const exibirMotivoViagem = exibirArtistaViagemObrigatorio;

  // PRODUTOS - Artista obrigatório, Evento obrigatório para cenografia/pirotecnia
  const isDespesaProduto = isDespesa && isEmpresaOuPessoa && formData.categoria === "produtos";
  const exibirArtistaProdutoObrigatorio = isDespesaProduto && formData.subcategoria;
  const exibirEventoProdutoObrigatorio = isDespesaProduto && produtosDespesaComEvento.includes(formData.subcategoria);

  // SUPORTE FINANCEIRO - Apenas Artista obrigatório
  const isDespesaSuporteFinanceiro = isDespesa && isEmpresaOuPessoa && formData.categoria === "suporte-financeiro";
  const exibirArtistaSuporteFinanceiro = isDespesaSuporteFinanceiro;

  // ==================== REGRAS ESPECÍFICAS PARA DESPESAS ARTISTA ====================

  // CACHÊS - Artista sempre vinculado
  const isDespesaArtistaCaches = isDespesa && isArtista && formData.categoria === "caches";
  const exibirArtistaArtistaCaches = isDespesaArtistaCaches && formData.subcategoria;
  const exibirEventoArtistaCaches = isDespesaArtistaCaches && formData.subcategoria === "show-evento";
  const exibirNomePublicidade = isDespesaArtistaCaches && formData.subcategoria === "publicidade";

  // SUPORTE FINANCEIRO (Artista)
  const isDespesaArtistaSuporteFinanceiro = isDespesa && isArtista && formData.categoria === "suporte-financeiro";
  const exibirArtistaArtistaSuporteFinanceiro = isDespesaArtistaSuporteFinanceiro;

  // ==================== REGRAS ESPECÍFICAS PARA RECEITAS ====================

  // RECEITAS MUSICAIS
  const isReceitaMusical = isReceita && isEmpresaOuPessoa && formData.categoria === "receitas-musicais";
  const exibirArtistaReceitaMusical = isReceitaMusical && formData.subcategoria;
  const exibirProjetoReceitaMusical = isReceitaMusical && receitasMusicaisComArtistaEProjeto.includes(formData.subcategoria);
  const exibirEventoReceitaMusical = isReceitaMusical && ["participacao-show-evento", "venda-show-fechado"].includes(formData.subcategoria);

  // SERVIÇOS (Receita)
  const isReceitaServico = isReceita && isEmpresaOuPessoa && formData.categoria === "servicos";
  const exibirArtistaServicoReceita = isReceitaServico && (
    servicosReceitaComArtistaEProjeto.includes(formData.subcategoria) ||
    servicosReceitaComArtista.includes(formData.subcategoria)
  );
  const exibirProjetoServicoReceita = isReceitaServico && servicosReceitaComArtistaEProjeto.includes(formData.subcategoria);

  // PRODUTOS (Receita)
  const isReceitaProduto = isReceita && isEmpresaOuPessoa && formData.categoria === "produtos";
  const exibirArtistaProdutoReceita = isReceitaProduto && formData.subcategoria;

  // ==================== CONSOLIDAÇÃO DE EXIBIÇÃO ====================

  const exibirArtista = 
    exibirArtistaServicoObrigatorio ||
    exibirArtistaMarketingObrigatorio ||
    exibirArtistaViagemObrigatorio ||
    exibirArtistaProdutoObrigatorio ||
    exibirArtistaSuporteFinanceiro ||
    exibirArtistaArtistaCaches ||
    exibirArtistaArtistaSuporteFinanceiro ||
    exibirArtistaReceitaMusical ||
    exibirArtistaServicoReceita ||
    exibirArtistaProdutoReceita;

  const exibirProjeto = 
    exibirProjetoServicoObrigatorio ||
    exibirProjetoMarketingOpcional ||
    exibirProjetoReceitaMusical ||
    exibirProjetoServicoReceita;

  const projetoObrigatorio = 
    exibirProjetoServicoObrigatorio ||
    exibirProjetoReceitaMusical ||
    exibirProjetoServicoReceita;

  const exibirEvento = 
    exibirEventoProdutoObrigatorio ||
    exibirEventoArtistaCaches ||
    exibirEventoReceitaMusical;

  const exibirFornecedor = (isDespesa || isReceita) && isEmpresaOuPessoa;
  const exibirOrgaoArrecadador = isImposto;
  const exibirParcelamento = formData.tipoPagamento === "parcelado";

  // Projetos e eventos filtrados por artista
  const projetosFiltrados = useMemo(() => 
    formData.artistaVinculado 
      ? projetos.filter(p => p.artista_id === formData.artistaVinculado)
      : [],
    [formData.artistaVinculado, projetos]
  );
  
  const eventosFiltrados = useMemo(() => 
    formData.artistaVinculado 
      ? eventos.filter(e => e.artista_id === formData.artistaVinculado)
      : [],
    [formData.artistaVinculado, eventos]
  );

  const contratosFiltrados = useMemo(() => 
    formData.artistaVinculado 
      ? contratos.filter(c => c.artista_id === formData.artistaVinculado)
      : [],
    [formData.artistaVinculado, contratos]
  );

  // Cálculo de valor por parcela
  const valorParcela = useMemo(() => {
    if (formData.tipoPagamento === "parcelado" && formData.valor && formData.quantidadeParcelas) {
      const valor = parseFloat(formData.valor);
      const parcelas = parseInt(formData.quantidadeParcelas);
      if (valor > 0 && parcelas >= 2) {
        return (valor / parcelas).toFixed(2);
      }
    }
    return null;
  }, [formData.tipoPagamento, formData.valor, formData.quantidadeParcelas]);

  // ==================== LABELS DINÂMICOS ====================

  const getLabelTipoCliente = () => {
    if (isDespesa) return "Para quem pagar *";
    if (isReceita) return "Receber de *";
    return "Tipo de Cliente *";
  };

  // ==================== VALIDAÇÃO ====================

  const validate = useCallback(() => {
    const newErrors: Partial<Record<keyof TransacaoFormData, string>> = {};

    // Validações básicas
    if (!formData.tipoTransacao) {
      newErrors.tipoTransacao = "Selecione o tipo de transação";
    }

    if (exibirTipoCliente && !formData.tipoCliente) {
      newErrors.tipoCliente = "Selecione o tipo de cliente";
    }

    if (exibirCategoria && !formData.categoria) {
      newErrors.categoria = "Selecione a categoria";
    }

    if (exibirSubcategoria && !formData.subcategoria) {
      newErrors.subcategoria = "Selecione a subcategoria";
    }

    if (!formData.descricao?.trim()) {
      newErrors.descricao = "Informe a descrição";
    }

    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      newErrors.valor = "Informe um valor válido";
    }

    if (!formData.dataTransacao) {
      newErrors.dataTransacao = "Informe a data da transação";
    }

    if (!formData.formaPagamento) {
      newErrors.formaPagamento = "Selecione a forma de pagamento";
    }

    // Validações de vínculos
    if (exibirArtista && !formData.artistaVinculado) {
      newErrors.artistaVinculado = "Selecione o artista";
    }

    if (exibirProjeto && projetoObrigatorio && formData.artistaVinculado && !formData.projetoVinculado) {
      newErrors.projetoVinculado = "Selecione o projeto";
    }

    if (exibirEvento && formData.artistaVinculado && !formData.eventoVinculado) {
      newErrors.eventoVinculado = "Selecione o show/evento";
    }

    if (exibirMotivoViagem && !formData.motivoViagem?.trim()) {
      newErrors.motivoViagem = "Informe o motivo da viagem";
    }

    if (exibirNomePublicidade && !formData.nomePublicidade?.trim()) {
      newErrors.nomePublicidade = "Informe o nome da publicidade";
    }

    if (exibirOrgaoArrecadador && !formData.orgaoArrecadador) {
      newErrors.orgaoArrecadador = "Selecione o órgão arrecadador";
    }

    // Validações de parcelamento
    if (exibirParcelamento) {
      if (!formData.quantidadeParcelas || parseInt(formData.quantidadeParcelas) < 2) {
        newErrors.quantidadeParcelas = "Mínimo 2 parcelas";
      }
      if (!formData.dataPrimeiraParcela) {
        newErrors.dataPrimeiraParcela = "Informe a data da primeira parcela";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, exibirTipoCliente, exibirCategoria, exibirSubcategoria, exibirArtista, exibirProjeto, projetoObrigatorio, exibirEvento, exibirMotivoViagem, exibirNomePublicidade, exibirOrgaoArrecadador, exibirParcelamento]);

  // ==================== SUBMIT ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;
    
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsSubmitting(true);

    try {
      // Adiciona motivo da viagem nas observações automaticamente
      let observacaoFinal = formData.observacao || "";
      if (exibirMotivoViagem && formData.motivoViagem) {
        const prefixo = "[MOTIVO VIAGEM]: ";
        if (!observacaoFinal.includes(prefixo)) {
          observacaoFinal = `${prefixo}${formData.motivoViagem}\n${observacaoFinal}`.trim();
        }
      }

      const dadosParaSalvar = {
        ...formData,
        observacao: observacaoFinal,
      };

      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success(mode === "create" ? "Transação criada com sucesso!" : "Transação atualizada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar transação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== HANDLERS ====================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fakeUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        anexoUrl: fakeUrl,
        anexoNome: file.name,
      }));
      toast.success("Arquivo anexado com sucesso!");
    }
  };

  const handleRemoveAnexo = () => {
    setFormData(prev => ({
      ...prev,
      anexoUrl: "",
      anexoNome: "",
    }));
  };

  const updateField = (field: keyof TransacaoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ==================== SEÇÃO: TIPO DE TRANSAÇÃO ==================== */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Tipo de Transação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Transação *</Label>
                  <Select
                    value={formData.tipoTransacao}
                    onValueChange={(value) => updateField("tipoTransacao", value)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={errors.tipoTransacao ? "border-destructive" : ""}>
                      <SelectValue placeholder="Ex: Receita, Despesa, Imposto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposTransacao.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.tipoTransacao} />
                </div>

                {exibirTipoCliente && (
                  <div className="space-y-2">
                    <Label className="text-sm">{getLabelTipoCliente()}</Label>
                    <Select
                      value={formData.tipoCliente}
                      onValueChange={(value) => updateField("tipoCliente", value)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger className={errors.tipoCliente ? "border-destructive" : ""}>
                        <SelectValue placeholder="Ex: Empresa, Artista, Pessoa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(isReceita ? tiposClienteReceita : tiposCliente).map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError error={errors.tipoCliente} />
                  </div>
                )}

                {(isInvestimento || isImposto || isTransferencia) && exibirCategoria && (
                  <div className="space-y-2">
                    <Label className="text-sm">Categoria *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => updateField("categoria", value)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger className={errors.categoria ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError error={errors.categoria} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ==================== SEÇÃO: CATEGORIA E SUBCATEGORIA ==================== */}
          {exibirCategoria && !isInvestimento && !isImposto && !isTransferencia && (
            <Card className="bg-muted/30 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Categoria *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => updateField("categoria", value)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger className={errors.categoria ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError error={errors.categoria} />
                  </div>

                  {exibirSubcategoria && (
                    <div className="space-y-2">
                      <Label className="text-sm">Tipo / Subcategoria *</Label>
                      <Select
                        value={formData.subcategoria}
                        onValueChange={(value) => updateField("subcategoria", value)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className={errors.subcategoria ? "border-destructive" : ""}>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategorias.map((sub) => (
                            <SelectItem key={sub.value} value={sub.value}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.subcategoria} />
                    </div>
                  )}

                  {exibirItemInvestimento && (
                    <div className="space-y-2">
                      <Label className="text-sm">Item *</Label>
                      <Select
                        value={formData.itemInvestimento}
                        onValueChange={(value) => updateField("itemInvestimento", value)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className={errors.itemInvestimento ? "border-destructive" : ""}>
                          <SelectValue placeholder="Selecione o item" />
                        </SelectTrigger>
                        <SelectContent>
                          {itensInvestimento.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.itemInvestimento} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isInvestimento && exibirItemInvestimento && (
            <Card className="bg-muted/30 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Item de Investimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Item *</Label>
                    <Select
                      value={formData.itemInvestimento}
                      onValueChange={(value) => updateField("itemInvestimento", value)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger className={errors.itemInvestimento ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {itensInvestimento.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError error={errors.itemInvestimento} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ==================== SEÇÃO: VINCULAÇÕES ==================== */}
          {(exibirArtista || exibirProjeto || exibirEvento || exibirFornecedor || exibirOrgaoArrecadador || exibirMotivoViagem || exibirNomePublicidade) && (
            <Card className="bg-muted/30 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Vinculações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Órgão Arrecadador (Impostos) */}
                  {exibirOrgaoArrecadador && (
                    <div className="space-y-2">
                      <Label className="text-sm">Órgão Arrecadador *</Label>
                      <Select
                        value={formData.orgaoArrecadador}
                        onValueChange={(value) => updateField("orgaoArrecadador", value)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className={errors.orgaoArrecadador ? "border-destructive" : ""}>
                          <SelectValue placeholder="Ex: Receita Federal, Prefeitura..." />
                        </SelectTrigger>
                        <SelectContent>
                          {orgaosArrecadadores.map((orgao) => (
                            <SelectItem key={orgao.id} value={orgao.id}>
                              {orgao.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.orgaoArrecadador} />
                    </div>
                  )}

                  {/* Fornecedor / Cliente */}
                  {exibirFornecedor && (
                    <div className="space-y-2">
                      <Label className="text-sm">Fornecedor / Cliente</Label>
                      <Select
                        value={formData.fornecedorCliente}
                        onValueChange={(value) => updateField("fornecedorCliente", value)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Buscar no CRM..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Artista Vinculado */}
                  {exibirArtista && (
                    <div className="space-y-2">
                      <Label className="text-sm">Artista Vinculado *</Label>
                      <Select
                        value={formData.artistaVinculado}
                        onValueChange={(value) => updateField("artistaVinculado", value)}
                        disabled={isViewMode}
                      >
                        <SelectTrigger className={errors.artistaVinculado ? "border-destructive" : ""}>
                          <SelectValue placeholder="Selecione o artista" />
                        </SelectTrigger>
                        <SelectContent>
                          {artistas.map((artista) => (
                            <SelectItem key={artista.id} value={artista.id}>
                              {artista.nome_artistico}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.artistaVinculado} />
                    </div>
                  )}

                  {/* Projeto Vinculado */}
                  {exibirProjeto && formData.artistaVinculado && (
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Projeto / Música {projetoObrigatorio ? "*" : "(opcional)"}
                      </Label>
                      <Select
                        value={formData.projetoVinculado}
                        onValueChange={(value) => updateField("projetoVinculado", value)}
                        disabled={isViewMode || projetosFiltrados.length === 0}
                      >
                        <SelectTrigger className={errors.projetoVinculado ? "border-destructive" : ""}>
                          <SelectValue placeholder={projetosFiltrados.length === 0 ? "Nenhum projeto encontrado" : "Selecione o projeto"} />
                        </SelectTrigger>
                        <SelectContent>
                          {projetosFiltrados.map((projeto) => (
                            <SelectItem key={projeto.id} value={projeto.id}>
                              {projeto.titulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.projetoVinculado} />
                    </div>
                  )}

                  {/* Evento / Show */}
                  {exibirEvento && formData.artistaVinculado && (
                    <div className="space-y-2">
                      <Label className="text-sm">Show / Evento *</Label>
                      <Select
                        value={formData.eventoVinculado}
                        onValueChange={(value) => updateField("eventoVinculado", value)}
                        disabled={isViewMode || eventosFiltrados.length === 0}
                      >
                        <SelectTrigger className={errors.eventoVinculado ? "border-destructive" : ""}>
                          <SelectValue placeholder={eventosFiltrados.length === 0 ? "Nenhum evento encontrado" : "Selecione o evento"} />
                        </SelectTrigger>
                        <SelectContent>
                          {eventosFiltrados.map((evento) => (
                            <SelectItem key={evento.id} value={evento.id}>
                              {evento.titulo} ({evento.data_inicio})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError error={errors.eventoVinculado} />
                    </div>
                  )}

                  {/* Motivo da Viagem */}
                  {exibirMotivoViagem && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm">Motivo da Viagem *</Label>
                      <Input
                        value={formData.motivoViagem}
                        onChange={(e) => updateField("motivoViagem", e.target.value)}
                        disabled={isViewMode}
                        placeholder="Ex: Gravação de clipe em São Paulo, Show no festival X..."
                        className={errors.motivoViagem ? "border-destructive" : ""}
                      />
                      <FieldError error={errors.motivoViagem} />
                      <p className="text-xs text-muted-foreground">
                        O motivo será adicionado automaticamente nas observações.
                      </p>
                    </div>
                  )}

                  {/* Nome da Publicidade */}
                  {exibirNomePublicidade && (
                    <div className="space-y-2">
                      <Label className="text-sm">Nome da Publicidade *</Label>
                      <Input
                        value={formData.nomePublicidade}
                        onChange={(e) => updateField("nomePublicidade", e.target.value)}
                        disabled={isViewMode}
                        placeholder="Ex: Campanha Marca X, Comercial TV Y..."
                        className={errors.nomePublicidade ? "border-destructive" : ""}
                      />
                      <FieldError error={errors.nomePublicidade} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ==================== SEÇÃO: VALORES E PAGAMENTO ==================== */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Valores e Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => updateField("valor", e.target.value)}
                    disabled={isViewMode}
                    placeholder="0,00"
                    className={errors.valor ? "border-destructive" : ""}
                  />
                  <FieldError error={errors.valor} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Pagamento</Label>
                  <Select
                    value={formData.tipoPagamento}
                    onValueChange={(value) => updateField("tipoPagamento", value)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposPagamento.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Método de Pagamento *</Label>
                  <Select
                    value={formData.formaPagamento}
                    onValueChange={(value) => updateField("formaPagamento", value)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={errors.formaPagamento ? "border-destructive" : ""}>
                      <SelectValue placeholder="Ex: PIX, Boleto, Cartão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formasPagamento.map((forma) => (
                        <SelectItem key={forma.value} value={forma.value}>
                          {forma.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.formaPagamento} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data da Transação *</Label>
                  <Input
                    type="date"
                    value={formData.dataTransacao}
                    onChange={(e) => updateField("dataTransacao", e.target.value)}
                    disabled={isViewMode}
                    className={errors.dataTransacao ? "border-destructive" : ""}
                  />
                  <FieldError error={errors.dataTransacao} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => updateField("status", value)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusTransacao.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Parcelamento */}
              {exibirParcelamento && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-sm">Quantidade de Parcelas *</Label>
                    <Input
                      type="number"
                      min="2"
                      value={formData.quantidadeParcelas}
                      onChange={(e) => updateField("quantidadeParcelas", e.target.value)}
                      disabled={isViewMode}
                      placeholder="Mínimo 2"
                      className={errors.quantidadeParcelas ? "border-destructive" : ""}
                    />
                    <FieldError error={errors.quantidadeParcelas} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Intervalo</Label>
                    <Select
                      value={formData.intervaloParcelas}
                      onValueChange={(value) => updateField("intervaloParcelas", value)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intervalosParcelas.map((intervalo) => (
                          <SelectItem key={intervalo.value} value={intervalo.value}>
                            {intervalo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Data da 1ª Parcela *</Label>
                    <Input
                      type="date"
                      value={formData.dataPrimeiraParcela}
                      onChange={(e) => updateField("dataPrimeiraParcela", e.target.value)}
                      disabled={isViewMode}
                      className={errors.dataPrimeiraParcela ? "border-destructive" : ""}
                    />
                    <FieldError error={errors.dataPrimeiraParcela} />
                  </div>

                  {valorParcela && (
                    <div className="space-y-2">
                      <Label className="text-sm">Valor por Parcela</Label>
                      <div className="h-10 px-3 py-2 border border-border rounded-md bg-muted/50 flex items-center">
                        <span className="text-sm font-medium">R$ {valorParcela}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ==================== SEÇÃO: DETALHES ==================== */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Descrição *</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => updateField("descricao", e.target.value)}
                  disabled={isViewMode}
                  placeholder="Ex: Pagamento de produção musical para o single 'Nome da Música'"
                  className={errors.descricao ? "border-destructive" : ""}
                />
                <FieldError error={errors.descricao} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Observações</Label>
                <Textarea
                  value={formData.observacao}
                  onChange={(e) => updateField("observacao", e.target.value)}
                  disabled={isViewMode}
                  placeholder="Informações adicionais sobre a transação..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Anexo (Comprovante)</Label>
                {formData.anexoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{formData.anexoNome}</span>
                    {!isViewMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAnexo}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={isViewMode}
                      className="cursor-pointer"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ==================== FOOTER ==================== */}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  mode === "create" ? "Salvar Transação" : "Salvar Alterações"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
