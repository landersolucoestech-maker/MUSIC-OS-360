/**
 * Marketing - Calendario de Conteudo.
 */

import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import {
  Bookmark,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Link2,
  Lock,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Repeat2,
  Search,
  Send,
  Share2,
  ThumbsUp,
  Upload,
  X,
} from "lucide-react";
import {
  SiFacebook,
  SiInstagram,
  SiThreads,
  SiTiktok,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { fetchAllLabels } from "@/shared/lib/fetch-all-labels";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { useUploadToR2 } from "@/shared/hooks/useUploadToR2";
import { useMarketingOAuth } from "@/modules/integrations/hooks/useMarketingOAuth";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { cn } from "@/shared/lib/utils";
import { MarketingCalendarView, ALL_FILTER, type MarketingCalendarViewMode } from "../components";
import { useProjectAssetLibrary } from "../hooks/useMarketingAssets";
import { useCreateContent, useMarketingContents, useUpdateContent } from "../hooks/useMarketingContents";
import { CONTENT_STATUS_OPTIONS } from "../constants/marketing.constants";
import { conteudoSchema } from "../forms/conteudo-schema";
import {
  ASPECT_CLASS,
  PREVIEW_PLATFORM_NAME,
  PUBLISH_PLATFORMS,
  acceptAttr,
  ensureValidType,
  getFormatSpec,
  getPlatformFormats,
  type FormatSpec,
  type PreviewChrome,
  type SocialPlatform,
} from "../config/social-formats";
import type { ContentChannel, ContentStatus, ContentType, MarketingContent, MarketingTarget } from "../types/marketing.types";
import type { MarketingAsset } from "../types/marketing.types";
import {
  NEWS_LANDER_RECORDS_TEMPLATE,
  type CreativeConfig,
  type CreativeSlot,
} from "../types/creative.types";
import { CreativeTemplateSurface } from "./creative-template-surface";
import {
  initialContentForm,
  toMarketingContentInput,
  type ContentFormValues,
  type MediaItem,
} from "./content-form.mapper";

/** Contexto do conteúdo — exclusivamente Empresa e Artista. */
const CONTENT_CONTEXT_OPTIONS: { value: MarketingTarget; label: string }[] = [
  { value: "empresa", label: "Empresa" },
  { value: "artista", label: "Artista" },
];

/** Type filter shown in the toolbar (covers every supported format). */
const FILTER_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "post", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "stories", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "shorts", label: "Shorts" },
  { value: "video", label: "Vídeo" },
];

type ContentScheduleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData: MarketingContent | null;
  submitting: boolean;
  onSubmit: (values: ContentFormValues) => void;
};

export default function Calendario() {
  const { data: contents = [], isLoading } = useMarketingContents();
  const createContent = useCreateContent();
  const updateContent = useUpdateContent();

  const [view, setView] = useState<MarketingCalendarViewMode>("semana");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [channelFilter, setChannelFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedContent, setSelectedContent] = useState<MarketingContent | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contents.filter((content) => {
      const text = `${content.title} ${content.targetName ?? ""} ${content.copy ?? ""}`.toLowerCase();
      if (term && !text.includes(term)) return false;
      if (channelFilter !== ALL_FILTER && content.channel !== channelFilter) return false;
      if (typeFilter !== ALL_FILTER && content.type !== typeFilter) return false;
      if (statusFilter !== ALL_FILTER && content.status !== statusFilter) return false;
      return true;
    });
  }, [contents, search, channelFilter, typeFilter, statusFilter]);

  const metricas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);

    const agendados = contents.filter((content) => content.status === "agendado").length;
    const publicados = contents.filter((content) => content.status === "publicado").length;
    const proximos7Dias = contents.filter((content) => {
      if (!content.publishDate) return false;
      const data = new Date(content.publishDate);
      if (Number.isNaN(data.getTime())) return false;
      data.setHours(0, 0, 0, 0);
      return data >= hoje && data <= limite;
    }).length;

    return { total: contents.length, agendados, publicados, proximos7Dias };
  }, [contents]);

  const periodLabel = formatPeriodLabel(view, referenceDate);

  const shiftPeriod = (delta: number) => {
    setReferenceDate((prev) => shiftDate(prev, view, delta));
  };

  const openCreate = () => {
    setSelectedContent(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (content: MarketingContent) => {
    setSelectedContent(content);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleSubmit = (values: ContentFormValues) => {
    const payload = toMarketingContentInput(values, selectedContent ?? undefined);

    if (modalMode === "edit" && selectedContent) {
      updateContent.mutate(
        { id: selectedContent.id, patch: payload, expectedUpdatedAt: getExpectedUpdatedAt(selectedContent) },
        { onSuccess: () => setModalOpen(false) },
      );
      return;
    }

    createContent.mutate(payload, { onSuccess: () => setModalOpen(false) });
  };

  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout
        title="Marketing - Calendário de Conteúdo"
        description="Programação de conteúdos"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo Conteúdo
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Conteúdos" value={metricas.total} description="no total" icon={CalendarDays} accent="primary" />
            <MetricCard title="Agendados" value={metricas.agendados} description="aguardando publicação" icon={Clock} accent="warning" />
            <MetricCard title="Publicados" value={metricas.publicados} description="conteúdos publicados" icon={CheckCircle2} accent="success" />
            <MetricCard title="Próximos 7 dias" value={metricas.proximos7Dias} description="na próxima semana" icon={CalendarClock} accent="primary" />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-3">
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => setReferenceDate(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(-1)} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(1)} aria-label="Próximo período">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="min-w-[132px] px-1 text-sm font-medium text-muted-foreground">{periodLabel}</span>

            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conteúdo..."
                className="h-8 pl-9"
              />
            </div>

            <ToolbarSelect
              value={view}
              onValueChange={(value) => setView(value as MarketingCalendarViewMode)}
              options={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
                { value: "mes", label: "Mês" },
                { value: "ano", label: "Ano" },
              ]}
              className="w-[100px]"
            />
            <ToolbarSelect
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={[{ value: ALL_FILTER, label: "Todos os tipos" }, ...FILTER_TYPE_OPTIONS]}
              className="w-[132px]"
            />
            <ToolbarSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[{ value: ALL_FILTER, label: "Todos os status" }, ...CONTENT_STATUS_OPTIONS]}
              className="w-[132px]"
            />
            <ToolbarSelect
              value={channelFilter}
              onValueChange={setChannelFilter}
              options={[{ value: ALL_FILTER, label: "Todas plataformas" }, ...PUBLISH_PLATFORMS]}
              className="w-[132px]"
            />
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
              Carregando calendário...
            </div>
          ) : (
            <MarketingCalendarView view={view} referenceDate={referenceDate} contents={filtered} onSelect={openEdit} />
          )}
        </div>

        <ContentScheduleModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          mode={modalMode}
          initialData={selectedContent}
          submitting={createContent.isPending || updateContent.isPending}
          onSubmit={handleSubmit}
        />
      </MainLayout>
    </FeatureGate>
  );
}

