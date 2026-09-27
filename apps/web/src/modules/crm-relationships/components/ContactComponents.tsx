import { Building2, FileText, Mail, MapPin, MessageSquare, Phone, Plus, Upload, X } from "lucide-react";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import { contactPriorityOptions, contactStatusOptions, contactTypeOptions, labelFor, relationshipUploadRules } from "../constants";
import { contactTypeSchemas, schemaKey } from "../schemas";
import type { Contact, ContactAttachment, ContactPriority, ContactStatus, ContactType } from "../types";

export type ContactFormValues = Omit<Contact, "id" | "createdAt" | "updatedAt" | "timeline"> & {
  attachments: ContactAttachment[];
};

export function ContactHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-primary">CRM relacionamentos</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Contatos estratégicos</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Fornecedores, parceiros, mídia, casas de show, patrocinadores e contatos operacionais em uma lista central.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" /> Novo Contato
      </Button>
    </header>
  );
}

export function ContactFilters({
  filters,
  onChange,
  cities,
  tags,
}: {
  filters: Record<string, string>;
  onChange: (field: string, value: string) => void;
  cities: string[];
  tags: string[];
}) {
  const { getOptionsByKind } = useOperationalSettings();
  const contactCategoryOptions = getOptionsByKind("contact_category");

  return (
    <div className="space-y-3">
      <Input
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        placeholder="Buscar por nome, empresa, e-mail, telefone, tag ou cidade"
        className="h-8"
      />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect value={filters.contactType} onValueChange={(value) => onChange("contactType", value)} options={[{ value: "all", label: "Todos os tipos" }, ...contactCategoryOptions]} />
        <FilterSelect value={filters.status} onValueChange={(value) => onChange("status", value)} options={[{ value: "all", label: "Todos os status" }, ...contactStatusOptions]} />
        <FilterSelect value={filters.priority} onValueChange={(value) => onChange("priority", value)} options={[{ value: "all", label: "Prioridades" }, ...contactPriorityOptions]} />
        <FilterSelect value={filters.city} onValueChange={(value) => onChange("city", value)} options={[{ value: "all", label: "Cidades" }, ...cities.map((value) => ({ value, label: value }))]} />
        <FilterSelect value={filters.tag} onValueChange={(value) => onChange("tag", value)} options={[{ value: "all", label: "Tags" }, ...tags.map((value) => ({ value, label: value }))]} />
      </div>
    </div>
  );
}

function FilterSelect({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function ContactDetailsPanel({ contact }: { contact?: Contact | null }) {
  if (!contact) {
    return (
      <aside className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        Selecione um contato para ver o painel operacional.
      </aside>
    );
  }

  return (
    <aside className="space-y-5 rounded-lg border border-border bg-card p-5">
      <section>
        <h2 className="text-lg font-semibold text-foreground">{contact.name}</h2>
        <p className="text-sm text-muted-foreground">{contact.companyName ?? labelFor(contactTypeOptions, contact.contactType)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{labelFor(contactTypeOptions, contact.contactType)}</Badge>
          <Badge variant="outline">{contact.priority}</Badge>
        </div>
      </section>
      <SocialMediaSection contact={contact} />
      <OperationalInfoSection contact={contact} />
      <ContactTags tags={contact.tags} />
      <ContactTimeline contact={contact} />
      <ContactAttachments contact={contact} />
      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Ações rápidas</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline"><Mail className="mr-2 h-4 w-4" /> E-mail</Button>
        </div>
      </section>
    </aside>
  );
}

export function ContactTimeline({ contact }: { contact: Contact }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Timeline resumida</h3>
      {(contact.timeline ?? []).map((item) => (
        <div key={item.id} className="border-l border-primary/40 pl-3">
          <p className="text-sm text-foreground">{item.summary}</p>
          <p className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("pt-BR")}</p>
        </div>
      ))}
    </section>
  );
}

export function ContactTags({ tags }: { tags: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Tags</h3>
      <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
    </section>
  );
}

export function ContactAttachments({ contact }: { contact: Contact }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Anexos recentes</h3>
      {(contact.attachments ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum anexo recente.</p> : null}
      {(contact.attachments ?? []).slice(0, 4).map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 text-primary" /> {item.fileName}
        </div>
      ))}
    </section>
  );
}

export function ContactContracts() {
  return <div className="text-sm text-muted-foreground">Contratos vinculados ao contato aparecem aqui.</div>;
}

export function ContactNotes({ register }: Pick<ContactFormController, "register">) {
  return <Field label="Observações"><Textarea {...register("notes")} /></Field>;
}

export function ContactAgenda() {
  return <div className="text-sm text-muted-foreground">Agenda operacional vinculada.</div>;
}

export function CompanyRelations() {
  return <div className="text-sm text-muted-foreground">Relações empresariais e vínculos operacionais.</div>;
}

export function SocialMediaSection({ contact }: { contact: Contact }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Contato e localização</h3>
      <Info icon={Phone} value={contact.whatsapp ?? contact.phone} />
      <Info icon={Mail} value={contact.email} />
      <Info icon={MapPin} value={[contact.city, contact.state, contact.country].filter(Boolean).join(", ")} />
      <Info icon={Building2} value={contact.website ?? contact.instagram} />
    </section>
  );
}

