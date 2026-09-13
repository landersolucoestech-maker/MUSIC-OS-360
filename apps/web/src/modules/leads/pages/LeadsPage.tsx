import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { Download, GitBranch, Plus, Users } from "lucide-react";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import { MetricCard } from "@/shared/components/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { LeadFilters } from "../components";
import { useLeads } from "../hooks";
import { useLeadFiltersStore } from "../store";
import { LeadFormModal, type Interacao, type LeadFormPayload } from "../modals/LeadFormModal";
import { LeadViewModal } from "../modals/LeadViewModal";
import { LeadsTable } from "../tables/LeadsTable";
import type { Lead, LeadClientType, LeadServiceType } from "../types";
import { ContatosPanel } from "@/modules/crm-relationships/components/ContatosPanel";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { ContatoFormModal, type ContatoFormPayload } from "@/modules/crm-relationships/modals/ContatoFormModal";

// ─────────────────────────────────────────────
// Combos condicionais
// ─────────────────────────────────────────────
const EVENTO_COMBOS: ReadonlyArray<{ type: string; servico: string }> = [
  { type: "marca_empresa",        servico: "eventos_corporativos" },
  { type: "agencia",              servico: "producao_eventos"     },
  { type: "agencia",              servico: "contratacao_artistas" },
  { type: "produtora_eventos",    servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "eventos_corporativos" },
  { type: "empresario_artistico", servico: "contratacao_artistas" },
  { type: "empresario_artistico", servico: "eventos_corporativos" },
  { type: "influenciador",        servico: "producao_eventos"     },
];

const CAMPANHA_COMBOS: ReadonlyArray<{ type: string; servico: string }> = [
  { type: "marca_empresa", servico: "campanhas_artistas" },
  { type: "agencia",       servico: "campanhas_artistas" },
];

const matchCombo = (
  list: ReadonlyArray<{ type: string; servico: string }>,
  type: string,
  servico: string,
) => list.some((c) => c.type === type && c.servico === servico);

// ─────────────────────────────────────────────
// Mapeamentos
// ─────────────────────────────────────────────
const TIPO_LEAD_TO_CLIENT: Record<string, LeadClientType> = {
  artista_banda:        "artist",
  contratante_show:     "eventProducer",
  marca_empresa:        "brand",
  produtora_eventos:    "eventProducer",
  gravadora_selo:       "label",
  empresario_artistico: "agency",
  editora_musical:      "label",
  agencia:              "agency",
  influenciador:        "creator",
  outros:               "other",
};

const SERVICO_TO_TIPO_SERVICO: Record<string, LeadServiceType> = {
  agenciamento_gestao:       "gestaoArtistica",
  producao_musical:          "producaoMusical",
  edicao_musical:            "mixagem",
  distribuicao_digital:      "distribuicaoDigital",
  marketing_digital:         "marketingMusical",
  marketing_influencia:      "marketingMusical",
  producao_audiovisual:      "videoclipe",
  producao_eventos:          "producaoEvento",
  contratacao_artistas:      "producaoEvento",
  eventos_corporativos:      "producaoEvento",
  campanhas_artistas:        "marketingMusical",
  licenciamento_musical:     "licenciamento",
  gestao_imagem:             "gestaoArtistica",
  estrategia_carreira:       "gestaoArtistica",
  divulgacao_eventos:        "producaoEvento",
  administracao_editorial:   "registroAutoral",
  registro_obras:            "registroAutoral",
  arrecadacao_autoral:       "registroAutoral",
  sincronizacao:             "licenciamento",
  gestao_catalogo:           "registroAutoral",
  influenciadores:           "marketingMusical",
  parcerias_comerciais:      "consultoria",
  parcerias:                 "consultoria",
  projetos_especiais:        "consultoria",
  atendimento_personalizado: "consultoria",
  criacao_sites:             "desenvolvimentoSite",
  consultoria:               "consultoria",
};

