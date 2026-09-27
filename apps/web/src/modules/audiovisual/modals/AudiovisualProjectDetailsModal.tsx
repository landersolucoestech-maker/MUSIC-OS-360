import type { ReactNode } from "react";
import {
  CalendarDays,
  Edit3,
  Film,
  MapPin,
  Music2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { AudiovisualProject } from "../types/audiovisual.types";
import { AudiovisualStatusBadge } from "../components/AudiovisualStatusBadge";

const typeLabel: Record<string, string> = {
  music_video: "Clipe Oficial",
  visualizer: "Visualizer",
  lyric_video: "Lyric Video",
  teaser: "Teaser",
  reels: "Reels Gravado",
  backstage: "Bastidores",
  documentary: "Documentário",
  live_session: "Live Session",
  aftermovie: "Aftermovie",
  promo: "Promo",
  commercial: "Comercial",
  social_content: "Social Content",
  other: "Outro",
};

const value = (v?: unknown) => (v == null || v === "" ? "—" : String(v));

const date = (v?: string | null) => {
  if (!v) return "—";
  const normalized = `${v}`.slice(0, 10);
  return new Date(`${normalized}T00:00:00`).toLocaleDateString("pt-BR");
};

const money = (v?: string | number | null) => {
  if (typeof v === "number") {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return v ? String(v) : "—";
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        {icon ? <span className="text-primary">{icon}</span> : null}
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="break-words text-sm font-semibold leading-6 text-foreground">
        {children}
      </div>
    </div>
  );
}

function LongDetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">
        {children}
      </div>
    </div>
  );
}

export function AudiovisualProjectDetailsModal({
  open,
  project,
  onClose,
  onEdit,
}: {
  open: boolean;
  project: AudiovisualProject | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!open || !project) return null;

  const title = project.music_title ?? project.title ?? project.name ?? "Projeto sem título";
  const artist = project.artist_name ?? project.artist?.name;
  const projectType =
    typeLabel[String(project.type ?? project.project_type)] ?? "Produção Audiovisual";
  const thumbnail = project.thumbnail_url ?? project.cover_url ?? project.preview_image;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              Detalhes da Produção Audiovisual
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualização consolidada do projeto selecionado.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[74vh] overflow-auto px-5 py-5 sm:px-6">
          <div className="space-y-4">
            <section className="rounded-xl bg-muted/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="h-28 w-full overflow-hidden rounded-lg bg-card sm:w-40 sm:shrink-0">
                  {thumbnail ? (
                    <img
                      src={String(thumbnail)}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-card">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <AudiovisualStatusBadge value={project.final_status ?? project.status} />
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {projectType}
                    </span>
                  </div>

                  <h3 className="truncate text-xl font-semibold text-foreground">{title}</h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" />
                      {value(artist)}
                    </span>
                  </div>
                </div>

                {onEdit ? (
                  <Button
                    onClick={onEdit}
                    className="h-9 shrink-0 bg-primary text-sm font-semibold hover:bg-primary sm:self-start"
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                ) : null}
              </div>
            </section>

            <Section title="Informações Gerais" icon={<Film className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailItem label="Status Final">
                  <AudiovisualStatusBadge value={project.final_status ?? project.status} />
                </DetailItem>

                <DetailItem label="Tipo de Produção">{projectType}</DetailItem>

                <DetailItem label="Formato">{value(project.format)}</DetailItem>
              </div>
            </Section>

            <Section title="Música Relacionada" icon={<Music2 className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailItem label="Música">{title}</DetailItem>

                <DetailItem label="Artista Principal">{value(artist)}</DetailItem>

                <DetailItem label="Campanha">{value(project.campaign_name)}</DetailItem>
              </div>
            </Section>

            <Section title="Produção" icon={<UsersRound className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailItem label="Diretor">{value(project.director)}</DetailItem>

                <DetailItem label="Videomaker">{value(project.videographer)}</DetailItem>

                <DetailItem label="Editor">{value(project.editor)}</DetailItem>

                <DetailItem label="Status Captação">
                  <AudiovisualStatusBadge value={project.capture_status} />
                </DetailItem>

                <DetailItem label="Status Edição">
                  <AudiovisualStatusBadge value={project.editing_status} />
                </DetailItem>

                <DetailItem label="Status Aprovação">
                  <AudiovisualStatusBadge value={project.approval_status} />
                </DetailItem>
              </div>
            </Section>

            <Section title="Datas e Orçamento" icon={<CalendarDays className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailItem label="Data da Gravação">
                  {date(project.shooting_date ?? project.recording_date)}
                </DetailItem>

                <DetailItem label="Local">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {value(project.location)}
                  </span>
                </DetailItem>

                <DetailItem label="Pré-Lançamento">
                  {date(project.pre_release_date)}
                </DetailItem>

                <DetailItem label="Lançamento">
                  {date(project.release_date)}
                </DetailItem>

                <DetailItem label="Orçamento Previsto">{money(project.budget_estimated ?? project.budget)}</DetailItem>

                <DetailItem label="Custo Real">{money(project.budget_actual ?? project.real_cost)}</DetailItem>
              </div>
            </Section>

            <Section title="Observações" icon={<Film className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4">
                <LongDetailItem label="Roteiro Inicial">{value(project.concept)}</LongDetailItem>

                <LongDetailItem label="Observações Gerais">
                  {value(project.observations)}
                </LongDetailItem>
              </div>
            </Section>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border bg-transparent text-foreground hover:bg-muted"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
