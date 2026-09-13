import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contractSchema,
  type ContractFormData,
  SIGNER_ROLES,
  SIGNER_ROLE_LABEL,
} from "@/modules/contracts/lib/contract-schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { format, parseISO } from "date-fns";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { FileUpload, UploadedFile } from "@/shared/components/FileUpload";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useContracts } from "@/modules/contracts/hooks/useContracts";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { ContractWithRelations, ContractVersion } from "@/modules/contracts/hooks/useContracts";
import type { ContractSigner } from "@/modules/contracts/lib/contract-schema";
import { useContractServiceTypes } from "@/modules/contracts/hooks/useContractServiceTypes";
import { useContractTemplates } from "@/modules/contracts/hooks/useContractTemplates";
import { useCategoryRegistry } from "@/modules/contracts/hooks/useCategoryRegistry";
import { UserPlus, X } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pendente: "Pendente",
  awaiting_signature: "Aguardando Assinatura",
  signed: "Assinado",
  active: "Ativo",
  in_force: "Vigente",
  expirado: "Expirado",
  rescindido: "Rescindido",
  cancelled: "Cancelado",
};

// ── ContractForm ─────────────────────────────────────────────────────────────
/** REM-02: documents anexos não fazem parte do zod schema (não precisam de
 * validação — já foram validados no upload real ao R2) — trafegam ao lado
 * dos campos do formulário até o payload final. */
type ContratoFormSubmitData = ContractFormData & { documents: UploadedFile[] };

interface ContractFormProps {
  onSubmit: (data: ContratoFormSubmitData) => void;
  onCancel?: () => void;
  initialData?: Partial<ContratoFormSubmitData>;
  isLoading?: boolean;
  artists?: Array<{ id: string; name: string }>;
  /** id do contrato em edição — organiza a pasta do anexo no R2 (undefined em criação). */
  contratoId?: string;
}

