import { Upload, X } from "lucide-react";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import { leadClientTypeOptions, leadServiceTypeOptions, optionLabel, uploadRules } from "../constants";
import {
  ORIGEM_LEAD_OPTIONS,
} from "../constants/lead-form-options";
import { sectionLabel, serviceLeadSchemas, type DynamicFieldSchema, type LeadBaseFieldName, type ServiceLeadSchema } from "../schemas";
import type { Lead, LeadServiceType, LeadUpload } from "../types";

export type LeadFormValues = {
  nomeCompleto: string;
  nomeArtistico?: string;
  empresa?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  city?: string;
  state?: string;
  country?: string;
  clientType: string;
  serviceType: LeadServiceType;
  payloadServico: Record<string, unknown>;
  dadosInternosCRM: {
    statusLead: string;
    responsavel?: string;
    prioridade?: string;
    temperatura?: string;
    origemLead?: string;
    valorEstimado?: number;
    probabilidadeFechamento?: number;
    proximoFollowUp?: string;
    campanha_marketing?: string;
    observacoesInternas?: string;
  };
  uploads: LeadUpload[];
};

export function LeadHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary">CRM comercial</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Captação, negociação, follow-up, propostas e contratos em uma operação comercial limpa.
        </p>
      </div>
      <Button onClick={onCreate}>Novo Lead</Button>
    </header>
  );
}

export function LeadFilters({
  filters,
  onChange,
  responsaveis,
  origens,
}: {
  filters: Record<string, string>;
  onChange: (field: string, value: string) => void;
  responsaveis: string[];
  origens: string[];
}) {
  const { getOptionsByKind } = useOperationalSettings();
  const leadStatusOptions = getOptionsByKind("lead_status");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
      <Input
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        placeholder="Buscar por nome, email, WhatsApp, Instagram ou empresa"
        className="h-8 min-w-[240px] flex-1 bg-card border-border text-sm"
      />
      {/* serviceType: usa leadServiceTypeOptions (enum LeadServiceType — válido para filtrar lead.serviceType) */}
      <FilterSelect
        value={filters.serviceType}
        onValueChange={(value) => onChange("serviceType", value)}
        options={[{ value: "all", label: "Todos os serviços" }, ...leadServiceTypeOptions]}
      />
      {/* CORRIGIDO: usa STATUS_LEAD_OPTIONS do novo sistema, alinhado com os valores salvos pelo LeadFormModal */}
      <FilterSelect
        value={filters.statusLead}
        onValueChange={(value) => onChange("statusLead", value)}
        options={[{ value: "all", label: "Todos os status" }, ...leadStatusOptions]}
      />
      <FilterSelect
        value={filters.responsavel}
        onValueChange={(value) => onChange("responsavel", value)}
        options={[{ value: "all", label: "Responsáveis" }, ...responsaveis.map((value) => ({ value, label: value }))]}
      />
      {/* CORRIGIDO: usa ORIGEM_LEAD_OPTIONS do novo sistema */}
      <FilterSelect
        value={filters.origemLead}
        onValueChange={(value) => onChange("origemLead", value)}
        options={[{ value: "all", label: "Origens" }, ...ORIGEM_LEAD_OPTIONS]}
      />
      <FilterSelect
        value={filters.temperatura}
        onValueChange={(value) => onChange("temperatura", value)}
        options={[
          { value: "all",    label: "Temperatura" },
          { value: "frio",   label: "Frio"        },
          { value: "morno",  label: "Morno"       },
          { value: "quente", label: "Quente"      },
        ]}
      />
    </div>
  );
}