// ─────────────────────────────────────────────
// payloadToLead
// ─────────────────────────────────────────────
function payloadToLead(
  payload: LeadFormPayload,
): Omit<Lead, "id" | "createdAt" | "updatedAt" | "historicoInteracoes"> {
  const tipoCliente = TIPO_LEAD_TO_CLIENT[payload.tipo_lead]   ?? "other";
  const tipoServico = SERVICO_TO_TIPO_SERVICO[payload.servico] ?? "consultoria";

  // CORRIGIDO: cada bloco condicional é espalhado individualmente para não perder dados.
  // O operador ?? encadeado anterior descartava todos os blocos exceto o primeiro não-undefined.
  const condicional =
    payload.evento        ??
    payload.campanha      ??
    payload.influenciador ??
    payload.empresario    ??
    {};

  return {
    nomeCompleto:  payload.nome,
    nomeArtistico:
      payload.evento?.nome_artista_banda     ??
      payload.campanha?.nome_artista_banda   ??
      payload.empresario?.nome_artista_banda ??
      "",
    empresa:   payload.empresa,
    email:     payload.email,
    whatsapp:  payload.telefone,
    instagram: payload.instagram,
    cidade:    payload.cidade,
    estado:    payload.estado,
    pais:      "Brasil",
    tipoCliente,
    tipoServico,
    payloadServico: {
      tipo_lead:            payload.tipo_lead,
      servico:              payload.servico,
      nome_artista_servico: payload.nome_artista_servico,
      descricao:            payload.descricao,
      cargo:                payload.cargo,
      website:              payload.website,
      endereco:             payload.endereco,
      data_entrada:         payload.data_entrada,
      responsavel:          payload.responsavel,
      interacoes:           payload.interacoes,
      ...condicional,
    },
    dadosInternosCRM: {
      statusLead:          payload.status_lead,
      prioridade:          payload.prioridade,
      origemLead:          payload.origem_lead,
      responsavel:         payload.responsavel,
      campanha_marketing:  payload.campanha_marketing,
      proximoFollowUp:     payload.proximo_follow_up || undefined,
      valorEstimado:       payload.valor_estimado ? Number(payload.valor_estimado) : undefined,
      temperatura:         payload.temperatura || undefined,
    },
    uploads: payload.uploads ?? [],
  };
}

