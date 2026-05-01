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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, ChevronDown, X } from "lucide-react";
import {
  useLeads,
  STATUS_LEAD_OPTIONS,
  ORIGEM_LEAD_OPTIONS,
  PRIORIDADE_OPTIONS,
  TIPO_LEAD_OPTIONS,
  SERVICOS_INTERESSE_OPTIONS,
  GENERO_MUSICAL_OPTIONS,
  TIPO_EVENTO_OPTIONS,
  TIPO_PRODUCAO_MUSICAL_OPTIONS,
  TIPO_PRODUCAO_AV_OPTIONS,
  SERVICOS_MARKETING_OPTIONS,
  OBJETIVO_MARKETING_OPTIONS,
  FORMA_PAGAMENTO_OPTIONS,
  TAGS_PREDEFINIDAS,
  ARTISTA_POSSUI_OPTIONS,
  ESTRUTURA_EVENTO_OPTIONS,
  ESTADOS_BR,
  getProbabilidadeForStatus,
} from "@/hooks/useLeads";
import type { Lead } from "@/hooks/useLeads";
import { useLeadInteractions, TIPO_INTERACAO_OPTIONS, TIPO_INTERACAO_LABELS } from "@/hooks/useLeadInteractions";
import { useClientes } from "@/hooks/useClientes";
import { leadSchema, formatZodErrors } from "@/lib/validation-schemas";
import { formatDateTime } from "@/lib/format-utils";
import { maskPhone } from "@/lib/masks";
import { toast } from "sonner";

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  mode: "create" | "edit";
}

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1 pt-2">
      {number}. {title}
    </p>
  );
}

