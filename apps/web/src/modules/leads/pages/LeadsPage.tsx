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
import { LeadFormModal } from "../modals/LeadFormModal";
import { LeadViewModal } from "../modals/LeadViewModal";
import { LeadsTable } from "../tables/LeadsTable";
import type { Lead } from "../types";
import { leadFormToLead, leadToFormInitial } from "../lib/lead-form-mapper";
import { ContactsPanel } from "@/modules/crm-relationships/components/ContactsPanel";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { ContactFormModal, type ContactFormPayload } from "@/modules/crm-relationships/modals/ContactFormModal";

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, metrics, createLead, updateLead, deleteLead } = useLeads();
  const { contacts, createContact }                            = useContacts();
  const { filters, setFilters }                                = useLeadFiltersStore();

  const [modalOpen,        setModalOpen]        = useState(false);
  const [editingLead,      setEditingLead]      = useState<Lead | null>(null);
  const [viewLead,         setViewLead]         = useState<Lead | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [activeTab,        setActiveTab]        = useState<"contatos" | "leads">("contatos");

  const responsiblePeople = useMemo(
    () => Array.from(
      new Set(leads.map((l) => l.crmInternalData.responsiblePerson).filter(Boolean)),
    ) as string[],
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const search = filters.search.toLowerCase();
    return leads.filter((lead) => {
      const values = [
        lead.fullName, lead.stageName, lead.company,
        lead.email, lead.whatsapp, lead.instagram,
      ].join(" ").toLowerCase();
      return (
        (!search || values.includes(search))                                                                    &&
        (filters.serviceType       === "all" || lead.serviceType                       === filters.serviceType)       &&
        (filters.status            === "all" || lead.status                            === filters.status)            &&
        (filters.responsiblePerson === "all" || lead.crmInternalData.responsiblePerson === filters.responsiblePerson) &&
        (filters.leadSource        === "all" || lead.crmInternalData.leadSource        === filters.leadSource)        &&
        (filters.temperature       === "all" || lead.crmInternalData.temperature       === filters.temperature)
      );
    });
  }, [filters, leads]);

  const contactsKpis = useMemo(() => {
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

  // Real CRM export: reuses the Reports Center (data
  // completos do tenant, RBAC, tenant isolation, formula injection mitigada —
  // see Part 79). No parallel client-side implementation.
  const exportButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => navigate("/reports")}
      title="Exporta pela Central de Relatórios (dados completos do workspace)"
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
        <Button size="sm" onClick={() => setContactModalOpen(true)} data-testid="button-novo-contato">
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
          <Kpi label="Total de contatos" value={contactsKpis.total}        />
          <Kpi label="Clientes"          value={contactsKpis.clientes}     />
          <Kpi label="Parceiros"         value={contactsKpis.parceiros}    />
          <Kpi label="Fornecedores"      value={contactsKpis.fornecedores} />
          <Kpi label="Prestadores"       value={contactsKpis.prestadores}  />
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="leads-kpis">
          <Kpi label="Total de leads"     value={metrics.total}                                                                         />
          <Kpi label="Em negociação"      value={metrics.followUps}                                                                     />
          <Kpi label="Propostas enviadas" value={metrics.proposals}                                                                     />
          <Kpi label="Contratos fechados" value={metrics.contracts}                                                                     />
          <Kpi label="Valor estimado"     value={metrics.estimatedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
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
          <ContactsPanel />
        </TabsContent>

        <TabsContent value="leads" data-testid="tab-content-leads">
          <div className="space-y-6">
            <LeadFilters
              filters={filters}
              onChange={(field, value) => setFilters({ [field]: value })}
              responsiblePeople={responsiblePeople}
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
          const leadPayload = leadFormToLead(formPayload);
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

      <ContactFormModal
        open={contactModalOpen}
        mode="create"
        onOpenChange={setContactModalOpen}
        onSubmit={async (payload: ContactFormPayload) => {
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
