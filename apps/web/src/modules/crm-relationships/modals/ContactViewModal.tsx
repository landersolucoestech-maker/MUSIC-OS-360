import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge }  from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  Briefcase, Building2, Clock, FileText,
  Flag, Hash, Instagram, Loader2, Mail, MapPin,
  MessageSquare, Pencil, Phone, Star, Tag, User,
} from "lucide-react";
import { contactPriorityOptions, contactStatusOptions, contactTypeOptions, labelFor } from "../constants";
import { profileLabel, type ContactPersonType } from "../constants/contact-classification";
import { useClientTimeline } from "../hooks/useClientTimeline";
import { INTERACTION_TYPE_OPTIONS } from "../shared/interactions";
import type { Contact } from "../types";
import { useSkillRun } from "@/shared/hooks/useSkillRun";
import { SkillRunPanel } from "@/shared/components/SkillRunPanel";
import { StoredFileLink } from "@/shared/components/StoredFileLink";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ContactViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onEdit?: (contact: Contact) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  try { return new Date(value).toLocaleDateString("pt-BR"); }
  catch { return value; }
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  full,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  full?: boolean;
}) {
  const isEmpty = value == null || value === "" || value === "—";
  return (
    <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </p>
      <p className={isEmpty ? "text-sm italic text-muted-foreground" : "break-words text-sm text-foreground"}>
        {isEmpty ? "—" : value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function ContactViewModal({ open, onOpenChange, contact, onEdit }: ContactViewModalProps) {
  const timeline = useClientTimeline(open && contact ? contact.id : null);
  const [newNote, setNewNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const dealsCrm = useSkillRun<Record<string, unknown>>(`/clients/${contact?.id}/ai/deals-crm`);

  if (!contact) return null;

  const handleAddNote = async () => {
    const description = newNote.trim();
    if (!description) return;
    setIsSavingNote(true);
    try {
      await timeline.addEntry("nota", description);
      setNewNote("");
    } finally {
      setIsSavingNote(false);
    }
  };

  const po = (contact.payloadOperacional ?? {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof po[k] === "string" ? (po[k] as string) : "");

  const interactions: Array<{ id: string; type: string; data: string; horario: string; descricao: string }> =
    Array.isArray(po.interacoes) ? (po.interacoes as never) : [];

  const personType  = str("tipo_pessoa") || "pessoa_fisica";
  const isPF        = personType === "pessoa_fisica";
  const personTypeLabel = isPF ? "Pessoa Física" : "Pessoa Jurídica";
  const categoryLabel  = labelFor(contactTypeOptions, contact.contactType);
  const profileSlug      = str("perfil");
  const profileText      = profileLabel(profileSlug, personType as ContactPersonType, contact.contactType);
  const razaoSocial = str("razao_social");
  const tradeName = str("nome_fantasia");
  const funcao       = str("funcao");
  const foto         = str("foto");

  const ownerName     = str("responsavel_nome")     || contact.responsible;
  const respEmail    = str("responsavel_email");
  const ownerPhone = str("responsavel_telefone");
  const ownerPosition    = str("responsavel_cargo");

  const logradouro   = str("logradouro");
  const number       = str("numero");
  const complement  = str("complemento");
  const neighborhood       = str("bairro");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        data-testid="contato-view-modal"
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-3"
            data-testid="contato-view-title"
          >
            {foto && (
              <img
                src={foto}
                alt="Foto"
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            )}
            {contact.name}
            <Badge variant="outline" className="text-xs">
              {labelFor(contactStatusOptions, contact.status)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {contact.companyName ?? labelFor(contactTypeOptions, contact.contactType)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">

          {/* ══ CONTACT CLASSIFICATION ══ */}
          <Section title="Classificação do Contato">
            <Row icon={User} label="Tipo de Contato" value={personTypeLabel} />
            <Row icon={Tag}  label="Categoria"        value={categoryLabel} />
            <Row icon={Tag}  label="Perfil"           value={profileText} />
          </Section>

          {/* ══ DATA ══ */}
          <Section title={isPF ? "Dados da Pessoa Física" : "Dados da Pessoa Jurídica"}>
            {isPF ? (
              <>
                <Row icon={User}      label="Nome Completo" value={contact.name} />
                <Row icon={Hash}      label="CPF"           value={str("cpf")} />
                <Row icon={Mail}      label="E-mail"         value={contact.email} />
                <Row icon={Phone}     label="Telefone"      value={contact.phone || contact.whatsapp} />
                <Row icon={Instagram} label="Instagram"     value={contact.instagram} />
                <Row icon={Briefcase} label="Função"        value={funcao} />
              </>
            ) : (
              <>
                <Row icon={Building2} label="Razão Social"  value={razaoSocial} />
                <Row icon={Building2} label="Nome Fantasia" value={tradeName} />
                <Row icon={Hash}      label="CNPJ"          value={str("cnpj")} />
                <Row icon={Mail}      label="E-mail"         value={contact.email} />
                <Row icon={Instagram} label="Instagram"     value={contact.instagram} />
                <Row icon={Phone}     label="Telefone"      value={contact.phone || contact.whatsapp} />
              </>
            )}
          </Section>

          {/* ══ ADDRESS ══ */}
          <Section title="Endereço">
            <Row icon={MapPin} label="Logradouro"  value={logradouro} />
            <Row icon={Hash}   label="Número"       value={number} />
            <Row icon={MapPin} label="Complemento"  value={complement} />
            <Row icon={MapPin} label="Bairro"       value={neighborhood} />
            <Row icon={MapPin} label="Cidade"       value={contact.city} />
            <Row icon={Hash}   label="Estado"       value={contact.state} />
            <Row icon={Hash}   label="CEP"          value={str("cep") || contact.zipCode} />
          </Section>

          {/* ══ CLASSIFICATION ══ */}
          <Section title="Classificação">
            <Row icon={Flag} label="Status do Contato" value={labelFor(contactStatusOptions, contact.status)} />
            <Row icon={Star} label="Prioridade"        value={labelFor(contactPriorityOptions, contact.priority)} />
          </Section>

          {/* ══ RESPONSIBLE PERSON (legal entities only) ══ */}
          {!isPF && (
            <Section title="Responsável">
              <Row icon={User}      label="Nome do Responsável"     value={ownerName} />
              <Row icon={Briefcase} label="Cargo do Responsável"    value={ownerPosition} />
              <Row icon={Mail}      label="E-mail do responsável"    value={respEmail} />
              <Row icon={Phone}     label="Telefone do Responsável" value={ownerPhone} />
            </Section>
          )}

          {/* ══ ATTACHMENTS ══ */}
          {(contact.attachments?.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
                Anexos
              </h3>
              <div className="space-y-2">
                {contact.attachments!.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    {att.url ? (
                      <StoredFileLink url={att.url} className="hover:underline">
                        {att.fileName}
                      </StoredFileLink>
                    ) : (
                      att.fileName
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ══ NOTES ══ */}
          {contact.notes && (
            <Section title="Observações">
              <Row icon={FileText} label="Notas" value={contact.notes} full />
            </Section>
          )}

          {/* ══ INTERACTION HISTORY ══ */}
          <section className="space-y-3">
            <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
              Histórico de Interações
            </h3>
            {interactions.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhuma interação registrada.
              </p>
            ) : (
              <div className="space-y-3">
                {interactions.map((it, idx) => (
                  <div
                    key={it.id}
                    className="space-y-1 rounded-md border bg-muted/20 p-3"
                    data-testid={`contato-view-interacao-${it.id}`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Interação {idx + 1} · {labelFor([...INTERACTION_TYPE_OPTIONS], it.type)} · {fmtDate(it.data)}{it.horario ? ` ${it.horario}` : ""}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {it.descricao || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ══ COMMERCIAL PIPELINE (deals-crm AI Skill over real contracts) ══ */}
          <section className="space-y-3" data-testid="contato-view-deals-crm">
            <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
              Pipeline Comercial (IA)
            </h3>
            <SkillRunPanel
              label="Analisar pipeline comercial"
              result={dealsCrm.result}
              isRunning={dealsCrm.isRunning}
              error={dealsCrm.error}
              onRun={() => dealsCrm.run(undefined)}
            />
          </section>

          {/* ══ TIMELINE (real, persistida em activity_logs) ══ */}
          <section className="space-y-3" data-testid="contato-view-timeline">
            <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
              Timeline
            </h3>

            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Registrar uma nota na timeline…"
                disabled={isSavingNote}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleAddNote();
                  }
                }}
                data-testid="contato-view-timeline-input"
              />
              <Button
                type="button"
                onClick={() => void handleAddNote()}
                disabled={isSavingNote || !newNote.trim()}
                data-testid="contato-view-timeline-add"
              >
                {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
              </Button>
            </div>

            {timeline.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando timeline…
              </p>
            ) : timeline.error ? (
              <p className="text-sm text-destructive">
                Não foi possível carregar a timeline.
              </p>
            ) : timeline.entries.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhum evento registrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {timeline.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-1 rounded-md border bg-muted/20 p-3"
                    data-testid={`contato-view-timeline-entry-${entry.id}`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {entry.action} · {entry.user_name ?? "Sistema"} · {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {entry.description || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-view"
          >
            Fechar
          </Button>
          {onEdit && (
            <Button
              onClick={() => { onOpenChange(false); onEdit(contact); }}
              data-testid="button-edit-from-view"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