export function LeadFormModal({ open, onOpenChange, lead, mode }: LeadFormModalProps) {
  const { addLead, updateLead } = useLeads();
  const { addCliente } = useClientes();
  const { interactions, isLoading: interactionsLoading, addInteraction } = useLeadInteractions(lead?.id);

  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionTipo, setInteractionTipo] = useState("whatsapp");
  const [interactionDescricao, setInteractionDescricao] = useState("");

  const [nomeContratante, setNomeContratante] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tipoLead, setTipoLead] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  const [origemLead, setOrigemLead] = useState("site");
  const [campanhaMarketing, setCampanhaMarketing] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);
  const [responsavelId, setResponsavelId] = useState("");
  const [statusLead, setStatusLead] = useState("novo");
  const [prioridade, setPrioridade] = useState("media");

  const [servicosInteresse, setServicosInteresse] = useState<string[]>([]);
  const [descricaoDemanda, setDescricaoDemanda] = useState("");

  const [nomeArtistaBanda, setNomeArtistaBanda] = useState("");
  const [generoMusical, setGeneroMusical] = useState("");
  const [cidadeArtista, setCidadeArtista] = useState("");
  const [estadoArtista, setEstadoArtista] = useState("");
  const [qtdIntegrantes, setQtdIntegrantes] = useState<number | "">("");
  const [artistaPossui, setArtistaPossui] = useState<string[]>([]);
  const [linkSpotify, setLinkSpotify] = useState("");
  const [linkYoutube, setLinkYoutube] = useState("");
  const [linkInstagram, setLinkInstagram] = useState("");
  const [linkTiktok, setLinkTiktok] = useState("");
  const [linkSoundcloud, setLinkSoundcloud] = useState("");

  const [nomeEvento, setNomeEvento] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [cidadeEvento, setCidadeEvento] = useState("");
  const [estadoEvento, setEstadoEvento] = useState("");
  const [localEvento, setLocalEvento] = useState("");
  const [capacidadePublico, setCapacidadePublico] = useState<number | "">("");
  const [orcamentoCacheEvento, setOrcamentoCacheEvento] = useState<number | "">("");
  const [estruturaDisponivel, setEstruturaDisponivel] = useState<string[]>([]);
  const [necessidadesAdicionais, setNecessidadesAdicionais] = useState("");

  const [tipoProducaoMusical, setTipoProducaoMusical] = useState("");
  const [qtdMusicas, setQtdMusicas] = useState<number | "">("");
  const [prazoProducaoMusical, setPrazoProducaoMusical] = useState("");
  const [orcamentoProducaoMusical, setOrcamentoProducaoMusical] = useState<number | "">("");

  const [tipoProducaoAV, setTipoProducaoAV] = useState("");
  const [localGravacao, setLocalGravacao] = useState("");
  const [dataPrevistaAV, setDataPrevistaAV] = useState("");
  const [orcamentoAV, setOrcamentoAV] = useState<number | "">("");

  const [servicosMarketing, setServicosMarketing] = useState<string[]>([]);
  const [objetivoMarketing, setObjetivoMarketing] = useState("");

  const [orcamentoEstimado, setOrcamentoEstimado] = useState<number | "">("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [validadeProposta, setValidadeProposta] = useState("");

  const [temperaturaLead, setTemperaturaLead] = useState("morno");
  const [probabilidadeFechamento, setProbabilidadeFechamento] = useState(10);

  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasServico = (s: string) => servicosInteresse.includes(s);
  const showEventoSection = hasServico("show_booking");
  const showProducaoMusicalSection = hasServico("producao_musical");
  const showProducaoAVSection = hasServico("producao_audiovisual");
  const showMarketingSection = hasServico("marketing_musical") || hasServico("design_grafico");
  const showArtistaSection = servicosInteresse.length > 0;

  useEffect(() => {
    if (open && mode === "edit" && lead) {
      setNomeContratante(lead.nome_contratante || "");
      setSobrenome(lead.sobrenome || "");
      setNomeEmpresa(lead.nome_empresa || "");
      setCargo(lead.cargo || "");
      setEmail(lead.email || "");
      setTelefone(lead.telefone || "");
      setInstagramHandle(lead.instagram || "");
      setWebsiteUrl(lead.website || "");
      setTipoLead(lead.tipo_lead || "");
      setSelectedTags(lead.tags || []);
      setCustomTag("");

      setOrigemLead(lead.origem_lead || "site");
      setCampanhaMarketing(lead.campanha_marketing || "");
      setDataEntrada(lead.created_at ? lead.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
      setResponsavelId(lead.responsavel_id || "");
      setStatusLead(lead.status_lead || "novo");
      setPrioridade(lead.prioridade || "media");

      setServicosInteresse(lead.servicos_interesse || []);
      setDescricaoDemanda(lead.descricao_demanda || "");

      setNomeArtistaBanda(lead.nome_artista_banda || "");
      setGeneroMusical(lead.genero_musical || "");
      setCidadeArtista(lead.cidade_artista || "");
      setEstadoArtista(lead.estado_artista || "");

      const meta = (lead.metadata || {}) as Record<string, any>;
      setQtdIntegrantes(meta.qtd_integrantes ?? "");
      setArtistaPossui(meta.artista_possui || []);
      setLinkSpotify(meta.link_spotify || "");
      setLinkYoutube(meta.link_youtube || "");
      setLinkInstagram(meta.link_instagram || "");
      setLinkTiktok(meta.link_tiktok || "");
      setLinkSoundcloud(meta.link_soundcloud || "");

      setNomeEvento(meta.nome_evento || "");
      setTipoEvento(lead.tipo_evento || "");
      setDataEvento(lead.data_evento || "");
      setCidadeEvento(lead.cidade_evento || "");
      setEstadoEvento(lead.estado_evento || "");
      setLocalEvento(lead.nome_local_evento || "");
      setCapacidadePublico(lead.capacidade_publico ?? "");
      setOrcamentoCacheEvento(lead.valor_estimado_cache ?? "");
      setEstruturaDisponivel(meta.estrutura_disponivel || []);
      setNecessidadesAdicionais(meta.necessidades_adicionais || "");

      setTipoProducaoMusical(meta.tipo_producao_musical || "");
      setQtdMusicas(meta.qtd_musicas ?? "");
      setPrazoProducaoMusical(meta.prazo_producao_musical || "");
      setOrcamentoProducaoMusical(meta.orcamento_producao_musical ?? "");

      setTipoProducaoAV(meta.tipo_producao_av || "");
      setLocalGravacao(meta.local_gravacao || "");
      setDataPrevistaAV(meta.data_prevista_av || "");
      setOrcamentoAV(meta.orcamento_av ?? "");

      setServicosMarketing(meta.servicos_marketing || []);
      setObjetivoMarketing(meta.objetivo_marketing || "");

      setOrcamentoEstimado(lead.orcamento_estimado ?? "");
      setFormaPagamento(lead.forma_pagamento || "");
      setValidadeProposta(lead.validade_proposta || "");

      setTemperaturaLead(lead.temperatura_lead || "morno");
      setProbabilidadeFechamento(getProbabilidadeForStatus(lead.status_lead || "novo", lead.probabilidade_fechamento ?? 10));

      setObservacoesInternas(lead.observacoes_internas || "");
      setErrors({});
    } else if (open && mode === "create") {
      setNomeContratante("");
      setSobrenome("");
      setNomeEmpresa("");
      setCargo("");
      setEmail("");
      setTelefone("");
      setInstagramHandle("");
      setWebsiteUrl("");
      setTipoLead("");
      setSelectedTags([]);
      setCustomTag("");
      setOrigemLead("site");
      setCampanhaMarketing("");
      setDataEntrada(new Date().toISOString().split("T")[0]);
      setResponsavelId("");
      setStatusLead("novo");
      setPrioridade("media");
      setServicosInteresse([]);
      setDescricaoDemanda("");
      setNomeArtistaBanda("");
      setGeneroMusical("");
      setCidadeArtista("");
      setEstadoArtista("");
      setQtdIntegrantes("");
      setArtistaPossui([]);
      setLinkSpotify("");
      setLinkYoutube("");
      setLinkInstagram("");
      setLinkTiktok("");
      setLinkSoundcloud("");
      setNomeEvento("");
      setTipoEvento("");
      setDataEvento("");
      setCidadeEvento("");
      setEstadoEvento("");
      setLocalEvento("");
      setCapacidadePublico("");
      setOrcamentoCacheEvento("");
      setEstruturaDisponivel([]);
      setNecessidadesAdicionais("");
      setTipoProducaoMusical("");
      setQtdMusicas("");
      setPrazoProducaoMusical("");
      setOrcamentoProducaoMusical("");
      setTipoProducaoAV("");
      setLocalGravacao("");
      setDataPrevistaAV("");
      setOrcamentoAV("");
      setServicosMarketing([]);
      setObjetivoMarketing("");
      setOrcamentoEstimado("");
      setFormaPagamento("");
      setValidadeProposta("");
      setTemperaturaLead("morno");
      setProbabilidadeFechamento(10);
      setObservacoesInternas("");
      setErrors({});
    }
  }, [open, mode, lead]);

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusLead(newStatus);
    setProbabilidadeFechamento(getProbabilidadeForStatus(newStatus, probabilidadeFechamento));
    clearError("status_lead");
  };

  const toggleServico = (value: string) => {
    setServicosInteresse(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags(prev => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const toggleCheckbox = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  const previousStatus = lead?.status_lead;
  const wasAlreadyApproved = previousStatus === "confirmado" || previousStatus === "fechado";
  const isNewApproval = (status: string) =>
    (status === "confirmado" || status === "fechado") && !wasAlreadyApproved;

  const createClienteFromLead = () => {
    const nomeCompleto = [nomeContratante.trim(), sobrenome.trim()].filter(Boolean).join(" ");
    addCliente.mutate({
      nome: nomeCompleto,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      tipo_pessoa: "pessoa_fisica",
      status: "ativo",
      cidade: cidadeArtista.trim() || cidadeEvento.trim() || null,
      estado: estadoArtista || estadoEvento || null,
      responsavel: nomeEmpresa.trim() || null,
      observacoes: `Convertido do lead: ${nomeCompleto}`,
    } as any, {
      onSuccess: () => {
        toast.success("Cliente registrado no CRM automaticamente!");
      },
      onError: () => {
        toast.error("Erro ao registrar cliente no CRM. Faça o cadastro manualmente.");
      },
    });
  };

  const handleSubmit = () => {
    const metadata: Record<string, unknown> = {};

    if (qtdIntegrantes !== "") metadata.qtd_integrantes = Number(qtdIntegrantes);
    if (artistaPossui.length > 0) metadata.artista_possui = artistaPossui;
    if (linkSpotify) metadata.link_spotify = linkSpotify;
    if (linkYoutube) metadata.link_youtube = linkYoutube;
    if (linkInstagram) metadata.link_instagram = linkInstagram;
    if (linkTiktok) metadata.link_tiktok = linkTiktok;
    if (linkSoundcloud) metadata.link_soundcloud = linkSoundcloud;

    if (showEventoSection) {
      if (nomeEvento) metadata.nome_evento = nomeEvento;
      if (estruturaDisponivel.length > 0) metadata.estrutura_disponivel = estruturaDisponivel;
      if (necessidadesAdicionais) metadata.necessidades_adicionais = necessidadesAdicionais;
    }

    if (showProducaoMusicalSection) {
      if (tipoProducaoMusical) metadata.tipo_producao_musical = tipoProducaoMusical;
      if (qtdMusicas !== "") metadata.qtd_musicas = Number(qtdMusicas);
      if (prazoProducaoMusical) metadata.prazo_producao_musical = prazoProducaoMusical;
      if (orcamentoProducaoMusical !== "") metadata.orcamento_producao_musical = Number(orcamentoProducaoMusical);
    }

    if (showProducaoAVSection) {
      if (tipoProducaoAV) metadata.tipo_producao_av = tipoProducaoAV;
      if (localGravacao) metadata.local_gravacao = localGravacao;
      if (dataPrevistaAV) metadata.data_prevista_av = dataPrevistaAV;
      if (orcamentoAV !== "") metadata.orcamento_av = Number(orcamentoAV);
    }

    if (showMarketingSection) {
      if (servicosMarketing.length > 0) metadata.servicos_marketing = servicosMarketing;
      if (objetivoMarketing) metadata.objetivo_marketing = objetivoMarketing;
    }

    const leadData = {
      nome_contratante: nomeContratante.trim(),
      sobrenome: sobrenome.trim() || null,
      telefone: telefone.trim(),
      email: email.trim() || null,
      nome_empresa: nomeEmpresa.trim() || null,
      documento: null,
      cargo: cargo.trim() || null,
      instagram: instagramHandle.trim() || null,
      website: websiteUrl.trim() || null,
      tipo_lead: tipoLead || null,

      origem_lead: origemLead,
      campanha_marketing: campanhaMarketing.trim() || null,
      responsavel_id: responsavelId || null,
      status_lead: statusLead,
      prioridade,

      servicos_interesse: servicosInteresse.length > 0 ? servicosInteresse : null,
      descricao_demanda: descricaoDemanda.trim() || null,

      nome_artista_banda: nomeArtistaBanda.trim() || null,
      genero_musical: generoMusical || null,
      cidade_artista: cidadeArtista.trim() || null,
      estado_artista: estadoArtista || null,
      artista_interesse: nomeArtistaBanda.trim() || null,

      tipo_evento: tipoEvento || null,
      data_evento: dataEvento || null,
      cidade_evento: cidadeEvento.trim() || null,
      estado_evento: estadoEvento || null,
      nome_local_evento: localEvento.trim() || null,
      endereco_evento: null,
      capacidade_publico: capacidadePublico !== "" ? Number(capacidadePublico) : null,

      orcamento_estimado: orcamentoEstimado !== "" ? Number(orcamentoEstimado) : null,
      valor_estimado_cache: orcamentoCacheEvento !== "" ? Number(orcamentoCacheEvento) : null,
      forma_pagamento: formaPagamento || null,
      validade_proposta: validadeProposta || null,

      temperatura_lead: temperaturaLead || null,
      probabilidade_fechamento: probabilidadeFechamento,
      comissao_percentual: null,
      tipo_contrato: null,
      data_limite_retorno: null,

      observacoes_internas: observacoesInternas.trim() || null,
      tags: selectedTags.length > 0 ? selectedTags : null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };

    const result = leadSchema.safeParse(leadData);
    if (!result.success) {
      setErrors(formatZodErrors(result.error));
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    const shouldCreateCliente = isNewApproval(statusLead) || (mode === "create" && (statusLead === "confirmado" || statusLead === "fechado"));

    if (mode === "create") {
      addLead.mutate(leadData as any, {
        onSuccess: () => {
          if (shouldCreateCliente) createClienteFromLead();
        },
      });
    } else if (lead) {
      updateLead.mutate({ id: lead.id, ...leadData } as any, {
        onSuccess: () => {
          if (shouldCreateCliente) createClienteFromLead();
        },
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="lead-form-modal">
        <DialogHeader>
          <DialogTitle data-testid="lead-form-title">
            {mode === "create" ? "Novo Lead" : "Editar Lead"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre um novo lead para gerar negócios"
              : "Edite os dados do lead"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* ========== SECTION 1: IDENTIFICAÇÃO ========== */}
          <SectionHeader number={1} title="Identificação do Lead" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Contato *</Label>
              <Input
                placeholder="Nome da pessoa responsável"
                value={nomeContratante}
                onChange={(e) => { setNomeContratante(e.target.value); clearError("nome_contratante"); }}
                className={errors.nome_contratante ? "border-destructive" : ""}
                data-testid="input-nome-contratante"
              />
              {errors.nome_contratante && <p className="text-sm text-destructive">{errors.nome_contratante}</p>}
            </div>
            <div className="space-y-2">
              <Label>Sobrenome</Label>
              <Input
                placeholder="Sobrenome"
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                data-testid="input-sobrenome"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa / Contratante</Label>
              <Input
                placeholder="Nome da empresa ou contratante"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                data-testid="input-nome-empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Função</Label>
              <Input
                placeholder="Ex: produtor, empresário, promoter"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                data-testid="input-cargo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                className={errors.email ? "border-destructive" : ""}
                data-testid="input-email"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp *</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => { setTelefone(maskPhone(e.target.value)); clearError("telefone"); }}
                className={errors.telefone ? "border-destructive" : ""}
                data-testid="input-telefone"
              />
              {errors.telefone && <p className="text-sm text-destructive">{errors.telefone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                placeholder="@usuario"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                data-testid="input-instagram"
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                data-testid="input-website"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Lead *</Label>
            <Select value={tipoLead} onValueChange={(v) => setTipoLead(v)}>
              <SelectTrigger data-testid="select-tipo-lead">
                <SelectValue placeholder="Selecione o tipo de lead" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_LEAD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {TAGS_PREDEFINIDAS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleTag(tag)}
                  data-testid={`tag-${tag.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Adicionar tag personalizada"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                className="flex-1"
                data-testid="input-custom-tag"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomTag} data-testid="button-add-tag">
                Adicionar
              </Button>
            </div>
            {selectedTags.filter(t => !TAGS_PREDEFINIDAS.includes(t as any)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedTags.filter(t => !TAGS_PREDEFINIDAS.includes(t as any)).map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => toggleTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ========== SECTION 2: ORIGEM DO LEAD ========== */}
          <SectionHeader number={2} title="Origem do Lead" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origem do Lead *</Label>
              <Select value={origemLead} onValueChange={(v) => { setOrigemLead(v); clearError("origem_lead"); }}>
                <SelectTrigger className={errors.origem_lead ? "border-destructive" : ""} data-testid="select-origem-lead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGEM_LEAD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.origem_lead && <p className="text-sm text-destructive">{errors.origem_lead}</p>}
            </div>
            <div className="space-y-2">
              <Label>Campanha de Marketing</Label>
              <Input
                placeholder="Nome da campanha que gerou o lead"
                value={campanhaMarketing}
                onChange={(e) => setCampanhaMarketing(e.target.value)}
                data-testid="input-campanha-marketing"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data de Entrada</Label>
              <Input
                type="date"
                value={dataEntrada}
                disabled
                className="opacity-70"
                data-testid="input-data-entrada"
              />
              <p className="text-xs text-muted-foreground">Definida automaticamente</p>
            </div>
            <div className="space-y-2">
              <Label>Status do Lead</Label>
              <Select value={statusLead} onValueChange={handleStatusChange}>
                <SelectTrigger data-testid="select-status-lead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_LEAD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v)}>
                <SelectTrigger data-testid="select-prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável pelo Lead</Label>
            <Input
              placeholder="Nome do responsável no sistema"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              data-testid="input-responsavel"
            />
          </div>

          {/* ========== SECTION 3: SERVIÇO DE INTERESSE ========== */}
          <SectionHeader number={3} title="Serviço de Interesse" />

          <div className="space-y-2">
            <Label>Tipo de Serviço *</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                  data-testid="dropdown-servicos-interesse"
                >
                  {servicosInteresse.length === 0
                    ? "Selecione os serviços"
                    : `${servicosInteresse.length} serviço${servicosInteresse.length > 1 ? "s" : ""} selecionado${servicosInteresse.length > 1 ? "s" : ""}`}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 max-h-64 overflow-y-auto" align="start">
                {SERVICOS_INTERESSE_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={servicosInteresse.includes(opt.value)}
                    onCheckedChange={() => toggleServico(opt.value)}
                    onSelect={(e) => e.preventDefault()}
                    data-testid={`dropdown-item-servico-${opt.value}`}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {servicosInteresse.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {servicosInteresse.map((s) => {
                  const label = SERVICOS_INTERESSE_OPTIONS.find((o) => o.value === s)?.label || s;
                  return (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => toggleServico(s)}
                      data-testid={`badge-servico-${s}`}
                    >
                      {label}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descrição da Demanda</Label>
            <Textarea
              placeholder="Explique o que o lead precisa..."
              value={descricaoDemanda}
              onChange={(e) => setDescricaoDemanda(e.target.value)}
              data-testid="textarea-descricao-demanda"
            />
          </div>

          {/* ========== SECTION 4: INFORMAÇÕES DO ARTISTA ========== */}
          {showArtistaSection && (
            <>
              <SectionHeader number={4} title="Informações do Artista" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Artista / Banda</Label>
                  <Input
                    placeholder="Nome artístico"
                    value={nomeArtistaBanda}
                    onChange={(e) => setNomeArtistaBanda(e.target.value)}
                    data-testid="input-nome-artista-banda"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gênero Musical</Label>
                  <Select value={generoMusical} onValueChange={(v) => setGeneroMusical(v)}>
                    <SelectTrigger data-testid="select-genero-musical">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERO_MUSICAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade do Artista</Label>
                  <Input
                    placeholder="Cidade"
                    value={cidadeArtista}
                    onChange={(e) => setCidadeArtista(e.target.value)}
                    data-testid="input-cidade-artista"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={estadoArtista} onValueChange={(v) => setEstadoArtista(v)}>
                    <SelectTrigger data-testid="select-estado-artista">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Integrantes</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 4"
                    value={qtdIntegrantes}
                    onChange={(e) => setQtdIntegrantes(e.target.value ? Number(e.target.value) : "")}
                    data-testid="input-qtd-integrantes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Artista já possui:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ARTISTA_POSSUI_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`possui-${opt.value}`}
                        checked={artistaPossui.includes(opt.value)}
                        onCheckedChange={() => toggleCheckbox(artistaPossui, setArtistaPossui, opt.value)}
                        data-testid={`checkbox-possui-${opt.value}`}
                      />
                      <label htmlFor={`possui-${opt.value}`} className="text-sm cursor-pointer">
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Links do Artista</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Spotify URL" value={linkSpotify} onChange={(e) => setLinkSpotify(e.target.value)} data-testid="input-link-spotify" />
                  <Input placeholder="YouTube URL" value={linkYoutube} onChange={(e) => setLinkYoutube(e.target.value)} data-testid="input-link-youtube" />
                  <Input placeholder="Instagram URL" value={linkInstagram} onChange={(e) => setLinkInstagram(e.target.value)} data-testid="input-link-instagram" />
                  <Input placeholder="TikTok URL" value={linkTiktok} onChange={(e) => setLinkTiktok(e.target.value)} data-testid="input-link-tiktok" />
                  <Input placeholder="SoundCloud URL" value={linkSoundcloud} onChange={(e) => setLinkSoundcloud(e.target.value)} data-testid="input-link-soundcloud" />
                </div>
              </div>
            </>
          )}

          {/* ========== SECTION 5: INFORMAÇÕES DO EVENTO ========== */}
          {showEventoSection && (
            <>
              <SectionHeader number={5} title="Informações do Evento" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Evento</Label>
                  <Input
                    placeholder="Nome do evento"
                    value={nomeEvento}
                    onChange={(e) => setNomeEvento(e.target.value)}
                    data-testid="input-nome-evento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Evento</Label>
                  <Select value={tipoEvento} onValueChange={(v) => setTipoEvento(v)}>
                    <SelectTrigger data-testid="select-tipo-evento">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_EVENTO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data do Evento</Label>
                  <Input
                    type="date"
                    value={dataEvento}
                    onChange={(e) => setDataEvento(e.target.value)}
                    data-testid="input-data-evento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    placeholder="Cidade"
                    value={cidadeEvento}
                    onChange={(e) => setCidadeEvento(e.target.value)}
                    data-testid="input-cidade-evento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={estadoEvento} onValueChange={(v) => setEstadoEvento(v)}>
                    <SelectTrigger data-testid="select-estado-evento">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local do Evento</Label>
                  <Input
                    placeholder="Nome do local / venue"
                    value={localEvento}
                    onChange={(e) => setLocalEvento(e.target.value)}
                    data-testid="input-local-evento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacidade de Público</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ex: 5000"
                    value={capacidadePublico}
                    onChange={(e) => setCapacidadePublico(e.target.value ? Number(e.target.value) : "")}
                    data-testid="input-capacidade-publico"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Orçamento para Cachê (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={orcamentoCacheEvento}
                  onChange={(e) => setOrcamentoCacheEvento(e.target.value ? Number(e.target.value) : "")}
                  data-testid="input-orcamento-cache"
                />
              </div>

              <div className="space-y-2">
                <Label>Estrutura Disponível</Label>
                <div className="flex flex-wrap gap-4">
                  {ESTRUTURA_EVENTO_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`estrutura-${opt.value}`}
                        checked={estruturaDisponivel.includes(opt.value)}
                        onCheckedChange={() => toggleCheckbox(estruturaDisponivel, setEstruturaDisponivel, opt.value)}
                        data-testid={`checkbox-estrutura-${opt.value}`}
                      />
                      <label htmlFor={`estrutura-${opt.value}`} className="text-sm cursor-pointer">
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Necessidades Adicionais</Label>
                <Textarea
                  placeholder="Descreva necessidades extras..."
                  value={necessidadesAdicionais}
                  onChange={(e) => setNecessidadesAdicionais(e.target.value)}
                  data-testid="textarea-necessidades-adicionais"
                />
              </div>
            </>
          )}

          {/* ========== SECTION 6: PRODUÇÃO MUSICAL ========== */}
          {showProducaoMusicalSection && (
            <>
              <SectionHeader number={6} title="Produção Musical" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Produção</Label>
                  <Select value={tipoProducaoMusical} onValueChange={(v) => setTipoProducaoMusical(v)}>
                    <SelectTrigger data-testid="select-tipo-producao-musical">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_PRODUCAO_MUSICAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de Músicas</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={qtdMusicas}
                    onChange={(e) => setQtdMusicas(e.target.value ? Number(e.target.value) : "")}
                    data-testid="input-qtd-musicas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo Desejado</Label>
                  <Input
                    type="date"
                    value={prazoProducaoMusical}
                    onChange={(e) => setPrazoProducaoMusical(e.target.value)}
                    data-testid="input-prazo-producao-musical"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Orçamento Estimado (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={orcamentoProducaoMusical}
                    onChange={(e) => setOrcamentoProducaoMusical(e.target.value ? Number(e.target.value) : "")}
                    data-testid="input-orcamento-producao-musical"
                  />
                </div>
              </div>
            </>
          )}

          {/* ========== SECTION 7: PRODUÇÃO AUDIOVISUAL ========== */}
          {showProducaoAVSection && (
            <>
              <SectionHeader number={7} title="Produção Audiovisual" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Produção</Label>
                  <Select value={tipoProducaoAV} onValueChange={(v) => setTipoProducaoAV(v)}>
                    <SelectTrigger data-testid="select-tipo-producao-av">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_PRODUCAO_AV_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Local de Gravação</Label>
                  <Input
                    placeholder="Local de gravação"
                    value={localGravacao}
                    onChange={(e) => setLocalGravacao(e.target.value)}
                    data-testid="input-local-gravacao"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Prevista</Label>
                  <Input
                    type="date"
                    value={dataPrevistaAV}
                    onChange={(e) => setDataPrevistaAV(e.target.value)}
                    data-testid="input-data-prevista-av"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Orçamento (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={orcamentoAV}
                    onChange={(e) => setOrcamentoAV(e.target.value ? Number(e.target.value) : "")}
                    data-testid="input-orcamento-av"
                  />
                </div>
              </div>
            </>
          )}

          {/* ========== SECTION 8: MARKETING E DESIGN ========== */}
          {showMarketingSection && (
            <>
              <SectionHeader number={8} title="Marketing e Design" />

              <div className="space-y-2">
                <Label>Serviços Desejados</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICOS_MARKETING_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`mkt-${opt.value}`}
                        checked={servicosMarketing.includes(opt.value)}
                        onCheckedChange={() => toggleCheckbox(servicosMarketing, setServicosMarketing, opt.value)}
                        data-testid={`checkbox-mkt-${opt.value}`}
                      />
                      <label htmlFor={`mkt-${opt.value}`} className="text-sm cursor-pointer">
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Objetivo do Marketing</Label>
                <Select value={objetivoMarketing} onValueChange={(v) => setObjetivoMarketing(v)}>
                  <SelectTrigger data-testid="select-objetivo-marketing">
                    <SelectValue placeholder="Selecione o objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {OBJETIVO_MARKETING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* ========== SECTION 9: INFORMAÇÕES FINANCEIRAS ========== */}
          <SectionHeader number={9} title="Informações Financeiras" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Orçamento Estimado (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={orcamentoEstimado}
                onChange={(e) => setOrcamentoEstimado(e.target.value ? Number(e.target.value) : "")}
                data-testid="input-orcamento-estimado"
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v)}>
                <SelectTrigger data-testid="select-forma-pagamento">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FORMA_PAGAMENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Validade da Proposta</Label>
              <Input
                type="date"
                value={validadeProposta}
                onChange={(e) => setValidadeProposta(e.target.value)}
                data-testid="input-validade-proposta"
              />
            </div>
          </div>

          {/* ========== SECTION 10: HISTÓRICO DE INTERAÇÕES ========== */}
          <SectionHeader number={10} title="Histórico de Interações" />

          {mode === "edit" && lead?.id ? (
            <div className="space-y-3">
              {!showInteractionForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInteractionForm(true)}
                  data-testid="button-add-interaction"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Registrar Interação
                </Button>
              ) : (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="space-y-2">
                    <Label>Tipo de Interação</Label>
                    <Select value={interactionTipo} onValueChange={(v) => setInteractionTipo(v)}>
                      <SelectTrigger data-testid="select-interaction-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_INTERACAO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      placeholder="Resumo da conversa, próximos passos..."
                      value={interactionDescricao}
                      onChange={(e) => setInteractionDescricao(e.target.value)}
                      data-testid="textarea-interaction-descricao"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!interactionDescricao.trim() || addInteraction.isPending}
                      onClick={() => {
                        addInteraction.mutate({
                          lead_id: lead.id,
                          tipo_interacao: interactionTipo,
                          descricao: interactionDescricao.trim(),
                        } as any, {
                          onSuccess: () => {
                            setInteractionDescricao("");
                            setInteractionTipo("whatsapp");
                            setShowInteractionForm(false);
                          },
                          onError: () => {
                            toast.error("Erro ao registrar interação. Tente novamente.");
                          },
                        });
                      }}
                      data-testid="button-save-interaction"
                    >
                      {addInteraction.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowInteractionForm(false); setInteractionDescricao(""); }}
                      data-testid="button-cancel-interaction"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {interactionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando interações...
                </div>
              ) : !interactions || interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma interação registrada.</p>
              ) : (
                <div className="space-y-2 border-l-2 border-muted pl-4 max-h-48 overflow-y-auto">
                  {interactions.map((inter: any) => (
                    <div key={inter.id} className="relative pb-2" data-testid={`interaction-${inter.id}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs">
                          {TIPO_INTERACAO_LABELS[inter.tipo_interacao] || inter.tipo_interacao}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(inter.data_interacao)}
                        </span>
                      </div>
                      {inter.descricao && (
                        <p className="text-sm text-foreground">{inter.descricao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              O histórico de interações ficará disponível após criar o lead.
            </p>
          )}

          {/* ========== OBSERVAÇÕES ========== */}
          <div className="space-y-2">
            <Label>Observações Internas</Label>
            <Textarea
              placeholder="Notas internas sobre o lead..."
              value={observacoesInternas}
              onChange={(e) => setObservacoesInternas(e.target.value)}
              data-testid="textarea-observacoes"
            />
          </div>

          {/* Info box */}
          {mode === "create" && (statusLead === "fechado" || statusLead === "confirmado") && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Ao confirmar:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Lead será registrado como {statusLead === "fechado" ? "fechado" : "confirmado"}</li>
                <li>Cliente será registrado automaticamente no CRM</li>
                <li>Probabilidade será definida como 100%</li>
                {showEventoSection && <li>Evento será adicionado à Agenda</li>}
                <li>Poderá ser convertido em contrato</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-lead">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={addLead.isPending || updateLead.isPending} data-testid="button-submit-lead">
            {mode === "create" ? "Criar Lead" : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
