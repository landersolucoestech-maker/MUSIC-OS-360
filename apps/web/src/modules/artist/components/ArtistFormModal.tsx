import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ARTIST_FORM_SECTIONS,
  DISTRIBUIDORAS_OPTIONS,
  artistSchema,
  artistToFormValues,
  artistToPreservedInput,
  emptyArtistFormValues,
  emptyPreservedInput,
  formValuesToArtistPayload,
  type ArtistFormField,
  type ArtistFormValues,
  type ArtistFormAllValues,
  type ArtistPreservedInput,
} from "@/modules/artist/forms/artist-form.definition";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2, Save, CheckCircle2, XCircle } from "lucide-react";
import { FileUpload, type UploadedFile } from "@/shared/components/FileUpload";
import { useArtists, type Artist } from "@/modules/artist/hooks/useArtists";
import { api } from "@/shared/lib/api-client";
import { useClientes } from "@/modules/crm-relationships/hooks/useContacts";
import { TeamContactsCRM } from "@/modules/artist/components/TeamContactsCRM";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { toast } from "sonner";
import type { DistributorEntry } from "@/modules/artist/types/artist.types";
import type { UrlValidationState } from "@/modules/artist/mappers";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";

// ─── Helper: URL validation icon ─────────────────────────────────

function UrlIcon({ state }: { state: UrlValidationState }) {
  if (state === "valid")   return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (state === "invalid") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return null;
}

// ─── Composite: Distribuidoras / Agregadoras ─────────────────────