// ─────────────────────────────────────────────
// leadToFormInitial
// ─────────────────────────────────────────────
function leadToFormInitial(lead: Lead): Partial<LeadFormPayload> {
  const ps  = (lead.payloadServico   ?? {}) as Record<string, unknown>;
  const crm = (lead.dadosInternosCRM ?? {}) as Record<string, unknown>;

  const str = (k: string): string =>
    typeof ps[k] === "string" ? (ps[k] as string) : "";

  const tipoLead = str("tipo_lead");
  const servico  = str("servico");

  const isEvento        = matchCombo(EVENTO_COMBOS,   tipoLead, servico);
  const isCampanha      = matchCombo(CAMPANHA_COMBOS, tipoLead, servico);
  const isInfluenciador = tipoLead === "influenciador"        && !isEvento;
  const isEmpresario    = tipoLead === "empresario_artistico" && !isEvento;

  return {
    nome:                 lead.nomeCompleto,
    empresa:              lead.empresa   ?? "",
    email:                lead.email     ?? "",
    telefone:             lead.whatsapp  ?? "",
    instagram:            lead.instagram ?? "",
    cidade:               lead.cidade    ?? "",
    estado:               lead.estado    ?? "",
    cargo:                str("cargo"),
    website:              str("website"),
    endereco:             str("endereco"),
    data_entrada:         str("data_entrada"),
    responsavel:          str("responsavel"),
    tipo_lead:            tipoLead as LeadFormPayload["tipo_lead"],
    servico,
    nome_artista_servico: str("nome_artista_servico"),
    descricao:            str("descricao"),
    origem_lead:          (crm.origemLead         as string) ?? "",
    status_lead:          (crm.statusLead         as string) ?? "new",
    prioridade:           (crm.prioridade         as string) ?? "media",
    campanha_marketing:   (crm.campanha_marketing as string) ?? "",
    proximo_follow_up:    (crm.proximoFollowUp    as string) ?? "",
    valor_estimado:       crm.valorEstimado != null ? String(crm.valorEstimado) : "",
    temperatura:          (crm.temperatura        as string) ?? "",
    interacoes: Array.isArray(ps.interacoes)
      ? (ps.interacoes as Interacao[])
      : [],
    uploads: lead.uploads ?? [],
    evento: isEvento ? {
      nome_evento:             str("nome_evento"),
      tipo_evento:             str("tipo_evento"),
      data_evento:             str("data_evento"),
      local_evento:            str("local_evento"),
      cidade:                  str("cidade"),
      estado:                  str("estado"),
      capacidade_publico:      str("capacidade_publico"),
      nome_artista_banda:      str("nome_artista_banda"),
      necessidades_adicionais: str("necessidades_adicionais"),
    } : undefined,
    campanha: isCampanha ? {
      nome_campanha:           str("nome_campanha"),
      tipo_campanha:           str("tipo_campanha"),
      start_date:             str("start_date"),
      end_date:                str("end_date"),
      cidade:                  str("cidade"),
      estado:                  str("estado"),
      nome_artista_banda:      str("nome_artista_banda"),
      necessidades_adicionais: str("necessidades_adicionais"),
    } : undefined,
    influenciador: isInfluenciador ? {
      nome_campanha:           str("nome_campanha"),
      tipo_campanha:           str("tipo_campanha"),
      local_campanha:          str("local_campanha"),
      data:                    str("data"),
      cidade:                  str("cidade"),
      estado:                  str("estado"),
      necessidades_adicionais: str("necessidades_adicionais"),
    } : undefined,
    empresario: isEmpresario ? {
      nome_artista_banda:      str("nome_artista_banda"),
      necessidades_adicionais: str("necessidades_adicionais"),
    } : undefined,
  };
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────
export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, metrics, createLead, updateLead, deleteLead } = useLeads();
  const { contacts, createContact }                            = useContacts();
  const { filters, setFilters }                                = useLeadFiltersStore();

  const [modalOpen,        setModalOpen]        = useState(false);
  const [editingLead,      setEditingLead]      = useState<Lead | null>(null);
  const [viewLead,         setViewLead]         = useState<Lead | null>(null);
  const [contatoModalOpen, setContatoModalOpen] = useState(false);
  const [activeTab,        setActiveTab]        = useState<"contatos" | "leads">("contatos");

  const responsaveis = useMemo(
    () => Array.from(
      new Set(leads.map((l) => l.dadosInternosCRM.responsavel).filter(Boolean)),
    ) as string[],
    [leads],
  );

  const origens = useMemo(
    () => Array.from(
      new Set(leads.map((l) => l.dadosInternosCRM.origemLead).filter(Boolean)),
    ) as string[],
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const search = filters.search.toLowerCase();
    return leads.filter((lead) => {
      const values = [
        lead.nomeCompleto, lead.nomeArtistico, lead.empresa,
        lead.email, lead.whatsapp, lead.instagram,
      ].join(" ").toLowerCase();
      return (
        (!search || values.includes(search))                                                           &&
        (filters.tipoServico === "all" || lead.tipoServico                  === filters.tipoServico)   &&
        (filters.statusLead  === "all" || lead.dadosInternosCRM.statusLead  === filters.statusLead)    &&
        (filters.responsavel === "all" || lead.dadosInternosCRM.responsavel === filters.responsavel)   &&
        (filters.origemLead  === "all" || lead.dadosInternosCRM.origemLead  === filters.origemLead)    &&
        (filters.temperatura === "all" || lead.dadosInternosCRM.temperatura === filters.temperatura)
      );
    });
  }, [filters, leads]);

  const contatosKpis = useMemo(() => {
    const countBy = (types: string[]) =>
      contacts.filter((c) => types.includes(c.contactType)).length;
    return {
      total:        contacts.length,
      clientes:     countBy(["CORPORATE_CLIENT"]),
      parceiros:    countBy(["PARTNER"]),
      fornecedores: countBy(["SUPPLIER"]),
      prestadores:  countBy(["SERVICE_PROVIDER"]),
    };
  }, [contacts]);

  function openCreate() {
    setEditingLead(null);
    setModalOpen(true);
  }

  // Exportação real do CRM: reaproveita a Central de Relatórios (dados
  // completos do tenant, RBAC, tenant isolation, formula injection mitigada —
  // ver Parte 79). Nenhuma implementação client-side paralela.
  const exportButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => navigate("/relatorios")}
      title="Exporta pela Central de Relatórios (dados completos do tenant)"
      data-testid="button-exportar-crm"
    >
      <Download className="mr-1 h-4 w-4" />
      Exportar
    </Button>
  );

  const topbarActions = (
    <div className="flex items-center gap-2">
      {exportButton}
      {activeTab === "leads" ? (
        <Button size="sm" onClick={openCreate} data-testid="button-novo-lead">
          <Plus className="mr-1 h-4 w-4" />
          Novo Lead
        </Button>
      ) : (
        <Button size="sm" onClick={() => setContatoModalOpen(true)} data-testid="button-novo-contato">
          <Plus className="mr-1 h-4 w-4" />
          Novo Contato
        </Button>
      )}
    </div>
  );

  return (
    <MainLayout
      title="CRM"
      description="Central de relacionamento operacional"
      actions={topbarActions}
    >
      {activeTab === "contatos" ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="contatos-kpis">
          <Kpi label="Total de contatos" value={contatosKpis.total}        />
          <Kpi label="Clientes"          value={contatosKpis.clientes}     />
          <Kpi label="Parceiros"         value={contatosKpis.parceiros}    />
          <Kpi label="Fornecedores"      value={contatosKpis.fornecedores} />
          <Kpi label="Prestadores"       value={contatosKpis.prestadores}  />
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="leads-kpis">
          <Kpi label="Total de leads"     value={metrics.total}                                                                         />
          <Kpi label="Em negociação"      value={metrics.followUps}                                                                     />
          <Kpi label="Propostas enviadas" value={metrics.propostas}                                                                     />
          <Kpi label="Contratos fechados" value={metrics.contratos}                                                                     />
          <Kpi label="Valor estimado"     value={metrics.valorEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        </section>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "contatos" | "leads")}
        className="mt-6 space-y-6"
      >
        <TabsList
          className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0"
          data-testid="crm-tabs-list"
        >
          <TabsTrigger
            value="contatos"
            className="relative h-10 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            data-testid="tab-contatos"
          >
            <Users className="h-4 w-4" />
            Contatos
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {contacts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="relative h-10 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            data-testid="tab-leads"
          >
            <GitBranch className="h-4 w-4" />
            Leads
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {leads.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contatos" data-testid="tab-content-contatos">
          <ContatosPanel />
        </TabsContent>

        <TabsContent value="leads" data-testid="tab-content-leads">
          <div className="space-y-6">
            <LeadFilters
              filters={filters}
              onChange={(field, value) => setFilters({ [field]: value })}
              responsaveis={responsaveis}
              origens={origens}
            />
            <LeadsTable
              leads={filteredLeads}
              onView={(lead) => setViewLead(lead)}
              onEdit={(lead) => {
                setEditingLead(lead);
                setModalOpen(true);
              }}
              onDelete={(lead) => void deleteLead(lead.id)}
              onBulkDelete={async (rows) => {
                const result = await runBulkAction(rows.map((l) => l.id), deleteLead);
                reportBulkResult(result, "excluído", "lead");
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <LeadFormModal
        open={modalOpen}
        mode={editingLead ? "edit" : "create"}
        initialValue={editingLead ? leadToFormInitial(editingLead) : null}
        onOpenChange={(next) => setModalOpen(next)}
        onSubmit={async (formPayload) => {
          const leadPayload = payloadToLead(formPayload);
          if (editingLead) await updateLead(editingLead.id, leadPayload, getExpectedUpdatedAt(editingLead));
          else await createLead(leadPayload);
        }}
      />

      <LeadViewModal
        open={viewLead !== null}
        onOpenChange={(next) => { if (!next) setViewLead(null); }}
        lead={viewLead}
        onEdit={(lead) => {
          setEditingLead(lead);
          setModalOpen(true);
        }}
      />

      <ContatoFormModal
        open={contatoModalOpen}
        mode="create"
        onOpenChange={setContatoModalOpen}
        onSubmit={async (payload: ContatoFormPayload) => {
          await createContact({
            name:           payload.nome,
            companyName:    payload.tipo_pessoa === "pessoa_juridica" ? payload.razao_social : undefined,
            contactType:    (payload.categoria        || "OTHER")  as Parameters<typeof createContact>[0]["contactType"],
            documentType:   payload.tipo_pessoa === "pessoa_fisica" ? "CPF" : "CNPJ",
            documentNumber: payload.cpf_cnpj,
            phone:          payload.telefone,
            whatsapp:       payload.telefone,
            email:          payload.email,
            instagram:      payload.instagram || undefined,
            address:        payload.endereco_completo,
            city:           payload.cidade,
            state:          payload.estado,
            country:        "Brasil",
            zipCode:        payload.cep,
            responsible:    payload.responsavel,
            notes:          payload.observacoes,
            tags:           [],
            status:         (payload.status_contato     || "active") as Parameters<typeof createContact>[0]["status"],
            priority:       (payload.prioridade_contato || "medium") as Parameters<typeof createContact>[0]["priority"],
            attachments:    payload.attachments ?? [],
            payloadOperacional: {
              tipo_pessoa:          payload.tipo_pessoa,
              perfil:               payload.perfil,
              cpf:                  payload.cpf,
              cnpj:                 payload.cnpj,
              razao_social:         payload.razao_social,
              nome_fantasia:        payload.nome_fantasia,
              funcao:               payload.funcao,
              cargo_responsavel:    payload.cargo_responsavel,
              foto:                 payload.foto,
              logradouro:           payload.logradouro,
              numero:               payload.numero,
              complemento:          payload.complemento,
              bairro:               payload.bairro,
              responsavel_nome:     payload.responsavel_nome,
              responsavel_email:    payload.responsavel_email,
              responsavel_telefone: payload.responsavel_telefone,
              responsavel_cargo:    payload.responsavel_cargo,
              interacoes:           payload.interacoes,
            },
          });
        }}
      />
    </MainLayout>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <MetricCard title={label} value={value} />;
}