function FilterSelect({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[132px] shrink-0 bg-card border-border text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function LeadBaseFields({ register, setValue, watch, schema }: LeadFormController & { schema: ServiceLeadSchema }) {
  const payload = watch("payloadServico") ?? {};

  return (
    <FormSection title="1. IDENTIFICAÇÃO DO LEAD">
      <Field label="Nome do Contato *">
        <Input {...register("nomeCompleto")} placeholder="Nome da pessoa responsável" />
      </Field>
      <PayloadInput
        label="Sobrenome"
        name="sobrenome"
        placeholder="Sobrenome"
        payload={payload}
        setValue={setValue}
      />
      <Field label="Empresa / Contratante">
        <Input {...register("empresa")} placeholder="Nome da empresa ou contratante" />
      </Field>
      <PayloadInput
        label="Cargo / Função"
        name="cargoFuncao"
        placeholder="Ex: produtor, empresario, promoter"
        payload={payload}
        setValue={setValue}
      />
      <Field label="Email">
        <Input type="email" {...register("email")} placeholder="email@exemplo.com" />
      </Field>
      <Field label="Telefone / WhatsApp *">
        <Input {...register("whatsapp")} placeholder="(00) 00000-0000" />
      </Field>
      <Field label="Instagram">
        <Input {...register("instagram")} placeholder="@usuario" />
      </Field>
      <PayloadInput
        label="Website"
        name="websiteLead"
        placeholder="https://..."
        payload={payload}
        setValue={setValue}
      />
      <Field label="Tipo de Lead *" className="md:col-span-2">
        <Select value={watch("clientType")} onValueChange={(value) => setValue("clientType", value, { shouldDirty: true })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {leadClientTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <LeadTags payload={payload} setValue={setValue} />
    </FormSection>
  );
}

function PayloadInput({
  label,
  name,
  placeholder,
  payload,
  setValue,
}: {
  label: string;
  name: string;
  placeholder: string;
  payload: Record<string, unknown>;
  setValue: UseFormSetValue<LeadFormValues>;
}) {
  return (
    <Field label={label}>
      <Input
        value={String(payload[name] ?? "")}
        placeholder={placeholder}
        onChange={(event) => setValue("payloadServico", { ...payload, [name]: event.target.value }, { shouldDirty: true })}
      />
    </Field>
  );
}

function LeadTags({ payload, setValue }: { payload: Record<string, unknown>; setValue: UseFormSetValue<LeadFormValues> }) {
  const selected = Array.isArray(payload.tags) ? payload.tags.map(String) : ["VIP", "Alta Prioridade", "Indicacao"];
  const tags = ["VIP", "Alta Prioridade", "Indicacao", "Cliente Recorrente", "Artista", "Evento", "Marca", "Corporativo", "Festival", "Turne"];

  function toggleTag(tag: string) {
    const next = selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag];
    setValue("payloadServico", { ...payload, tags: next }, { shouldDirty: true });
  }

  function addCustomTag() {
    const custom = String(payload.customTagInput ?? "").trim();
    if (!custom) return;
    setValue("payloadServico", { ...payload, tags: Array.from(new Set([...selected, custom])), customTagInput: "" }, { shouldDirty: true });
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <Label className="text-xs font-semibold text-foreground">Tags</Label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-medium transition",
              selected.includes(tag)
                ? "border-blue-500/60 bg-blue-500/15 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-blue-500/40",
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={String(payload.customTagInput ?? "")}
          placeholder="Adicionar tag personalizada"
          onChange={(event) => setValue("payloadServico", { ...payload, customTagInput: event.target.value }, { shouldDirty: true })}
        />
        <Button type="button" variant="outline" onClick={addCustomTag}>Adicionar</Button>
      </div>
    </div>
  );
}

export function ServiceTypeSelect({ setValue, watch }: Pick<LeadFormController, "setValue" | "watch">) {
  return (
    <Field label="Tipo de serviço">
      <Select
        value={watch("serviceType")}
        onValueChange={(value) => {
          setValue("serviceType", value as LeadServiceType, { shouldDirty: true });
          setValue("payloadServico", {}, { shouldDirty: true });
        }}
      >
        <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
        <SelectContent>
          {leadServiceTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function DynamicServiceFields({ setValue, watch }: Pick<LeadFormController, "setValue" | "watch">) {
  const serviceType = watch("serviceType");
  const payload = watch("payloadServico") ?? {};
  const schema = serviceLeadSchemas[serviceType];

  return (
    <FormSection title="3. SERVIÇOS E DETALHES">
      <ServiceTypeSelect setValue={setValue} watch={watch} />
      {schema.sections.map((section) => {
        const fields = schema.fields.filter((field) => field.section === section);
        if (fields.length === 0) return null;

        return (
          <div key={section} className="space-y-4 border-t border-border pt-4 first:border-t-0 first:pt-0 md:col-span-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">{sectionLabel(section)}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <DynamicTableField
                  key={field.name}
                  field={field}
                  value={payload[field.name]}
                  onChange={(value) => setValue("payloadServico", { ...payload, [field.name]: value }, { shouldDirty: true })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </FormSection>
  );
}

export function DynamicTableField({ field, value, onChange }: { field: DynamicFieldSchema; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "textarea") {
    return (
      <Field label={field.label}>
        <Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={field.label}>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Selecione"} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  return (
    <Field label={field.label}>
      <Input
        type={field.type === "number" || field.type === "money" ? "number" : field.type}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.type === "number" || field.type === "money" ? numberValue(event.target.value) : event.target.value)}
        placeholder={field.placeholder}
      />
    </Field>
  );
}

function numberValue(value: string) {
  return value === "" ? undefined : Number(value);
}

export function InternalCRMFields({ register, setValue, watch }: LeadFormController) {
  const { getOptionsByKind } = useOperationalSettings();
  const leadStatusOptions = getOptionsByKind("lead_status");

  return (
    <FormSection title="2. ORIGEM DO LEAD">
      <Field label="Origem do Lead *">
        <Select value={watch("dadosInternosCRM.origemLead")} onValueChange={(value) => setValue("dadosInternosCRM.origemLead", value, { shouldDirty: true })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {ORIGEM_LEAD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {/* CORRIGIDO: campo separado para campanha_marketing — não mais conflitando com observacoesInternas */}
      <Field label="Campanha de Marketing">
        <Input {...register("dadosInternosCRM.campanha_marketing")} placeholder="Nome da campanha que gerou o lead" />
      </Field>
      <Field label="Status">
        <Select value={watch("dadosInternosCRM.statusLead")} onValueChange={(value) => setValue("dadosInternosCRM.statusLead", value, { shouldDirty: true })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {leadStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Responsável"><Input {...register("dadosInternosCRM.responsavel")} /></Field>
      <Field label="Prioridade"><Input {...register("dadosInternosCRM.prioridade")} placeholder="alta, media, baixa" /></Field>
      <Field label="Temperatura"><Input {...register("dadosInternosCRM.temperatura")} placeholder="frio, morno, quente" /></Field>
      <Field label="Valor estimado"><Input type="number" {...register("dadosInternosCRM.valorEstimado", { valueAsNumber: true })} /></Field>
      <Field label="Probabilidade (%)"><Input type="number" min={0} max={100} {...register("dadosInternosCRM.probabilidadeFechamento", { valueAsNumber: true })} /></Field>
      <Field label="Próximo follow-up"><DatePickerField value={(watch("dadosInternosCRM.proximoFollowUp") as string) ?? ""} onChange={(iso) => setValue("dadosInternosCRM.proximoFollowUp", iso)} /></Field>
      <Field label="Observações internas"><Textarea {...register("dadosInternosCRM.observacoesInternas")} /></Field>
    </FormSection>
  );
}

export function UploadDropzone({ uploads, onChange }: { uploads: LeadUpload[]; onChange: (uploads: LeadUpload[]) => void }) {
  function handleFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      return uploadRules.mimeTypes.includes(file.type) && uploadRules.extensions.includes(extension) && file.size <= uploadRules.maxSize;
    });
    onChange([
      ...uploads,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        extension: `.${file.name.split(".").pop()?.toLowerCase()}`,
        uploadedAt: new Date().toISOString(),
      })),
    ]);
  }

  return (
    <FormSection title="4. ANEXOS">
      <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center transition hover:bg-muted md:col-span-2">
        <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Adicionar PDF, imagem, video, contrato, rider, midia kit ou release</span>
        <span className="mt-1 text-xs text-muted-foreground">Máximo de 25MB por arquivo</span>
        <input type="file" multiple className="hidden" accept={uploadRules.extensions.join(",")} onChange={(event) => handleFiles(event.target.files)} />
      </label>
      <div className="space-y-2 md:col-span-2">
        {uploads.map((upload) => (
          <div key={upload.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{upload.fileName}</span>
            <button type="button" onClick={() => onChange(uploads.filter((item) => item.id !== upload.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FormSection>
  );
}

export function LeadHistory({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-3">
      {lead.historicoInteracoes.map((item) => (
        <div key={item.id} className="border-l border-primary/40 pl-3">
          <p className="text-sm font-medium text-foreground">{item.description}</p>
          <p className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("pt-BR")}</p>
        </div>
      ))}
    </div>
  );
}

export function LeadFormActions({ onCancel, isSaving }: { onCancel: () => void; isSaving?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border bg-card px-5 py-4">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar lead"}</Button>
    </div>
  );
}

export function LeadRowSummary({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{lead.nomeCompleto}</p>
      <p className="truncate text-xs text-muted-foreground">{lead.email || lead.whatsapp || lead.instagram || "Sem contato"}</p>
    </div>
  );
}

export function ServiceBadge({ serviceType }: { serviceType: LeadServiceType }) {
  return <Badge variant="secondary">{optionLabel(leadServiceTypeOptions, serviceType)}</Badge>;
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full space-y-4 border-b border-border pb-6 last:border-b-0 [&_button[role=combobox]]:border-border [&_button[role=combobox]]:bg-card [&_button[role=combobox]]:text-foreground [&_input]:border-border [&_input]:bg-card [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_textarea]:border-border [&_textarea]:bg-card [&_textarea]:text-foreground [&_textarea]:placeholder:text-muted-foreground">
      <h3 className="text-sm font-medium tracking-[0.08em] text-muted-foreground">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}

type LeadFormController = {
  register: UseFormRegister<LeadFormValues>;
  setValue: UseFormSetValue<LeadFormValues>;
  watch: UseFormWatch<LeadFormValues>;
};