const ContractForm = ({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
  artists = [],
  contratoId,
}: ContractFormProps) => {
  const [documents, setDocuments] = useState<UploadedFile[]>(initialData?.documents ?? []);
  const { lancamentos } = useLancamentos();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { status: "draft", registry_office: false, signers: [], ...initialData },
  });

  const serviceTypeValue = form.watch("service_type");
  const { serviceTypes, allServiceTypes } = useContractServiceTypes(null);
  const { templates } = useContractTemplates();

  // Normaliza slugs da CategoryRegistry (e legados) para slugs CST equivalentes.
  // O workspace guarda tipo_servico com slugs da CategoryRegistry (ex: "empresariamento_360").
  // Esta função converte-os para o slug CST correspondente para que o filtro funcione.
  const normalizeToCst = useCallback((slug: string | undefined | null): string | null => {
    if (!slug) return null;
    const CST_VALID = new Set([
      "empresariamento","suporte_financeiro","gestao","agenciamento","edicao",
      "distribuicao","marketing","producao_musical","producao_audiovisual",
      "licenciamento","publicidade","parceria","shows","outros",
    ]);
    if (CST_VALID.has(slug)) return slug;
    const MAP: Record<string, string> = {
      exclusividade: "agenciamento",
      gravacao: "producao_musical",
      cessao_direitos: "licenciamento",
      producao: "producao_musical",
      publicitario: "publicidade",
      semantico: "outros",
    };
    if (MAP[slug]) return MAP[slug];
    // prefix match: "empresariamento_360" → "empresariamento"
    for (const valid of CST_VALID) {
      if (slug.startsWith(valid) || valid.startsWith(slug.replace(/_\d+$/, ""))) return valid;
    }
    return "outros";
  }, []);

  const templateSlugs = useMemo(
    () =>
      new Set(
        templates
          .map((t) => {
            const raw = (t.tipo_servico || (t as Record<string, unknown>)["type"]) as string | undefined;
            return normalizeToCst(raw);
          })
          .filter((s): s is string => Boolean(s)),
      ),
    [templates, normalizeToCst],
  );

  const typesWithTemplates = useMemo(
    () => serviceTypes.filter((t) => templateSlugs.has(t.slug)),
    [serviceTypes, templateSlugs],
  );

  // Mapa CST slug → label da CategoryRegistry do utilizador.
  // Permite mostrar "Empresariamento 360" (CategoryRegistry) em vez de "Empresariamento" (CST).
  const { categories: registryCategories } = useCategoryRegistry();
  const cstToLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) {
      const raw = (t.tipo_servico || (t as Record<string, unknown>)["type"]) as string | undefined;
      if (!raw) continue;
      const cstSlug = normalizeToCst(raw);
      if (!cstSlug) continue;
      // tenta encontrar o label na CategoryRegistry pelo slug do template
      const cat = registryCategories.find((c) => c.value === raw);
      if (cat) map.set(cstSlug, cat.label);
    }
    return map;
  }, [templates, registryCategories, normalizeToCst]);

  const selectedType = allServiceTypes.find((t) => t.slug === serviceTypeValue);
  const legacyServiceTypeLabel =
    serviceTypeValue &&
    !typesWithTemplates.some((t) => t.slug === serviceTypeValue)
      ? allServiceTypes.find((t) => t.slug === serviceTypeValue)?.name ?? serviceTypeValue
      : null;

  const { fields: signerFields, append: appendSigner, remove: removeSigner } = useFieldArray({
    control: form.control,
    name: "signers",
  });

  useEffect(() => {
    if (initialData) {
      form.reset({ status: "draft", registry_office: false, signers: [], ...initialData });
      setDocuments(initialData.documents ?? []);
    }
  }, [initialData, form]);

  const handleManualSubmit = () => form.handleSubmit((data) => onSubmit({ ...data, documents }))();

  return (
    <form onSubmit={form.handleSubmit((data) => onSubmit({ ...data, documents }))} className="space-y-6">
      {/* ── Informações Básicas ── */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título do Contrato *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Ex: Contrato de Agenciamento Artístico"
                data-testid="input-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Tipo de Serviço */}
            <div className="space-y-2">
              <Label>Tipo de Serviço *</Label>
              <Select
                value={form.watch("service_type")}
                onValueChange={(value) => form.setValue("service_type", value as ContractFormData["service_type"])}
              >
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {legacyServiceTypeLabel && (
                    <SelectItem value={serviceTypeValue!} disabled className="text-muted-foreground">
                      {legacyServiceTypeLabel} (type anterior)
                    </SelectItem>
                  )}
                  {typesWithTemplates.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Nenhum template disponível
                    </div>
                  ) : (
                    typesWithTemplates.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {cstToLabel.get(t.slug) ?? t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.service_type && (
                <p className="text-sm text-destructive">{form.formState.errors.service_type.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value as ContractFormData["status"])}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Datas ── */}
      <Card>
        <CardHeader><CardTitle>Datas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <DatePickerField
                value={form.watch("start_date") ? format(form.watch("start_date"), "yyyy-MM-dd") : ""}
                onChange={(iso) => form.setValue("start_date", iso ? parseISO(iso) : (undefined as any))}
                placeholder="Selecione uma data"
                data-testid="datepicker-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Término</Label>
              <DatePickerField
                value={form.watch("end_date") ? format(form.watch("end_date") as Date, "yyyy-MM-dd") : ""}
                onChange={(iso) => form.setValue("end_date", iso ? parseISO(iso) : undefined)}
                placeholder="Selecione uma data"
                data-testid="datepicker-end-date"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="registry_office"
                checked={form.watch("registry_office")}
                onCheckedChange={(checked) => form.setValue("registry_office", checked as boolean)}
              />
              <Label htmlFor="registry_office">Registrado em cartório</Label>
            </div>
          </div>

          {form.watch("registry_office") && (
            <div className="space-y-2">
              <Label>Data de Registro em Cartório</Label>
              <DatePickerField
                value={form.watch("registry_date") ? format(form.watch("registry_date") as Date, "yyyy-MM-dd") : ""}
                onChange={(iso) => form.setValue("registry_date", iso ? parseISO(iso) : undefined)}
                placeholder="Selecione uma data"
                data-testid="datepicker-registry-date"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Valores ── */}
      <Card>
        <CardHeader><CardTitle>Valores</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {selectedType ? (
              <>
                {/* Selecionar tipo de pagamento (valor fixo ou recebimentos externos de direitos) — para qualquer tipo de cliente */}
                {selectedType.allow_installments && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo de Pagamento</Label>
                      <Select
                        value={form.watch("payment_type")}
                        onValueChange={(value) => form.setValue("payment_type", value as "valor_fixo" | "recebimentos externos de direitos")}
                      >
                        <SelectTrigger data-testid="select-payment-type">
                          <SelectValue placeholder="Selecione o tipo de pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="valor_fixo">Valor Fixo</SelectItem>
                          <SelectItem value="recebimentos externos de direitos">Recebimentos externos de direitos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.watch("payment_type") === "valor_fixo" && (
                      <div className="space-y-2">
                        <Label htmlFor="fixed_value_sel">Valor do Serviço (R$)</Label>
                        <Input id="fixed_value_sel" type="number" step="0.01" placeholder="0,00"
                          {...form.register("fixed_value", { valueAsNumber: true })} />
                      </div>
                    )}
                    {form.watch("payment_type") === "recebimentos externos de direitos" && (
                      <div className="space-y-2">
                        <Label htmlFor="recebimentos externos de direitos_pct_sel">Termos externos de direitos (%)</Label>
                        <Input id="recebimentos externos de direitos_pct_sel" type="number" step="0.01" min="0" max="100" placeholder="0,00"
                          {...form.register("external_rights_percentage", { valueAsNumber: true })} />
                      </div>
                    )}
                  </>
                )}

                {/* Recebimentos externos de direitos direto (type não usa seletor de pagamento) */}
                {selectedType.requires_external_rights_terms && !selectedType.allow_installments && (
                  <div className="space-y-2">
                    <Label htmlFor="external_rights_percentage">Termos externos de direitos (%)</Label>
                    <Input id="external_rights_percentage" type="number" step="0.01" min="0" max="100" placeholder="0,00"
                      {...form.register("external_rights_percentage", { valueAsNumber: true })} />
                  </div>
                )}

                {/* Valor fixo direto (type não usa seletor de pagamento) */}
                {selectedType.requires_fixed_value && !selectedType.allow_installments && (
                  <div className="space-y-2">
                    <Label htmlFor="fixed_value">Valor Fixo do Serviço (R$)</Label>
                    <Input id="fixed_value" type="number" step="0.01" placeholder="0,00"
                      {...form.register("fixed_value", { valueAsNumber: true })} />
                  </div>
                )}

                {/* Adiantamento */}
                {selectedType.requires_advance && (
                  <div className="space-y-2">
                    <Label htmlFor="advance_payment">Adiantamento (R$)</Label>
                    <Input id="advance_payment" type="number" step="0.01" placeholder="0,00"
                      {...form.register("advance_payment", { valueAsNumber: true })} />
                  </div>
                )}

                {/* Suporte financeiro mensal */}
                {selectedType.requires_financial_support && (
                  <div className="space-y-2">
                    <Label htmlFor="financial_support">Suporte Financeiro Mensal (R$)</Label>
                    <Input id="financial_support" type="number" step="0.01" placeholder="0,00"
                      {...form.register("financial_support", { valueAsNumber: true })} />
                  </div>
                )}
              </>
            ) : (
              /* Sem type selecionado: campo de valor genérico (fallback) */
              <div className="space-y-2">
                <Label htmlFor="fixed_value_default">Valor do Contrato (R$)</Label>
                <Input id="fixed_value_default" type="number" step="0.01" placeholder="0,00"
                  {...form.register("fixed_value", { valueAsNumber: true })} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Arquivo e Vínculos ── */}
      <Card>
        <CardHeader><CardTitle>Arquivo e Vínculos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arquivo_url">URL do Arquivo (PDF)</Label>
            <Input
              id="arquivo_url"
              {...form.register("arquivo_url")}
              placeholder="https://drive.google.com/file/d/... ou link do PDF"
              data-testid="input-arquivo-url"
            />
            <p className="text-xs text-muted-foreground">Cole o link público do PDF do contrato (Google Drive, Dropbox, etc.)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas_versao">Notas desta versão (opcional)</Label>
            <Input
              id="notas_versao"
              {...form.register("notas_versao")}
              placeholder="Ex: Alteração de cláusula de exclusividade, versão revisada pelo jurídico..."
              data-testid="input-notas-versao"
            />
            <p className="text-xs text-muted-foreground">Descreva o que mudou nesta versão do documento</p>
          </div>
          <div className="space-y-2">
            <Label>Lançamento Vinculado (opcional)</Label>
            <Select
              value={form.watch("release_id") || "none"}
              onValueChange={(value) => form.setValue("release_id", value === "none" ? undefined : value)}
            >
              <SelectTrigger data-testid="select-lancamento-id">
                <SelectValue placeholder="Selecionar lançamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {lancamentos.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Documentos Anexos ── */}
      <Card>
        <CardHeader><CardTitle>Documentos Anexos</CardTitle></CardHeader>
        <CardContent>
          <FileUpload
            folder="contratos/documents"
            accept="application/pdf,image/*"
            maxSize={20}
            multiple
            entity="contract"
            entityId={contratoId}
            value={documents}
            onChange={setDocuments}
          />
        </CardContent>
      </Card>

      {/* ── Signatários ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Signatários</CardTitle>
            {signerFields.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                data-testid="button-add-signer"
                onClick={() => appendSigner({ name: "", email: "", role: "artista" })}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar Signatário
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {signerFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg">
              <UserPlus className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum signatário adicionado</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar Signatário" para definir quem deve assinar este contrato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signerFields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-start p-3 bg-muted/20 border border-border rounded-lg"
                  data-testid={`signer-row-form-${index}`}
                >
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome *</Label>
                    <Input
                      {...form.register(`signers.${index}.name`)}
                      placeholder="Nome completo"
                      className="h-8 text-sm"
                      data-testid={`input-signer-name-${index}`}
                    />
                    {form.formState.errors.signers?.[index]?.name && (
                      <p className="text-xs text-destructive">{form.formState.errors.signers[index]?.name?.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email *</Label>
                    <Input
                      {...form.register(`signers.${index}.email`)}
                      placeholder="email@exemplo.com"
                      type="email"
                      className="h-8 text-sm"
                      data-testid={`input-signer-email-${index}`}
                    />
                    {form.formState.errors.signers?.[index]?.email && (
                      <p className="text-xs text-destructive">{form.formState.errors.signers[index]?.email?.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Papel</Label>
                    <Select
                      value={form.watch(`signers.${index}.role`)}
                      onValueChange={(value) => form.setValue(`signers.${index}.role`, value as typeof SIGNER_ROLES[number])}
                    >
                      <SelectTrigger className="h-8 text-sm w-36" data-testid={`select-signer-role-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIGNER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{SIGNER_ROLE_LABEL[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSigner(index)}
                      data-testid={`button-remove-signer-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Observações e Termos ── */}
      <Card>
        <CardHeader><CardTitle>Observações e Termos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea id="observations" {...form.register("observations")}
              placeholder="Observações adicionais..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Termos</Label>
            <Textarea id="terms" {...form.register("terms")}
              placeholder="Termos do contrato..." rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
        <Button type="button" disabled={isLoading} onClick={handleManualSubmit} className="w-full sm:w-auto">
          {isLoading ? "Salvando..." : "Salvar Contrato"}
        </Button>
      </div>
    </form>
  );
};

// ── Mapper: ContractWithRelations → ContractFormData ─────────────────────────
function contratoToFormData(c: ContractWithRelations): Partial<ContratoFormSubmitData> {
  const status = c.status as ContractFormData["status"] | undefined;
  const serviceType = c.type as ContractFormData["service_type"] | undefined;
  return {
    title:        c.title ?? "",
    service_type: serviceType,
    status:       status ?? "draft",
    arquivo_url:  c.arquivo_url ?? undefined,
    release_id: c.release_id ?? undefined,
    start_date:   c.start_date ? new Date(c.start_date) : undefined,
    end_date:     c.end_date    ? new Date(c.end_date)    : undefined,
    fixed_value:  c.valor ?? undefined,
    observations: c.observacoes?.startsWith("{") ? undefined : (c.observacoes ?? undefined),
    signers:      Array.isArray(c.signers)
      ? c.signers.filter((s): s is ContractSigner => !("obrigatorio" in s))
      : [],
    documents:   Array.isArray(c.documents) ? (c.documents as UploadedFile[]) : [],
  };
}

// ── ContractFormModal ────────────────────────────────────────────────────────
interface ContractFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: ContractWithRelations;
  mode?: "create" | "edit";
  prefill?: { title: string; notes: string };
}