function ToolbarSelect({
  value,
  onValueChange,
  options,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContentScheduleModal({
  open,
  onOpenChange,
  mode,
  initialData,
  submitting,
  onSubmit,
}: ContentScheduleModalProps) {
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [values, setValues] = useState<ContentFormValues>(() => initialContentForm(initialData));
  const [errors, setErrors] = useState<Partial<Record<keyof ContentFormValues, string>>>({});
  // Campo `targetName` guarda o NOME (não o id) filtrado client-side no
  // <Select> abaixo — fetchAllLabels (paginação real, sem cap) substitui
  // useArtistas() (capada a 50/tenant) para nunca perder um artista.
  const { data: artistOptions = [] } = useQuery({
    queryKey: ["marketing-calendar-artist-names"],
    queryFn: () => fetchAllLabels("artistas", (a) => (a.nome_artistico ?? a.nome) as string | undefined),
  });
  const { getConnectionsByCategory } = useMarketingOAuth();

  // Regra ITEM 6: apenas conteúdo de Empresa pode publicar via integração.
  const isEmpresa = values.targetType === "empresa";
  // Contas corporativas conectadas (publicação via integrações autorizadas).
  const integratedAccounts = getConnectionsByCategory("corporate_metrics").filter((c) => c.connected);
  const contextLabel = "Artista";

  useEffect(() => {
    if (open) {
      setValues(initialContentForm(initialData));
      setErrors({});
      setAdvancedOpen(true);
    }
  }, [initialData, open]);

  const spec = getFormatSpec(values.channel, values.type);
  const projectAssetLibrary = useProjectAssetLibrary(values.releaseId);

  const setValue = <K extends keyof ContentFormValues>(key: K, value: ContentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleTargetTypeChange = (targetType: MarketingTarget) => {
    setValues((prev) => ({
      ...prev,
      targetType,
      targetName: targetType === "empresa" ? "Empresa" : "",
      releaseId: "none",
      // Conteúdo não-Empresa é apenas agendamento interno: zera publicação/integração.
      status: targetType === "empresa" ? prev.status : "agendado",
      integratedAccountId: targetType === "empresa" ? prev.integratedAccountId : "none",
    }));
    setErrors((prev) => ({ ...prev, targetType: undefined, targetName: undefined, integratedAccountId: undefined }));
  };

  /**
   * Seleção MÚLTIPLA de plataformas: alterna a plataforma mantendo as demais.
   * A primeira plataforma da lista é a principal (dirige formato/preview/type).
   * Nunca remove outras ao adicionar; nunca substitui automaticamente; nunca fica vazia.
   */
  const togglePlatform = (platform: SocialPlatform) => {
    setValues((prev) => {
      const has = prev.channels.includes(platform);
      let channels = has
        ? prev.channels.filter((item) => item !== platform)
        : [...prev.channels, platform];
      if (channels.length === 0) channels = [platform];
      const channel = channels.includes(prev.channel) ? prev.channel : channels[0];
      const type = ensureValidType(channel, prev.type);
      const nextSpec = getFormatSpec(channel, type);
      const media = nextSpec?.multiple ? prev.media : prev.media.slice(0, 1);
      return { ...prev, channels, channel, type, media };
    });
    setErrors((prev) => ({ ...prev, channels: undefined, type: undefined }));
  };

  /** Content type is the single source of truth for the publication format. */
  const handleTypeChange = (next: ContentType) => {
    setValues((prev) => {
      const nextSpec = getFormatSpec(prev.channel, next);
      const media = nextSpec?.multiple ? prev.media : prev.media.slice(0, 1);
      return { ...prev, type: next, media };
    });
    setErrors((prev) => ({ ...prev, type: undefined, media: undefined }));
  };

  const { upload: uploadToR2 } = useUploadToR2();

  /**
   * blob: URLs are LOCAL-ONLY preview handles -- they never survive a page
   * reload and must never be persisted (they'd 404 for every other viewer
   * immediately). Each file gets an instant local-preview item (marked
   * `uploading`) for responsive UX, then is uploaded to R2 in the background;
   * once the permanent URL comes back, it replaces the blob: URL in place. A
   * failed upload removes its item and surfaces the error instead of leaving
   * a dead blob: URL behind.
   */
  const handleMedia = (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    const incoming: MediaItem[] = files.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name,
      kind: file.type,
      uploading: true,
    }));
    setValues((prev) => {
      const next = spec?.multiple ? [...prev.media, ...incoming] : incoming.slice(0, 1);
      return { ...prev, media: next };
    });
    setErrors((prev) => ({ ...prev, media: undefined }));

    files.forEach((file, i) => {
      const localUrl = incoming[i].url;
      const category = file.type.startsWith("video/") ? "videos" : "images";
      uploadToR2({ file, category, entity: "marketing_content" })
        .then((publicUrl) => {
          setValues((prev) => ({
            ...prev,
            media: prev.media.map((item) => (item.url === localUrl ? { ...item, url: publicUrl, uploading: false } : item)),
          }));
          URL.revokeObjectURL(localUrl);
        })
        .catch((err: unknown) => {
          setValues((prev) => ({ ...prev, media: prev.media.filter((item) => item.url !== localUrl) }));
          URL.revokeObjectURL(localUrl);
          setErrors((prev) => ({ ...prev, media: err instanceof Error ? err.message : "Falha no upload da mídia." }));
        });
    });
  };

  const removeMedia = (index: number) => {
    setValues((prev) => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }));
  };

  const selectProducedAsset = (asset: MarketingAsset) => {
    if (!asset.url) return;
    const incoming: MediaItem = {
      url: asset.url,
      name: asset.name,
      kind: inferMediaKind(asset),
    };
    setValues((prev) => {
      const media = spec?.multiple ? [...prev.media, incoming] : [incoming];
      return { ...prev, media };
    });
    setErrors((prev) => ({ ...prev, media: undefined }));
  };

  /**
   * Finaliza o conteúdo aplicando a regra de publicação (ITEM 6):
   *  - publish=true só é permitido para Empresa e exige conta integrada → status "publicado".
   *  - caso contrário → status "agendado" (agendamento interno).
   */
  const finalize = (publish: boolean) => {
    // "Publicar via Integração" (ITEM 6) precisa entrar na fila real de
    // publicação (scheduleIfNeeded só dispara para status "agendado" — ver
    // marketing-contents.service.ts) para efetivamente tentar publicar via
    // MarketingPublishingProcessor. Setar "publicado" diretamente aqui pulava
    // a fila inteira: o conteúdo ficava marcado como publicado sem que
    // nenhuma chamada real à plataforma jamais acontecesse. delay=0 quando
    // scheduled_for já passou/é agora, então isto ainda publica imediatamente
    // quando a data/hora escolhida é "agora".
    const nextStatus: ContentStatus = !isEmpresa
      ? "agendado"
      : publish
        ? "agendado"
        : values.status;
    const nextValues: ContentFormValues = { ...values, status: nextStatus };

    const parsed = conteudoSchema.safeParse(nextValues);
    if (!parsed.success) {
      const next: Partial<Record<keyof ContentFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContentFormValues | undefined;
        if (key) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    if (publish && isEmpresa && values.integratedAccountId === "none") {
      setErrors((prev) => ({ ...prev, integratedAccountId: "Selecione a conta integrada para publicar." }));
      return;
    }

    if (values.media.some((item) => item.uploading)) {
      setErrors((prev) => ({ ...prev, media: "Aguarde o upload da mídia terminar." }));
      return;
    }

    // Template mode has no render/export pipeline yet (see PreviewFrame's
    // template surface) -- an actual external publish would ship an empty
    // `files` (no rendered artifact exists), so that specific action is
    // blocked with a clear reason. Saving/internal-scheduling the creative
    // CONFIGURATION is still allowed (files stays empty/untouched until a
    // real render exists) so the work itself is never lost, matching
    // section 56's "complete what's independently safe" allowance.
    if (values.creative.mode === "template" && publish) {
      setErrors((prev) => ({
        ...prev,
        media: "Renderização do criativo (Template) ainda não está disponível nesta versão — não é possível publicar via integração sem uma mídia final renderizada. A configuração pode ser salva normalmente.",
      }));
      return;
    }

    setErrors({});
    onSubmit(nextValues);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    finalize(false);
  };

  const typeOptions = getPlatformFormats(values.channel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Safe top/bottom breathing room on tall viewports (dvh-based so mobile
          browser chrome doesn't clip it): was max-h-[90vh], which on a short
          viewport or with the dev auth banner visible left the modal nearly
          flush against the top edge.
          `flex flex-col` overrides dialog.tsx's base `grid`: a grid parent
          only gives max-height (not height), and a percentage height (the
          form's old `max-h-full`) can't resolve against an indefinite-height
          ancestor -- it computes to `none` per spec, so nothing downstream
          ever actually shrank and overflow got silently hard-clipped by this
          element's own `overflow-hidden` instead of scrolling. A flex column
          gives the form a real flex-basis to shrink against, so its own
          `min-h-0 flex-1` content region (below) can actually engage
          `overflow-y-auto` once content exceeds the available height. */}
      <DialogContent className="flex max-h-[calc(100dvh-4rem)] max-w-[760px] flex-col overflow-hidden p-0">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{mode === "edit" ? "Editar Conteúdo" : "Novo Conteúdo"}</DialogTitle>
            <DialogDescription>Agende e configure um conteúdo de marketing.</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[300px_1fr]">
            <ContentPreview
              values={values}
              spec={spec}
              onMediaChange={handleMedia}
              onRemoveMedia={removeMedia}
              onSelectAsset={selectProducedAsset}
              projectAssets={projectAssetLibrary.data ?? []}
              projectAssetsLoading={projectAssetLibrary.isLoading}
              mediaError={errors.media}
            />

            <div className="space-y-3.5 border-t border-border p-4 md:border-l md:border-t-0">
              <div>
                <h2 className="text-base font-semibold">{mode === "edit" ? "Editar Conteúdo" : "Novo Conteúdo"}</h2>
              </div>

              <FieldBlock label="Título" required error={errors.title} counter={`${values.title.length}/100`}>
                <Input
                  data-testid="input-title"
                  value={values.title}
                  maxLength={100}
                  onChange={(event) => setValue("title", event.target.value)}
                  placeholder="Ex: Post de lançamento do novo single"
                />
              </FieldBlock>

              <div className="grid gap-2 sm:grid-cols-2">
                <FieldBlock label="Contexto" required error={errors.targetType}>
                  <Select value={values.targetType} onValueChange={(value) => handleTargetTypeChange(value as MarketingTarget)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_CONTEXT_OPTIONS.map((target) => (
                        <SelectItem key={target.value} value={target.value}>
                          {target.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldBlock>
                {!isEmpresa && (
                  <FieldBlock label="Artista" required error={errors.targetName}>
                    <Select value={values.targetName} onValueChange={(value) => setValue("targetName", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o artista" />
                      </SelectTrigger>
                      <SelectContent>
                        {artistOptions.map((artist) => (
                          <SelectItem key={artist.value} value={artist.value}>
                            {artist.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                )}
              </div>

              <FieldBlock label="Plataformas (publicação multiplataforma)" required error={errors.channels}>
                <div className="flex flex-wrap gap-1.5" data-testid="select-plataforma">
                  {PUBLISH_PLATFORMS.map((option) => {
                    const active = values.channels.includes(option.value);
                    const isPrimary = values.channel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => togglePlatform(option.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/40",
                        )}
                        aria-pressed={active}
                      >
                        <PlatformIcon channel={option.value} />
                        {option.label}
                        {isPrimary && active && (
                          <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold uppercase">principal</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Selecione uma ou mais plataformas. A primeira (principal) define o formato e a prévia.
                </p>
              </FieldBlock>

              <FieldBlock label="Tipo de conteudo" required error={errors.type}>
                <Select value={values.type} onValueChange={(value) => handleTypeChange(value as ContentType)}>
                  <SelectTrigger data-testid="select-type-conteudo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.type} value={option.type}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>

              {spec && (
                <p className="text-[11px] text-muted-foreground">{formatHint(spec)}</p>
              )}

              <CreativeSection
                creative={values.creative}
                onChange={(creative) => setValue("creative", creative)}
                uploadToR2={uploadToR2}
                projectAssets={projectAssetLibrary.data ?? []}
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <FieldBlock label="Data" required error={errors.publishDate}>
                  <DatePickerField
                    data-testid="input-data-publicação"
                    value={values.publishDate}
                    onChange={(date) => setValue("publishDate", date)}
                    placeholder="Selecionar data"
                  />
                </FieldBlock>

                <FieldBlock label="Hora" required error={errors.publishTime}>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      data-testid="input-horário"
                      type="time"
                      value={values.publishTime}
                      onChange={(event) => setValue("publishTime", event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </FieldBlock>
              </div>

              <FieldBlock label="Legenda / Copy" required error={errors.copy} counter={`${values.copy.length}/2200`}>
                <Textarea
                  data-testid="input-legenda"
                  value={values.copy}
                  maxLength={2200}
                  onChange={(event) => setValue("copy", event.target.value)}
                  placeholder="Escreva a legenda da publicação..."
                  className="min-h-[80px]"
                />
              </FieldBlock>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 w-full justify-between px-3 text-xs">
                    Configurações avançadas
                    <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3 rounded-lg border border-border p-3">
                  {isEmpresa ? (
                    <>
                      <FieldBlock
                        label="Conta integrada (publicação)"
                        error={errors.integratedAccountId}
                      >
                        {integratedAccounts.length > 0 ? (
                          <Select
                            value={values.integratedAccountId}
                            onValueChange={(value) => setValue("integratedAccountId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a conta integrada" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma (apenas agendar)</SelectItem>
                              {integratedAccounts.map((account) => (
                                <SelectItem key={account.platform} value={account.platform}>
                                  {account.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                            <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            Nenhuma conta integrada conectada. Conecte uma conta corporativa em
                            Marketing → Integrações para publicar via integração.
                          </p>
                        )}
                      </FieldBlock>

                      <FieldBlock label="Status">
                        <Select value={values.status} onValueChange={(value) => setValue("status", value as ContentStatus)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Conteúdo de {contextLabel}: apenas agendamento interno. A publicação
                      automática/direta via integrações é exclusiva de conteúdos da Empresa.
                    </p>
                  )}

                  <FieldBlock label="Campanha relacionada">
                    <Input
                      value={values.campaignId === "none" ? "" : values.campaignId}
                      onChange={(event) => setValue("campaignId", event.target.value || "none")}
                      placeholder="Nome da campanha..."
                    />
                  </FieldBlock>

                  <FieldBlock label="Hashtags">
                    <Input
                      value={values.hashtags}
                      onChange={(event) => setValue("hashtags", event.target.value)}
                      placeholder="#musica #lançamento..."
                    />
                  </FieldBlock>

                  <FieldBlock label="Localização">
                    <Input
                      value={values.location}
                      onChange={(event) => setValue("location", event.target.value)}
                      placeholder="Ex: São Paulo, Brasil"
                    />
                  </FieldBlock>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background p-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-9 sm:w-[204px]" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={isEmpresa ? "outline" : "default"}
              className="h-9 sm:w-[204px]"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Salvar Agendamento" : "Agendar Conteúdo"}
            </Button>
            {isEmpresa && (
              <Button
                type="button"
                className="h-9 sm:w-[204px]"
                disabled={submitting || values.integratedAccountId === "none"}
                onClick={() => finalize(true)}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Publicar via Integração
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatHint(spec: FormatSpec): string {
  const mediaLabel =
    spec.media === "image" ? "imagem" : spec.media === "video" ? "vídeo" : "imagem ou vídeo";
  if (spec.multiple) return `Carrossel • múltiplas mídias (${mediaLabel}) • ${spec.aspect}`;
  return `${spec.label} • ${mediaLabel} único • ${spec.aspect}`;
}

function inferMediaKind(asset: MarketingAsset): string {
  const category = asset.category.toLowerCase();
  if (category.includes("video") || category.includes("reels") || category.includes("shorts") || category.includes("teaser")) {
    return "video/mp4";
  }
  return "image/jpeg";
}

function AssetThumb({ asset }: { asset: MarketingAsset }) {
  const src = asset.thumbnailUrl ?? asset.url;
  if (inferMediaKind(asset).startsWith("image/") && src) {
    return <img src={src} alt="" className="h-8 w-8 rounded object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded bg-card text-foreground">
      <Play className="h-3.5 w-3.5" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Criativo (creative editor — Template mode layered onto the existing modal)
// ---------------------------------------------------------------------------

type UploadFn = (opts: { file: File; category: "images" | "videos"; entity?: string }) => Promise<string>;

type CreativeSlotField = "primarySlot" | "secondarySlot" | "profileAvatar";

/** One upload-or-thumbnail control, shared by every media/avatar/watermark
 * field in the Criativo panel instead of duplicating the same upload+preview
 * JSX four times. */
function MediaSlotControl({
  slot,
  onUpload,
  onRemove,
  uploading,
  accept,
  label,
  placeholder,
  circular,
}: {
  slot: CreativeSlot | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
  accept: string;
  label: string;
  placeholder: string;
  circular?: boolean;
}) {
  if (slot) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 p-1.5">
        {slot.kind === "image" ? (
          <img src={slot.assetUrl} alt="" className={cn("h-9 w-9 object-cover", circular ? "rounded-full" : "rounded")} />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded bg-card"><Play className="h-4 w-4" /></span>
        )}
        <span className="flex-1 truncate text-[11px] text-muted-foreground">{slot.assetUrl.split("/").pop()}</span>
        <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Remover ${label}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <label className="flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/60">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      <span>{uploading ? "Enviando..." : placeholder}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function CreativeSection({
  creative,
  onChange,
  uploadToR2,
  projectAssets,
}: {
  creative: CreativeConfig;
  onChange: (next: CreativeConfig) => void;
  uploadToR2: UploadFn;
  projectAssets: MarketingAsset[];
}) {
  const [uploadingField, setUploadingField] = useState<CreativeSlotField | "watermark" | null>(null);
  const isTemplate = creative.mode === "template";
  const isSplit = creative.layout === "split";

  const uploadSlot = (file: File, field: CreativeSlotField) => {
    setUploadingField(field);
    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    uploadToR2({ file, category: kind === "video" ? "videos" : "images", entity: "marketing_content_creative" })
      .then((assetUrl) => onChange({ ...creative, [field]: { assetUrl, kind }, renderState: "dirty" }))
      .finally(() => setUploadingField(null));
  };

  const uploadWatermark = (file: File) => {
    setUploadingField("watermark");
    uploadToR2({ file, category: "images", entity: "marketing_content_creative" })
      .then((assetUrl) => onChange({ ...creative, watermark: { ...creative.watermark, assetUrl }, renderState: "dirty" }))
      .finally(() => setUploadingField(null));
  };

  return (
    <FieldBlock label="Criativo">
      <div className="flex gap-1.5 rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => onChange({ ...creative, mode: "simple" })}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            !isTemplate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          Mídia simples
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...creative, mode: "template" })}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            isTemplate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          Template
        </button>
      </div>

      {isTemplate && (
        <div className="mt-2.5 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Categoria</Label>
            <Select value={creative.category} onValueChange={() => { /* single preset for now */ }}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEWS_LANDER_RECORDS_TEMPLATE.category}>{NEWS_LANDER_RECORDS_TEMPLATE.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t border-border pt-2.5">
            <p className="text-[11px] font-medium text-foreground">Perfil</p>
            <MediaSlotControl
              slot={creative.profileAvatar}
              onUpload={(file) => uploadSlot(file, "profileAvatar")}
              onRemove={() => onChange({ ...creative, profileAvatar: null, renderState: "dirty" })}
              uploading={uploadingField === "profileAvatar"}
              accept="image/*"
              label="avatar do perfil"
              placeholder="Selecionar avatar/logo"
              circular
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Nome do perfil</Label>
                <Input
                  value={creative.profileName}
                  onChange={(e) => onChange({ ...creative, profileName: e.target.value, renderState: "dirty" })}
                  placeholder="Ex: Lander Records"
                  maxLength={60}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Usuário</Label>
                <Input
                  value={creative.username}
                  onChange={(e) => onChange({ ...creative, username: e.target.value.replace(/^@+/, ""), renderState: "dirty" })}
                  placeholder="Ex: landerrecords"
                  maxLength={40}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-2.5">
            <Label className="text-[11px] text-muted-foreground">Legenda da notícia</Label>
            <Textarea
              value={creative.caption}
              onChange={(e) => onChange({ ...creative, caption: e.target.value, renderState: "dirty" })}
              placeholder="Texto principal da notícia..."
              maxLength={280}
              className="mt-1 min-h-[60px] text-xs"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-2.5">
            <Label className="text-[11px] text-muted-foreground">Layout da mídia</Label>
            <div className="flex gap-1.5 rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => onChange({ ...creative, layout: "full", renderState: "dirty" })}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  !isSplit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Completo
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...creative, layout: "split", renderState: "dirty" })}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  isSplit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Dividido
              </button>
            </div>

            {isSplit ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Mídia esquerda</Label>
                  <div className="mt-1">
                    <MediaSlotControl
                      slot={creative.primarySlot}
                      onUpload={(file) => uploadSlot(file, "primarySlot")}
                      onRemove={() => onChange({ ...creative, primarySlot: null, renderState: "dirty" })}
                      uploading={uploadingField === "primarySlot"}
                      accept="image/*,video/*"
                      label="mídia esquerda"
                      placeholder="Imagem ou vídeo"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Mídia direita</Label>
                  <div className="mt-1">
                    <MediaSlotControl
                      slot={creative.secondarySlot}
                      onUpload={(file) => uploadSlot(file, "secondarySlot")}
                      onRemove={() => onChange({ ...creative, secondarySlot: null, renderState: "dirty" })}
                      uploading={uploadingField === "secondarySlot"}
                      accept="image/*,video/*"
                      label="mídia direita"
                      placeholder="Imagem ou vídeo"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <MediaSlotControl
                slot={creative.primarySlot}
                onUpload={(file) => uploadSlot(file, "primarySlot")}
                onRemove={() => onChange({ ...creative, primarySlot: null, renderState: "dirty" })}
                uploading={uploadingField === "primarySlot"}
                accept="image/*,video/*"
                label="mídia principal"
                placeholder="Selecionar imagem ou vídeo"
              />
            )}

            {projectAssets.length > 0 && (
              <div className="grid max-h-24 gap-1 overflow-y-auto">
                {projectAssets.slice(0, 6).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onChange({
                      ...creative,
                      primarySlot: { assetUrl: asset.url, kind: inferMediaKind(asset).startsWith("video/") ? "video" : "image" },
                      renderState: "dirty",
                    })}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-left text-[11px] transition hover:border-primary/60 hover:bg-primary/5"
                  >
                    <AssetThumb asset={asset} />
                    <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Marca d'água</Label>
              <button
                type="button"
                role="switch"
                aria-checked={creative.watermark.enabled}
                onClick={() => onChange({ ...creative, watermark: { ...creative.watermark, enabled: !creative.watermark.enabled }, renderState: "dirty" })}
                className={cn("h-5 w-9 rounded-full transition-colors", creative.watermark.enabled ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("block h-4 w-4 translate-x-0.5 rounded-full bg-background transition-transform", creative.watermark.enabled && "translate-x-[18px]")} />
              </button>
            </div>
            {creative.watermark.enabled && (
              <MediaSlotControl
                slot={creative.watermark.assetUrl ? { assetUrl: creative.watermark.assetUrl, kind: "image" } : null}
                onUpload={uploadWatermark}
                onRemove={() => onChange({ ...creative, watermark: { ...creative.watermark, assetUrl: null }, renderState: "dirty" })}
                uploading={uploadingField === "watermark"}
                accept="image/*"
                label="marca d'água"
                placeholder="Selecionar marca d'água"
              />
            )}
          </div>

          <p className="rounded-md border border-dashed border-border bg-background/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
            A composição final (render/export) ainda não está disponível nesta versão — a configuração é salva e reaberta normalmente, mas agendar publicação via integração exige uma mídia final renderizada.
          </p>
        </div>
      )}
    </FieldBlock>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function ContentPreview({
  values,
  spec,
  onMediaChange,
  onRemoveMedia,
  onSelectAsset,
  projectAssets,
  projectAssetsLoading,
  mediaError,
}: {
  values: ContentFormValues;
  spec: FormatSpec | undefined;
  onMediaChange: (files: FileList | null) => void;
  onRemoveMedia: (index: number) => void;
  onSelectAsset: (asset: MarketingAsset) => void;
  projectAssets: MarketingAsset[];
  projectAssetsLoading: boolean;
  mediaError?: string;
}) {
  const [page, setPage] = useState(0);
  const media = values.media;

  useEffect(() => {
    setPage(0);
  }, [values.channel, values.type, media.length]);

  const platformName = PREVIEW_PLATFORM_NAME[values.channel];
  const headerLabel = `${platformName} ${spec?.label ?? ""}`.trim();
  const safePage = media.length ? Math.min(page, media.length - 1) : 0;
  const aspect = ASPECT_CLASS[spec?.aspect ?? "1:1"];
  const isTemplate = values.creative.mode === "template";
  const isCarousel = !isTemplate && !!spec?.carousel;

  const frame = (
    <PreviewFrame
      chrome={spec?.chrome ?? "ig-feed"}
      aspect={aspect}
      media={media}
      page={safePage}
      copy={values.copy}
      isCarousel={isCarousel}
      onPage={setPage}
      renderSurface={isTemplate ? () => <CreativeTemplateSurface creative={values.creative} /> : undefined}
    />
  );

  return (
    <aside className="bg-muted/30 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <PlatformIcon channel={values.channel} />
        <span>Prévia • {headerLabel}</span>
      </div>

      {frame}

      {isTemplate ? (
        <p className="mt-3 rounded-md border border-dashed border-border bg-background/50 p-2 text-[11px] text-muted-foreground">
          Mídia do criativo é gerenciada na seção "Criativo" ao lado — não aqui.
        </p>
      ) : (
      <div className="mt-3">
        {(projectAssetsLoading || projectAssets.length > 0) && (
          <div className="mb-3 rounded-lg border border-border bg-background/50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Ativos aprovados do projeto</p>
              {projectAssetsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid max-h-32 gap-1.5 overflow-y-auto">
              {projectAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset)}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs transition hover:border-primary/60 hover:bg-primary/5"
                >
                  <AssetThumb asset={asset} />
                  <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                  <span className="text-[10px]  text-muted-foreground">{asset.category}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mb-2 text-xs text-muted-foreground">
          {spec?.multiple ? "Adicionar mídias (carrossel)" : "Alterar mídia"}
        </p>
        <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/50 px-4 text-center text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground">
          <Upload className="mb-2 h-4 w-4" />
          <span>
            {spec?.multiple
              ? "Arraste ou clique para adicionar várias mídias"
              : "Arraste ou clique para fazer upload"}
          </span>
          <input
            type="file"
            accept={acceptAttr(spec?.media ?? "both")}
            multiple={spec?.multiple ?? false}
            className="sr-only"
            onChange={(event) => {
              onMediaChange(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {mediaError && <p className="mt-1.5 text-[11px] text-destructive">{mediaError}</p>}

        {media.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {media.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className={cn(
                  "group relative h-12 w-12 overflow-hidden rounded-md border",
                  index === safePage ? "border-primary" : "border-border",
                )}
              >
                {item.kind.startsWith("image/") ? (
                  <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-card text-foreground">
                    <Play className="h-4 w-4" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveMedia(index)}
                  className="absolute right-0.5 top-0.5 rounded bg-background/60 p-0.5 text-foreground opacity-0 transition group-hover:opacity-100"
                  aria-label="Remover mídia"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </aside>
  );
}

/** Renders the platform-accurate chrome around the current media. */
function PreviewFrame({
  chrome,
  aspect,
  media,
  page,
  copy,
  isCarousel,
  onPage,
  renderSurface,
}: {
  chrome: PreviewChrome;
  aspect: string;
  media: MediaItem[];
  page: number;
  copy: string;
  isCarousel: boolean;
  onPage: (page: number) => void;
  /** Template mode's creative surface replaces the plain media content, but the
   * platform chrome (Instagram/TikTok/YouTube frame) around it is unchanged. */
  renderSurface?: () => ReactNode;
}) {
  const current = media[page];
  const surface = (
    <div className={cn("relative w-full overflow-hidden bg-card", aspect)}>
      {renderSurface ? renderSurface() : <MediaContent item={current} />}
      {isCarousel && media.length > 1 && (
        <>
          <CarouselArrows
            page={page}
            count={media.length}
            onPrev={() => onPage(Math.max(0, page - 1))}
            onNext={() => onPage(Math.min(media.length - 1, page + 1))}
          />
          <div className="absolute right-2 top-2 rounded-full bg-background/55 px-2 py-0.5 text-[10px] font-medium text-foreground">
            {page + 1}/{media.length}
          </div>
        </>
      )}
    </div>
  );

  const dots = isCarousel && media.length > 1 ? <CarouselDots count={media.length} page={page} /> : null;

  switch (chrome) {
    case "ig-feed":
    case "fb-feed":
      return (
        <FeedChrome brand={chrome === "fb-feed" ? "facebook" : "instagram"} copy={copy} dots={dots}>
          {surface}
        </FeedChrome>
      );
    case "ig-story":
    case "fb-story":
      return <StoryChrome brand={chrome === "fb-story" ? "facebook" : "instagram"} copy={copy}>{surface}</StoryChrome>;
    case "ig-reel":
    case "fb-reel":
    case "tiktok":
    case "yt-shorts":
    case "x-vertical":
      return (
        <VerticalChrome variant={chrome} copy={copy}>
          {surface}
        </VerticalChrome>
      );
    case "yt-video":
      return <YouTubeChrome copy={copy}>{surface}</YouTubeChrome>;
    case "yt-post":
      return <YouTubePostChrome copy={copy} dots={dots}>{surface}</YouTubePostChrome>;
    case "x-feed":
      return <XChrome copy={copy} dots={dots}>{surface}</XChrome>;
    case "threads":
      return <ThreadsChrome copy={copy} dots={dots}>{surface}</ThreadsChrome>;
    default:
      return surface;
  }
}

function MediaContent({ item }: { item?: MediaItem }) {
  if (item?.kind.startsWith("image/")) {
    return <img src={item.url} alt="Prévia da mídia" className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (item?.kind.startsWith("video/")) {
    return <video src={item.url} className="absolute inset-0 h-full w-full object-cover" controls />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
        <Play className="h-8 w-8 text-primary" />
      </div>
    </div>
  );
}

function CarouselArrows({
  page,
  count,
  onPrev,
  onNext,
}: {
  page: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      {page > 0 && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/45 p-1 text-foreground hover:bg-background/65"
          aria-label="Mídia anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {page < count - 1 && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/45 p-1 text-foreground hover:bg-background/65"
          aria-label="Próxima mídia"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

function CarouselDots({ count, page }: { count: number; page: number }) {
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors",
            index === page ? "bg-primary" : "bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function PreviewAvatar({ className }: { className?: string }) {
  return <div className={cn("h-7 w-7 rounded-full border border-border bg-primary/15", className)} />;
}

function FeedChrome({
  brand,
  copy,
  dots,
  children,
}: {
  brand: "instagram" | "facebook";
  copy: string;
  dots: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <PreviewAvatar />
        <div className="leading-tight">
          <p className="text-xs font-semibold">suamarca</p>
          {brand === "facebook" && <p className="text-[10px] text-muted-foreground">Patrocinado</p>}
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
      {children}
      {dots}
      <div className="space-y-1.5 px-3 py-2">
        {brand === "instagram" ? (
          <div className="flex items-center gap-3 text-foreground">
            <Heart className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Send className="h-5 w-5" />
            <Bookmark className="ml-auto h-5 w-5" />
          </div>
        ) : (
          <div className="flex items-center gap-4 border-t border-border pt-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> Curtir</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Comentar</span>
            <span className="flex items-center gap-1"><Share2 className="h-4 w-4" /> Compartilhar</span>
          </div>
        )}
        {copy && (
          <p className="line-clamp-3 text-xs text-foreground">
            <span className="font-semibold">suamarca</span> {copy}
          </p>
        )}
      </div>
    </div>
  );
}

function StoryChrome({
  brand,
  copy,
  children,
}: {
  brand: "instagram" | "facebook";
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      {children}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-card/85 p-3">
        <div>
          <div className="mb-2 flex gap-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className="h-0.5 flex-1 rounded-full bg-muted">
                {index === 0 && <span className="block h-full w-1/2 rounded-full bg-white" />}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <PreviewAvatar className="h-6 w-6 ring-2 ring-white/80" />
            <span className="text-xs font-semibold text-foreground">suamarca</span>
            <span className="text-[10px] text-muted-foreground">{brand === "facebook" ? "Facebook" : "agora"}</span>
          </div>
        </div>
        {copy && <p className="line-clamp-2 text-xs font-medium text-foreground">{copy}</p>}
      </div>
    </div>
  );
}

function VerticalChrome({
  variant,
  copy,
  children,
}: {
  variant: "ig-reel" | "fb-reel" | "tiktok" | "yt-shorts" | "x-vertical";
  copy: string;
  children: ReactNode;
}) {
  const accent = variant === "yt-shorts" ? "text-red-500" : "text-foreground";
  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      {children}
      <div className="pointer-events-none absolute inset-0 flex bg-card/85">
        <div className="mt-auto flex-1 space-y-1 p-3">
          <div className="flex items-center gap-2">
            <PreviewAvatar className="h-6 w-6 ring-2 ring-white/80" />
            <span className="text-xs font-semibold text-foreground">@suamarca</span>
          </div>
          {copy && <p className="line-clamp-2 text-xs text-foreground">{copy}</p>}
          {variant === "tiktok" && (
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <SiTiktok className="h-3 w-3" /> som original • suamarca
            </p>
          )}
        </div>
        <div className="flex flex-col items-center justify-end gap-3 p-3 text-foreground">
          <SocialAction icon={Heart} className={accent} />
          <SocialAction icon={MessageCircle} />
          <SocialAction icon={Send} />
          <MoreHorizontal className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function YouTubeChrome({ copy, children }: { copy: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative">
        {children}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-foreground">
            <Play className="h-6 w-6 fill-current" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
          <div className="h-full w-1/3 bg-red-600" />
        </div>
      </div>
      <div className="flex gap-2 px-3 py-2.5">
        <PreviewAvatar />
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-semibold text-foreground">{copy || "Título do vídeo"}</p>
          <p className="text-[10px] text-muted-foreground">Sua Marca • 1,2 mil visualizações • agora</p>
        </div>
      </div>
    </div>
  );
}

function XChrome({ copy, dots, children }: { copy: string; dots?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background p-3">
      <div className="flex gap-2">
        <PreviewAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-semibold text-foreground">Sua Marca</span>{" "}
            <span className="text-muted-foreground">@suamarca • agora</span>
          </p>
          {copy && <p className="mt-1 line-clamp-4 text-xs text-foreground">{copy}</p>}
          <div className="mt-2 overflow-hidden rounded-xl border border-border">{children}</div>
          {dots}
          <div className="mt-2 flex items-center justify-between pr-6 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Heart className="h-4 w-4" />
            <Share2 className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function YouTubePostChrome({ copy, dots, children }: { copy: string; dots?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <PreviewAvatar />
        <div className="leading-tight">
          <p className="text-xs font-semibold">Sua Marca</p>
          <p className="text-[10px] text-muted-foreground">Comunidade • agora</p>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
      {copy && <p className="line-clamp-3 px-3 pb-2 text-xs text-foreground">{copy}</p>}
      <div className="overflow-hidden rounded-md border-y border-border">{children}</div>
      {dots}
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> 0</span>
        <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> 0</span>
        <Share2 className="ml-auto h-4 w-4" />
      </div>
    </div>
  );
}

function ThreadsChrome({ copy, dots, children }: { copy: string; dots?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background p-3">
      <div className="flex gap-2">
        <PreviewAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-semibold text-foreground">suamarca</span>{" "}
            <span className="text-muted-foreground">• agora</span>
          </p>
          {copy && <p className="mt-1 line-clamp-4 text-xs text-foreground">{copy}</p>}
          <div className="mt-2 overflow-hidden rounded-xl border border-border">{children}</div>
          {dots}
          <div className="mt-2 flex items-center gap-4 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  required,
  error,
  counter,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {counter && <span className="text-[11px] text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function PlatformIcon({ channel }: { channel: ContentChannel }) {
  const iconClass = "h-4 w-4";
  if (channel === "instagram") return <SiInstagram className={cn(iconClass, "text-pink-500")} />;
  if (channel === "facebook") return <SiFacebook className={cn(iconClass, "text-blue-500")} />;
  if (channel === "youtube") return <SiYoutube className={cn(iconClass, "text-red-500")} />;
  if (channel === "tiktok") return <SiTiktok className={cn(iconClass, "text-foreground")} />;
  if (channel === "twitter") return <SiX className={cn(iconClass, "text-foreground")} />;
  if (channel === "threads") return <SiThreads className={cn(iconClass, "text-foreground")} />;
  return <Play className={cn(iconClass, "text-foreground")} />;
}

function SocialAction({ icon: Icon, className }: { icon: ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className="flex flex-col items-center text-[10px]">
      <Icon className={cn("h-5 w-5", className)} />
      <span>0</span>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPeriodLabel(view: MarketingCalendarViewMode, date: Date): string {
  if (view === "dia") {
    return capitalize(
      date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    );
  }
  if (view === "mes") {
    return capitalize(date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
  }
  if (view === "ano") {
    return String(date.getFullYear());
  }
  return formatWeekRange(date);
}

function shiftDate(date: Date, view: MarketingCalendarViewMode, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (view === "dia") next.setDate(next.getDate() + delta);
  else if (view === "semana") next.setDate(next.getDate() + delta * 7);
  else if (view === "mes") next.setMonth(next.getMonth() + delta);
  else if (view === "ano") next.setFullYear(next.getFullYear() + delta);
  return next;
}

function formatWeekRange(date: Date): string {
  const start = new Date(date);
  const weekday = start.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startDay = String(start.getDate()).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");
  const month = end.toLocaleDateString("pt-BR", { month: "long" });
  const year = end.getFullYear();
  return `${startDay} - ${endDay} de ${month}, ${year}`;
}
