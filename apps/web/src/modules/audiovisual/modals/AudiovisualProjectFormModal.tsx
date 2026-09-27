import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AudiovisualProject } from "../types/audiovisual.types";

export interface AudiovisualMusicCatalogOption {
  id: string;
  title: string;
  primaryArtist: string;
  isrc?: string | null;
  version?: string | null;
}

type FormState = {
  music_id: string;
  music_title: string;
  artist_name: string;
  type: NonNullable<AudiovisualProject["type"]>;
  format: string;
  director: string;
  videographer: string;
  editor: string;
  shooting_date: string;
  location: string;
  capture_status: string;
  editing_status: string;
  approval_status: string;
  pre_release_date: string;
  release_date: string;
  budget: string;
  real_cost: string;
  concept: string;
  observations: string;
};

const initialForm: FormState = {
  music_id: "",
  music_title: "",
  artist_name: "",
  type: "music_video",
  format: "16:9",
  director: "",
  videographer: "",
  editor: "",
  shooting_date: "",
  location: "",
  capture_status: "scheduled",
  editing_status: "not_started",
  approval_status: "pending",
  pre_release_date: "",
  release_date: "",
  budget: "",
  real_cost: "",
  concept: "",
  observations: "",
};

const inputClass = "h-8 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring";
const textareaClass = "min-h-24 resize-none border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring";

const toDateInput = (value?: string | null) => value ? String(value).slice(0, 10) : "";
const toText = (value: unknown) => value == null ? "" : String(value);

function projectToForm(project?: AudiovisualProject | null): FormState {
  if (!project) return initialForm;
  return {
    music_id: toText(project.phonogram_id),
    music_title: toText(project.music_title ?? project.title ?? project.name),
    artist_name: toText(project.artist_name ?? project.artist?.name),
    type: project.type ?? "music_video",
    format: toText(project.format ?? "16:9"),
    director: toText(project.director),
    videographer: toText(project.videographer),
    editor: toText(project.editor),
    shooting_date: toDateInput(project.shooting_date ?? project.recording_date),
    location: toText(project.location),
    capture_status: toText(project.capture_status ?? "scheduled"),
    editing_status: toText(project.editing_status ?? "not_started"),
    approval_status: toText(project.approval_status ?? "pending"),
    pre_release_date: toDateInput(project.pre_release_date),
    release_date: toDateInput(project.release_date),
    budget: toText(project.budget_estimated ?? project.budget),
    real_cost: toText(project.budget_actual ?? project.real_cost),
    concept: toText(project.concept),
    observations: toText(project.observations),
  };
}

/**
 * Form state → real backend payload (CreateAudiovisualProjectDto /
 * UpdateAudiovisualProjectDto). Product rule: each form field has its own
 * column (migration 20260718000012). `music_id`/`budget`/`real_cost`
 * are not real columns: `music_id` is the same relation as `phonogram_id`, and
 * `budget`/`real_cost` would duplicate `budget_estimated`/`budget_actual` (already
 * summed by the financial dashboard) — so they map to the real names
 * instead of creating a new column. `name` is never sent: it is identical to `title`.
 */