export const ContractFormModal = ({
  open,
  onOpenChange,
  contrato,
  mode = "create",
  prefill,
}: ContractFormModalProps) => {
  const { addContract, updateContract } = useContracts();

  const handleSubmit = async (data: ContratoFormSubmitData) => {
    const {
      title, service_type, status,
      arquivo_url, notas_versao, release_id,
      start_date, end_date, fixed_value,
      external_rights_percentage, advance_payment, financial_support, observations,
      signers, documents,
    } = data;

    const resolvedArquivoUrl = arquivo_url || (mode === "edit" && contrato ? (contrato.arquivo_url ?? null) : null);
    const resolvedReleaseId = release_id || (mode === "edit" && contrato ? (contrato.release_id ?? null) : null);

    const payload: Record<string, unknown> = {
      title: title,
      type: service_type,
      status: status || "draft",
      arquivo_url: resolvedArquivoUrl,
      release_id: resolvedReleaseId,
      start_date: start_date ? (start_date as Date).toISOString().split("T")[0] : null,
      end_date: end_date ? (end_date as Date).toISOString().split("T")[0] : null,
      valor: fixed_value || null,
      observacoes: observations || null,
      signers: signers ?? [],
      documents: documents ?? [],
    };

    if (mode === "edit" && contrato) {
      const prevUrl = contrato.arquivo_url;
      const newUrl = arquivo_url || null;
      const urlChanged = newUrl && newUrl !== prevUrl;
      const existingVersions: ContractVersion[] = Array.isArray(contrato.versoes)
        ? (contrato.versoes as ContractVersion[])
        : [];

      if (urlChanged) {
        const nextVersionNum = existingVersions.length + 1;
        const newVersion: ContractVersion = {
          versao: `v${nextVersionNum}`,
          url: newUrl as string,
          criado_em: new Date().toISOString(),
          notas: notas_versao || undefined,
          autor: "Usuário atual",
        };
        payload.versoes = [...existingVersions, newVersion];
      } else {
        payload.versoes = existingVersions;
      }
      try {
        await updateContract.mutateAsync({
          id: contrato.id,
          ...payload,
          expectedUpdatedAt: getExpectedUpdatedAt(contrato),
        });
      } catch (err) {
        if (handleConcurrencyConflict(err, "contrato")) return;
        return;
      }
    } else {
      if (arquivo_url) {
        const firstVersion: ContractVersion = {
          versao: "v1",
          url: arquivo_url,
          criado_em: new Date().toISOString(),
          notas: notas_versao || undefined,
          autor: "Usuário atual",
        };
        payload.versoes = [firstVersion];
      } else {
        payload.versoes = [];
      }
      try {
        await addContract.mutateAsync(payload as Parameters<typeof addContract.mutateAsync>[0]);
      } catch {
        return;
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{mode === "create" ? "Novo Contrato" : "Editar Contrato"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
          <ContractForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={addContract.isPending || updateContract.isPending}
            contratoId={contrato?.id}
            initialData={
              contrato
                ? contratoToFormData(contrato)
                : prefill
                  ? { title: prefill.title, observations: prefill.notes }
                  : undefined
            }
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