function DistributorsField({
  value,
  onChange,
}: {
  value: DistributorEntry[];
  onChange: (next: DistributorEntry[]) => void;
}) {
  const toggle = (distId: string, checked: boolean) => {
    if (checked) {
      onChange([...value, { id: distId, email: "", customName: distId === "outros" ? "" : undefined }]);
    } else {
      onChange(value.filter((d) => d.id !== distId));
    }
  };
  const updateEmail = (distId: string, email: string) =>
    onChange(value.map((d) => (d.id === distId ? { ...d, email } : d)));
  const updateCustomName = (customName: string) =>
    onChange(value.map((d) => (d.id === "outros" ? { ...d, customName } : d)));

  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {DISTRIBUIDORAS_OPTIONS.map((dist) => {
          const entry = value.find((d) => d.id === dist.id);
          const isChecked = !!entry;
          return (
            <div key={dist.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`geral-dist-${dist.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => toggle(dist.id, !!checked)}
                  data-testid={`checkbox-geral-dist-${dist.id}`}
                />
                <Label htmlFor={`geral-dist-${dist.id}`} className="text-sm cursor-pointer font-medium">
                  {dist.label}
                </Label>
              </div>

              {isChecked && dist.id === "outros" && (
                <div className="ml-6 space-y-1.5">
                  <Input
                    value={entry?.customName ?? ""}
                    onChange={(e) => updateCustomName(e.target.value)}
                    placeholder="Nome da distribuidora…"
                    className="h-8 text-sm"
                    data-testid="input-geral-dist-nome-custom"
                  />
                  {(entry?.customName ?? "").trim().length > 0 && (
                    <Input
                      value={entry?.email ?? ""}
                      onChange={(e) => updateEmail(dist.id, e.target.value)}
                      type="email"
                      placeholder="Email de share…"
                      className="h-8 text-sm"
                      data-testid="input-geral-dist-email-outros"
                    />
                  )}
                </div>
              )}

              {isChecked && dist.id !== "outros" && (
                <div className="ml-6">
                  <Input
                    value={entry?.email ?? ""}
                    onChange={(e) => updateEmail(dist.id, e.target.value)}
                    type="email"
                    placeholder={`Email de share — ${dist.label}`}
                    className="h-8 text-sm"
                    data-testid={`input-geral-dist-email-${dist.id}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {value.some((d) => d.id === "outros" && !(d.customName ?? "").trim()) && (
        <p className="text-xs text-muted-foreground ml-6">
          Preencha o nome da distribuidora para activar o email de share.
        </p>
      )}
    </>
  );
}

// ─── Field renderer (dirigido pela definição) ────────────────────

type FileFieldId = "fotoUrl" | "documentosPessoaisUrl" | "presskitUrl";

interface FieldRendererCtx {
  register: UseFormRegister<ArtistFormValues>;
  control: Control<ArtistFormValues>;
  watch: UseFormWatch<ArtistFormValues>;
  files: Record<FileFieldId, UploadedFile[]>;
  setFile: (id: FileFieldId, value: UploadedFile[]) => void;
  artistId?: string;
}

function FieldLabel({ field }: { field: ArtistFormField }) {
  return (
    <Label>
      {field.label} {field.required && <span className="text-destructive">*</span>}
    </Label>
  );
}

function renderArtistField(field: ArtistFormField, ctx: FieldRendererCtx) {
  const { register, control, watch, files, setFile, artistId } = ctx;
  const span = field.fullWidth ? "col-span-2" : "";
  const rhfId = field.id as keyof ArtistFormValues;

  switch (field.type) {
    case "file":
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <FileUpload
            folder={field.file!.folder}
            accept={field.file!.accept}
            maxSize={field.file!.maxSize}
            circular={field.file!.circular}
            entity="artist"
            entityId={artistId}
            value={files[field.id as FileFieldId]}
            onChange={(v) => setFile(field.id as FileFieldId, v)}
          />
        </div>
      );

    case "textarea":
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <Textarea
            {...register(rhfId)}
            placeholder={field.placeholder}
            className="min-h-[120px]"
            data-testid={field.testId}
          />
        </div>
      );

    case "select":
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <Controller
            control={control}
            name={rhfId}
            render={({ field: rhf }) => (
              <Select value={(rhf.value as string) ?? ""} onValueChange={rhf.onChange}>
                <SelectTrigger data-testid={field.testId}>
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {(field.options ?? []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      );

    case "multicheck":
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <Controller
            control={control}
            name={rhfId}
            render={({ field: rhf }) => {
              const current = Array.isArray(rhf.value) ? (rhf.value as string[]) : [];
              return (
                <div className="flex flex-wrap gap-4">
                  {(field.checkOptions ?? []).map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${field.id}-${opt.value}`}
                        checked={current.includes(opt.value)}
                        onCheckedChange={(checked) =>
                          rhf.onChange(
                            checked ? [...current, opt.value] : current.filter((x) => x !== opt.value),
                          )
                        }
                      />
                      <Label htmlFor={`${field.id}-${opt.value}`} className="cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              );
            }}
          />
        </div>
      );

    case "url": {
      const state: UrlValidationState = field.urlValidator
        ? field.urlValidator((watch(rhfId) as string) ?? "")
        : "idle";
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <div className="flex items-center gap-2">
            <Input {...register(rhfId)} placeholder={field.placeholder} data-testid={field.testId} />
            <UrlIcon state={state} />
          </div>
        </div>
      );
    }

    case "date":
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <Controller
            control={control}
            name={rhfId}
            render={({ field: rhf }) => (
              <DatePickerField
                value={(rhf.value as string) ?? ""}
                onChange={rhf.onChange}
                placeholder={field.placeholder ?? "Selecione a data"}
                data-testid={field.testId}
              />
            )}
          />
        </div>
      );

    case "contatos-crm":
      return (
        <div key={field.id} className={span}>
          <Controller
            control={control}
            name={rhfId}
            render={({ field: rhf }) => (
              <TeamContactsCRM
                value={Array.isArray(rhf.value) ? (rhf.value as ArtistFormValues["contatosVinculados"]) : []}
                onChange={rhf.onChange}
              />
            )}
          />
        </div>
      );

    case "distribuidoras":
      return (
        <div key={field.id} className={`space-y-4 ${span}`}>
          <Controller
            control={control}
            name={rhfId}
            render={({ field: rhf }) => (
              <DistributorsField
                value={Array.isArray(rhf.value) ? (rhf.value as DistributorEntry[]) : []}
                onChange={rhf.onChange}
              />
            )}
          />
        </div>
      );

    default:
      return (
        <div key={field.id} className={`space-y-2 ${span}`}>
          <FieldLabel field={field} />
          <Input
            {...register(rhfId)}
            type={field.type === "email" ? "email" : "text"}
            placeholder={field.placeholder}
            data-testid={field.testId}
          />
        </div>
      );
  }
}

// ─── Props ────────────────────────────────────────────────────────

interface ArtistFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  artist?: Artist | null;
}

// ─── Component ───────────────────────────────────────────────────

export function ArtistFormModal({ open, onOpenChange, onSuccess, artist }: ArtistFormModalProps) {
  const isEditing = !!artist;
  const { addArtist, updateArtist } = useArtists();
  const { addCliente } = useClientes();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Task: CAS 409 espúrio — o modal recebia `artist` como snapshot congelado
  // da listagem (pode estar desatualizado: staleTime da lista, tempo com a
  // aba em segundo plano, etc.). Buscar a versão atual por ID ao abrir para
  // editar garante que o `expectedUpdatedAt` do CAS reflita o registro real
  // no momento da edição, não o que a lista tinha cacheado. `staleTime: 0`
  // força refetch a cada abertura do modal (nunca reaproveita uma busca
  // anterior da mesma sessão).
  // `api.get` fala com o backend real (contrato PT, GET /artists/:id) —
  // convertido para o modelo interno `Artist` (EN) via `wireToArtist`.
  const freshArtistQuery = useQuery({
    queryKey: ["artists", artist?.id, "edit-fresh"],
    queryFn: async () => wireToArtist(await api.get<ArtistWireRecord>(`/artists/${artist!.id}`)),
    enabled: open && isEditing && !!artist?.id,
    staleTime: 0,
    gcTime: 0,
  });

  // Task: campos do formulário vinham de `artist` (snapshot da listagem)
  // enquanto só o expectedUpdatedAt vinha da versão fresca — permitia CAS
  // passar (comparando com a versão real do banco) enquanto o PATCH ainda
  // carregava campos antigos por cima de uma edição concorrente já salva.
  // `hydratedArtist` fixa a MESMA versão para os dois: é o exato objeto do
  // GET usado para hidratar o formulário, e é o que fornece expectedUpdatedAt
  // no submit — nunca duas fontes independentes.
  const [hydratedArtist, setHydratedArtist] = useState<Artist | null>(null);

  // ── Non-form state ──────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<Record<FileFieldId, UploadedFile[]>>({
    fotoUrl: [], documentosPessoaisUrl: [], presskitUrl: [],
  });
  const setFile = (id: FileFieldId, value: UploadedFile[]) =>
    setFiles((prev) => ({ ...prev, [id]: value }));

  // Campos preservados em round-trip (métricas, modelo legado, contrato…)
  const [preserved, setPreserved] = useState<ArtistPreservedInput>(emptyPreservedInput());
  // Legado: contatos de equipe embutidos (round-trip intacto; o painel usa linkedContacts)
  const [teamContacts, setTeamContacts] = useState<Artist["teamContacts"]>([]);

  // ── react-hook-form (schema GERADO da definição do formulário) ──
  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(artistSchema),
    defaultValues: emptyArtistFormValues(),
  });
  const { register, control, watch, reset, handleSubmit: rhfSubmit } = form;

  const tipoPerfilVal = watch("tipoPerfil");

  // ── Hidrata o formulário a partir de UMA versão (fonte única) ────
  // MESMA hidratação canônica usada pela exportação (definição única).
  const hydrateForm = (source: Artist | null) => {
    const v = artistToFormValues(source);
    const { fotoUrl, documentosPessoaisUrl, presskitUrl, ...formValues } = v;
    reset(formValues);

    setPreserved(artistToPreservedInput(source));
    setTeamContacts(Array.isArray(source?.teamContacts) ? source.teamContacts : []);

    setFiles({
      fotoUrl: fotoUrl
        ? [{ url: fotoUrl, name: "foto", size: 0, type: "image/*", path: "" }]
        : [],
      documentosPessoaisUrl: documentosPessoaisUrl
        ? [{ name: "documento.pdf", size: 0, type: "application/pdf", path: documentosPessoaisUrl, url: documentosPessoaisUrl }]
        : [],
      presskitUrl: presskitUrl
        ? [{ name: "presskit.pdf", size: 0, type: "application/pdf", path: presskitUrl, url: presskitUrl }]
        : [],
    });

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }, 50);
  };

  // ── Load artist data on open ────────────────────────────────────
  // Modo criação: hidrata direto (nada para buscar).
  // Modo edição: só hidrata quando a versão fresca (GET /artists/:id) chega,
  // e só a PRIMEIRA vez por artista/abertura — `artist` (prop da listagem)
  // serve só para identificar o ID/loading visual antes disso, nunca para
  // preencher campos. Um refetch em segundo plano (ex.: refocus da aba) NÃO
  // deve chamar reset() de novo e apagar o que o usuário já digitou — por
  // isso o guard compara com `hydratedArtist?.id`, não reage a toda mudança
  // de `freshArtistQuery.data`.
  useEffect(() => {
    if (!open) {
      setHydratedArtist(null);
      return;
    }
    if (!isEditing) {
      hydrateForm(null);
      return;
    }
    if (!freshArtistQuery.data) return;
    if (hydratedArtist?.id === freshArtistQuery.data.id) return;

    hydrateForm(freshArtistQuery.data);
    setHydratedArtist(freshArtistQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, artist?.id, freshArtistQuery.data]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset(emptyArtistFormValues());
    onOpenChange(nextOpen);
  };

  // ── Submit ──────────────────────────────────────────────────────
  const onSubmit = async (values: ArtistFormValues) => {
    setIsSubmitting(true);
    try {
      const allValues: ArtistFormAllValues = {
        ...values,
        fotoUrl:               files.fotoUrl[0]?.url ?? "",
        documentosPessoaisUrl: files.documentosPessoaisUrl[0]?.url ?? "",
        presskitUrl:           files.presskitUrl[0]?.url ?? "",
      };

      // MESMA conversão canônica usada pela importação (definição única).
      const payload = formValuesToArtistPayload(allValues, preserved);

      // Pass-through de campos do Perfil 360 que não pertencem a este formulário
      // (Task AA: as três seções descontinuadas do cadastro/edição de artista
      // coletavam galleryUrls, manager*Legacy, executiveProducer, bookingAgency
      // e partnerLabel — nenhuma delas é mais coletada aqui. Omiti-las do
      // payload preserva o valor já existente no backend (update() só toca
      // colunas presentes no DTO — ver artists.service.ts), em vez de zerá-las).
      const passThrough = {
        teamContacts: teamContacts && teamContacts.length > 0 ? teamContacts : null,
      };

      if (isEditing) {
        try {
          await updateArtist.mutateAsync({
            id: artist!.id, ...payload, ...passThrough,
            contractId: preserved.contratoId || null,
            expectedUpdatedAt: getExpectedUpdatedAt(hydratedArtist),
          });
        } catch (err) {
          if (handleConcurrencyConflict(err, "artista")) return;
          throw err;
        }
      } else {
        await addCliente.mutateAsync({
          tipo_pessoa: "pessoa_fisica" as const,
          nome:        values.nomeArtistico.trim(),
          cpf_cnpj:    values.cpfCnpj.trim() || null,
          responsavel: values.nome.trim() || null,
          email:       values.email.trim() || null,
          telefone:    values.telefone.trim() || null,
          endereco:    values.endereco.trim() || null,
          cidade:      null as string | null,
          estado:      null as string | null,
          observacoes: values.biografia.trim() || null,
          status:      "active",
        });
        await addArtist.mutateAsync({
          ...payload, ...passThrough,
          contractId: preserved.contratoId || null,
        });
      }
      handleClose(false);
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: FieldErrors<ArtistFormValues>) => {
    const first = Object.values(errors).find(
      (e): e is { message: string } => typeof (e as { message?: unknown })?.message === "string",
    );
    if (first) toast.error(first.message);
  };

  const rendererCtx: FieldRendererCtx = { register, control, watch, files, setFile, artistId: artist?.id };
  const currentValues = watch();

  // ── JSX (seções e campos iterados da definição única) ──────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditing ? "Editar Artista" : "Novo Artista"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do artista." : "Preencha os dados do artista."}
            {" "}Campos com <span className="text-destructive">*</span> são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-8">
            {ARTIST_FORM_SECTIONS.map((section) => {
              if (section.visibleWhen && !section.visibleWhen(currentValues)) return null;
              return (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                  </div>
                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    {section.fields.map((field) => renderArtistField(field, rendererCtx))}
                  </div>

                  {section.id === "perfis-redes" && (
                    <p className="text-xs text-muted-foreground">
                      Cole as URLs públicas. O sistema extrai automaticamente os identificadores
                      do Spotify e YouTube para buscar métricas reais.
                      {" "}Ícone <CheckCircle2 className="inline h-3 w-3 text-green-500" /> = URL válida.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            data-testid="button-cancelar-modal"
          >
            Cancelar
          </Button>
          <Button
            onClick={rhfSubmit(onSubmit, onInvalid)}
            disabled={isSubmitting || (isEditing && !hydratedArtist)}
            className="gap-2"
            data-testid="button-salvar-modal"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing && !hydratedArtist ? "Carregando versão atual…" : isEditing ? "Salvar Alterações" : "Criar Artista"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