export function buildAudiovisualProjectPayload(
  form: FormState,
  mode: "create" | "edit",
  project?: AudiovisualProject | null,
): Partial<AudiovisualProject> {
  return {
    phonogram_id: form.music_id || undefined,
    music_title: form.music_title,
    artist_name: form.artist_name,
    title: form.music_title,
    type: form.type,
    format: form.format,
    director: form.director,
    videographer: form.videographer,
    editor: form.editor,
    shooting_date: form.shooting_date,
    location: form.location,
    capture_status: form.capture_status as AudiovisualProject["capture_status"],
    editing_status: form.editing_status as AudiovisualProject["editing_status"],
    approval_status: form.approval_status as AudiovisualProject["approval_status"],
    pre_release_date: form.pre_release_date,
    release_date: form.release_date,
    budget_estimated: form.budget,
    budget_actual: form.real_cost,
    concept: form.concept,
    observations: form.observations,
    status: mode === "create" ? "draft" : project?.status,
    final_status: mode === "create" ? "planned" : project?.final_status,
  };
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function MusicSearchSelect({ value, options, onSelect }: { value: string; options: AudiovisualMusicCatalogOption[]; onSelect: (music: AudiovisualMusicCatalogOption) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options.slice(0, 8);
    return options.filter((music) => `${music.title} ${music.primaryArtist} ${music.isrc ?? ""} ${music.version ?? ""}`.toLowerCase().includes(normalized)).slice(0, 8);
  }, [options, query]);

  return <div className="relative">
    <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-8 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-left text-sm text-foreground transition hover:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring">
      <span className={value ? "truncate text-foreground" : "truncate text-muted-foreground"}>{value || "Pesquisar música cadastrada"}</span>
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
    {open && <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative border-b border-border p-2"><Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 border-border bg-card pl-9 text-sm text-foreground placeholder:text-muted-foreground" placeholder="Buscar por música, artista ou ISRC" /></div>
      <div className="max-h-60 overflow-auto py-1">
        {filtered.length ? filtered.map((music) => {
          const selected = music.title === value;
          return <button key={music.id} type="button" onClick={() => { onSelect(music); setQuery(""); setOpen(false); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-muted">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{music.title}</span><span className="block truncate text-xs text-muted-foreground">{music.primaryArtist}{music.version ? ` · ${music.version}` : ""}{music.isrc ? ` · ${music.isrc}` : ""}</span></span>
            {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>;
        }) : <div className="px-3 py-4 text-sm text-muted-foreground">Nenhuma música cadastrada encontrada.</div>}
      </div>
    </div>}
  </div>;
}

export function AudiovisualProjectFormModal({
  open,
  mode,
  project,
  onClose,
  onSubmit,
  musicCatalog,
}: {
  open: boolean;
  mode: "create" | "edit";
  project?: AudiovisualProject | null;
  onClose: () => void;
  onSubmit?: (data: Partial<AudiovisualProject>) => void;
  musicCatalog?: AudiovisualMusicCatalogOption[];
}) {
  const catalog = musicCatalog ?? [];
  const [form, setForm] = useState<FormState>(initialForm);

  useEffect(() => {
    if (open) setForm(mode === "edit" ? projectToForm(project) : initialForm);
  }, [open, mode, project]);

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const handleMusicSelect = (music: AudiovisualMusicCatalogOption) => setForm((current) => ({ ...current, music_id: music.id, music_title: music.title, artist_name: music.primaryArtist }));
  const handleSubmit = () => {
    // Task L: does not close the modal here — closing is the responsibility of the
    // caller via the mutate() onSuccess callback (it only disappears if the save
    // really succeeded; on a concurrency 409 or any other
    // error, the modal stays open with the user's data intact).
    onSubmit?.(buildAudiovisualProjectPayload(form, mode, project));
  };

  const title = mode === "create" ? "Nova Produção Audiovisual" : "Editar Produção Audiovisual";
  const subtitle = mode === "create" ? "Cadastre uma produção vinculada ao catálogo musical do sistema." : "Atualize os dados operacionais da produção selecionada.";
  const action = mode === "create" ? "Criar Produção" : "Salvar Alterações";

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4  sm:p-6">
    <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div><h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="max-h-[74vh] overflow-auto px-5 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Música"><MusicSearchSelect value={form.music_title} options={catalog} onSelect={handleMusicSelect} /></Field>
          <Field label="Artista"><Input value={form.artist_name} readOnly className={`${inputClass} cursor-not-allowed bg-card text-muted-foreground`} placeholder="Preenchido automaticamente pela música" /></Field>
          <Field label="Tipo de Produção"><Select value={form.type} onValueChange={(value) => update("type", value as FormState["type"])}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="music_video">Clipe Oficial</SelectItem><SelectItem value="reels">Reels Gravado</SelectItem><SelectItem value="visualizer">Visualizer</SelectItem><SelectItem value="teaser">Teaser</SelectItem><SelectItem value="backstage">Bastidores</SelectItem><SelectItem value="lyric_video">Lyric Video</SelectItem></SelectContent></Select></Field>
          <Field label="Formato"><Select value={form.format} onValueChange={(value) => update("format", value)}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem><SelectItem value="1:1">1:1</SelectItem><SelectItem value="4:5">4:5</SelectItem></SelectContent></Select></Field>
          <Field label="Diretor"><Input value={form.director} onChange={(event) => update("director", event.target.value)} className={inputClass} placeholder="Diretor" /></Field>
          <Field label="Videomaker"><Input value={form.videographer} onChange={(event) => update("videographer", event.target.value)} className={inputClass} placeholder="Videomaker" /></Field>
          <Field label="Editor"><Input value={form.editor} onChange={(event) => update("editor", event.target.value)} className={inputClass} placeholder="Editor" /></Field>
          <Field label="Data da Gravação"><DatePickerField value={form.shooting_date} onChange={(iso) => update("shooting_date", iso)} className={inputClass} /></Field>
          <Field label="Local da Gravação"><Input value={form.location} onChange={(event) => update("location", event.target.value)} className={inputClass} placeholder="Cidade / Local" /></Field>
          <Field label="Status Captação"><Select value={form.capture_status} onValueChange={(value) => update("capture_status", value)}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Agendada</SelectItem><SelectItem value="recording">Em Gravação</SelectItem><SelectItem value="recorded">Gravada</SelectItem><SelectItem value="pending">Pendente</SelectItem></SelectContent></Select></Field>
          <Field label="Status Edição"><Select value={form.editing_status} onValueChange={(value) => update("editing_status", value)}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_started">Não Iniciada</SelectItem><SelectItem value="editing">Em Edição</SelectItem><SelectItem value="finished">Finalizada</SelectItem></SelectContent></Select></Field>
          <Field label="Status Aprovação"><Select value={form.approval_status} onValueChange={(value) => update("approval_status", value)}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="review">Em Revisão</SelectItem><SelectItem value="approved">Aprovado</SelectItem><SelectItem value="rejected">Reprovado</SelectItem></SelectContent></Select></Field>
          <Field label="Pré-Lançamento"><DatePickerField value={form.pre_release_date} onChange={(iso) => update("pre_release_date", iso)} className={inputClass} /></Field>
          <Field label="Lançamento"><DatePickerField value={form.release_date} onChange={(iso) => update("release_date", iso)} className={inputClass} /></Field>
          <Field label="Orçamento"><Input value={form.budget} onChange={(event) => update("budget", event.target.value)} className={inputClass} placeholder="R$ 0,00" /></Field>
          <Field label="Custo Real"><Input value={form.real_cost} onChange={(event) => update("real_cost", event.target.value)} className={inputClass} placeholder="R$ 0,00" /></Field>
          <Field label="Roteiro Inicial" className="md:col-span-2 lg:col-span-3"><Textarea value={form.concept} onChange={(event) => update("concept", event.target.value)} className={textareaClass} placeholder="Conceito, objetivo, estética visual, referências e estrutura inicial do roteiro" /></Field>
          <Field label="Observações" className="md:col-span-2 lg:col-span-3"><Textarea value={form.observations} onChange={(event) => update("observations", event.target.value)} className={textareaClass} placeholder="Observações de produção" /></Field>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="outline" onClick={onClose} className="border-border bg-transparent text-foreground hover:bg-muted">Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!form.music_title || !form.artist_name} className="bg-primary hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50">{action}</Button>
      </div>
    </div>
  </div>;
}