export function OperationalInfoSection({ contact }: { contact: Contact }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">Dados operacionais</h3>
      <p className="text-sm text-muted-foreground">Responsavel: {contact.responsible ?? "-"}</p>
      <p className="text-sm text-muted-foreground">Status: {contact.status}</p>
      <p className="text-sm text-muted-foreground">Artista vinculado: {contact.linkedArtistId ?? "-"}</p>
      {contact.notes ? <p className="text-sm text-muted-foreground">{contact.notes}</p> : null}
    </section>
  );
}

function Info({ icon: Icon, value }: { icon: React.ComponentType<{ className?: string }>; value?: string }) {
  return value ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" /> {value}</p> : null;
}

export function ContactForm({ register, setValue, watch }: ContactFormController) {
  const type = watch("contactType") as ContactType;
  const dynamicSchema = contactTypeSchemas[schemaKey(type)] ?? contactTypeSchemas.other;
  const payload = watch("payloadOperacional") ?? {};
  const { getOptionsByKind } = useOperationalSettings();
  const contactCategoryOptions = getOptionsByKind("contact_category");

  return (
    <div className="space-y-4">
      <FormSection title="Dados Básicos">
        <Field label="Nome"><Input {...register("name")} /></Field>
        <Field label="Empresa"><Input {...register("companyName")} /></Field>
        <Field label="Tipo">
          <Select value={type} onValueChange={(value) => setValue("contactType", value as ContactType, { shouldDirty: true })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{contactCategoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Documento"><Input {...register("documentNumber")} placeholder="CPF, CNPJ ou documento operacional" /></Field>
      </FormSection>
      <FormSection title="Informações de Contato">
        <Field label="Telefone"><Input {...register("phone")} /></Field>
        <Field label="WhatsApp"><Input {...register("whatsapp")} /></Field>
        <Field label="E-mail"><Input type="email" {...register("email")} /></Field>
        <Field label="Instagram"><Input {...register("instagram")} /></Field>
        <Field label="Site"><Input {...register("website")} /></Field>
      </FormSection>
      <FormSection title="Localização">
        <Field label="Endereço"><Input {...register("address")} /></Field>
        <Field label="Cidade"><Input {...register("city")} /></Field>
        <Field label="Estado"><Input {...register("state")} /></Field>
        <Field label="País"><Input {...register("country")} /></Field>
        <Field label="CEP"><Input {...register("zipCode")} /></Field>
      </FormSection>
      <FormSection title="Informações Operacionais">
        <Field label="Responsável"><Input {...register("responsible")} /></Field>
        <Field label="Status"><Select value={watch("status")} onValueChange={(value) => setValue("status", value as ContactStatus, { shouldDirty: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Prioridade"><Select value={watch("priority")} onValueChange={(value) => setValue("priority", value as ContactPriority, { shouldDirty: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactPriorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Artista vinculado"><Input {...register("linkedArtistId")} placeholder="linkedArtistId" /></Field>
        {dynamicSchema.fields.map((field) => (
          <Field key={field.name} label={field.label}>
            <Input value={String(payload[field.name] ?? "")} placeholder={field.placeholder} onChange={(event) => setValue("payloadOperacional", { ...payload, [field.name]: event.target.value }, { shouldDirty: true })} />
          </Field>
        ))}
        <ContactNotes register={register} />
      </FormSection>
      <FormSection title="Tags">
        <Field label="Tags separadas por virgula"><Input value={watch("tags").join(", ")} onChange={(event) => setValue("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean), { shouldDirty: true })} /></Field>
      </FormSection>
      <ContactAttachmentDropzone
        attachments={watch("attachments") ?? []}
        onChange={(attachments) => setValue("attachments", attachments, { shouldDirty: true })}
      />
    </div>
  );
}

function ContactAttachmentDropzone({
  attachments,
  onChange,
}: {
  attachments: ContactAttachment[];
  onChange: (attachments: ContactAttachment[]) => void;
}) {
  function handleFiles(files: FileList | null) {
    if (!files) return;

    const accepted = Array.from(files).filter((file) => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      return (
        relationshipUploadRules.mimeTypes.includes(file.type) &&
        relationshipUploadRules.extensions.includes(extension) &&
        file.size <= relationshipUploadRules.maxSize
      );
    });

    onChange([
      ...attachments,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        extension: `.${file.name.split(".").pop()?.toLowerCase()}`,
        size: file.size,
        createdAt: new Date().toISOString(),
      })),
    ]);
  }

  return (
    <FormSection title="Anexos">
      <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:bg-muted/50">
        <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Adicionar PDF, imagem, vídeo, contrato, rider, mídia kit ou release</span>
        <span className="mt-1 text-xs text-muted-foreground">Arquivos inválidos são bloqueados antes de salvar.</span>
        <input type="file" multiple className="hidden" accept={relationshipUploadRules.extensions.join(",")} onChange={(event) => handleFiles(event.target.files)} />
      </label>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{attachment.fileName}</span>
            <button type="button" onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FormSection>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="w-full space-y-4 rounded-lg border border-border bg-card p-4"><h3 className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">{title}</h3><div className="space-y-4">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="w-full space-y-2"><Label className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{label}</Label>{children}</div>;
}

type ContactFormController = {
  register: UseFormRegister<ContactFormValues>;
  setValue: UseFormSetValue<ContactFormValues>;
  watch: UseFormWatch<ContactFormValues>;
};

