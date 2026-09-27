import { Copy, Heart, Megaphone, MousePointer, Music2, Play, Plus, Target, Trash2, Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import {
  ALL_PROMOTED_ENTITY_TYPES,
  buildUtmUrl,
  expectedRatio,
  EXPECTED_OUTCOME_LABEL,
  getRequiredPlacements,
  OBJECTIVE_DESCRIPTION,
  OBJECTIVE_LABEL,
  OUTCOMES_BY_OBJECTIVE,
  PLACEMENT_LABEL,
  PLACEMENTS_BY_PLATFORM,
  placementPlatform,
  PLATFORM_LABEL,
  PLATFORMS_BY_OBJECTIVE,
  PROMOTED_ENTITY_LABEL,
  validateCampaignStep,
} from "./campaign-builder.helpers";
import type { BuilderStepProps, CampaignCreative, CampaignObjective, CampaignPlacement, CampaignPlatform, CreativeType, PromotedEntityType } from "./campaign-builder.types";
import { Badge } from "@/shared/ui/badge";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { useUsers } from "@/modules/settings/hooks/useUsuarios";
import { useMarketingProjects } from "../../hooks/useMarketingProjects";
import { useMarketingContents } from "../../hooks/useMarketingContents";
import { CONTENT_CHANNEL_LABEL, CONTENT_STATUS_LABEL } from "../../constants/marketing.constants";
import { PUBLISH_PLATFORMS } from "../../config/social-formats";
import type { ContentChannel, MarketingContent, MarketingTarget } from "../../types/marketing.types";
import { formatDate } from "../../utils/marketing-format";
import { LocationCombobox } from "./LocationCombobox";
import { CampaignGeoMap } from "./CampaignGeoMap";

const PLATFORMS = Object.keys(PLATFORM_LABEL) as CampaignPlatform[];
const TYPES: CreativeType[] = ["imagem", "video", "carrossel", "audio", "texto"];
const COUNTRY_OPTIONS = [
  "Afeganistao", "Africa do Sul", "Albania", "Alemanha", "Andorra", "Angola", "Antigua e Barbuda", "Arabia Saudita",
  "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijao", "Bahamas", "Bangladesh", "Barbados",
  "Barein", "Belgica", "Belize", "Benin", "Bielorrussia", "Bolivia", "Bosnia e Herzegovina", "Botsuana", "Brasil",
  "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Butao", "Cabo Verde", "Camaroes", "Camboja", "Canada", "Catar",
  "Cazaquistao", "Chade", "Chile", "China", "Chipre", "Colombia", "Comores", "Coreia do Norte", "Coreia do Sul",
  "Costa Rica", "Croacia", "Cuba", "Dinamarca", "Egito", "El Salvador", "Emirados Arabes Unidos", "Equador",
  "Eslovaquia", "Eslovenia", "Espanha", "Estados Unidos", "Estonia", "Etiopia", "Filipinas", "Finlandia", "Franca",
  "Gana", "Georgia", "Grecia", "Guatemala", "Haiti", "Honduras", "Hungria", "India", "Indonesia", "Ira", "Iraque",
  "Irlanda", "Islandia", "Israel", "Italia", "Jamaica", "Japao", "Jordania", "Kuwait", "Laos", "Letonia", "Libano",
  "Lituania", "Luxemburgo", "Malasia", "Malta", "Marrocos", "Mexico", "Mocambique", "Nepal", "Nicaragua", "Nigeria",
  "Noruega", "Nova Zelandia", "Países Baixos", "Panama", "Paraguai", "Peru", "Polonia", "Portugal", "Quenia",
  "Reino Unido", "Republica Dominicana", "Republica Tcheca", "Romenia", "Russia", "Senegal", "Servia", "Singapura",
  "Suecia", "Suica", "Tailandia", "Taiwan", "Tanzania", "Tunisia", "Turquia", "Ucrania", "Uruguai", "Venezuela",
  "Vietna", "Zambia", "Zimbabue",
] as const;
const LANGUAGE_OPTIONS = [
  { value: "af", label: "Africâner" }, { value: "sq", label: "Albanês" }, { value: "de", label: "Alemão" },
  { value: "am", label: "Amarico" }, { value: "ar", label: "Árabe" }, { value: "hy", label: "Armênio" },
  { value: "az", label: "Azerbaijano" }, { value: "bn", label: "Bengali" }, { value: "be", label: "Bielorrusso" },
  { value: "bg", label: "Búlgaro" }, { value: "km", label: "Cambojano" }, { value: "ca", label: "Catalão" },
  { value: "kk", label: "Cazaque" }, { value: "zh-CN", label: "Chinês simplificado" },
  { value: "zh-TW", label: "Chinês tradicional" }, { value: "ko", label: "Coreano" }, { value: "hr", label: "Croata" },
  { value: "da", label: "Dinamarquês" }, { value: "sk", label: "Eslovaco" }, { value: "sl", label: "Esloveno" },
  { value: "es", label: "Espanhol" }, { value: "et", label: "Estoniano" }, { value: "fi", label: "Finlandês" },
  { value: "fr", label: "Frances" }, { value: "ka", label: "Georgiano" }, { value: "el", label: "Grego" },
  { value: "gu", label: "Guzerate" }, { value: "ht", label: "Haitiano crioulo" }, { value: "ha", label: "Hauçá" },
  { value: "he", label: "Hebraico" }, { value: "hi", label: "Hindi" }, { value: "nl", label: "Holandês" },
  { value: "hu", label: "Húngaro" }, { value: "id", label: "Indonésio" }, { value: "en", label: "Inglês" },
  { value: "ga", label: "Irlandês" }, { value: "is", label: "Islandês" }, { value: "it", label: "Italiano" },
  { value: "ja", label: "Japonês" }, { value: "jv", label: "Javanês" }, { value: "lo", label: "Laosiano" },
  { value: "lv", label: "Letão" }, { value: "lt", label: "Lituano" }, { value: "ms", label: "Malaio" },
  { value: "mt", label: "Maltes" }, { value: "mn", label: "Mongol" }, { value: "ne", label: "Nepalês" },
  { value: "no", label: "Norueguês" }, { value: "fa", label: "Persa" }, { value: "pl", label: "Polonês" },
  { value: "pt-BR", label: "Português (Brasil)" }, { value: "pt-PT", label: "Português (Portugal)" },
  { value: "ro", label: "Romeno" }, { value: "ru", label: "Russo" }, { value: "sr", label: "Sérvio" },
  { value: "so", label: "Somali" }, { value: "sw", label: "Suaíle" }, { value: "sv", label: "Sueco" },
  { value: "tl", label: "Tagalo" }, { value: "th", label: "Tailandês" }, { value: "ta", label: "Tâmil" },
  { value: "cs", label: "Tcheco" }, { value: "te", label: "Telugo" }, { value: "tr", label: "Turco" },
  { value: "uk", label: "Ucraniano" }, { value: "ur", label: "Urdu" }, { value: "vi", label: "Vietnamita" },
  { value: "yo", label: "Iorubá" }, { value: "zu", label: "Zulu" },
] as const;
const GENDER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao_binario", label: "Não binário" },
  { value: "nao_informado", label: "ão informado" },
] as const;
const OBJECTIVE_CARDS: Array<{ value: CampaignObjective; icon: typeof Megaphone }> = [
  { value: "REACH", icon: Megaphone },
  { value: "TRAFFIC", icon: MousePointer },
  { value: "ENGAGEMENT", icon: Heart },
  { value: "CONVERSIONS", icon: Target },
];

export function CampaignObjectiveStep({ state, setState }: BuilderStepProps) {
  const selected = OBJECTIVE_CARDS.find((item) => item.value === state.objective) ?? OBJECTIVE_CARDS[0];
  const SelectedIcon = selected.icon;
  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        {OBJECTIVE_CARDS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setState((current) => ({
              ...current,
              objective: value,
              expectedOutcome: OUTCOMES_BY_OBJECTIVE[value][0],
              platforms: current.platforms.filter((platform) => PLATFORMS_BY_OBJECTIVE[value].includes(platform)),
            }))}
            className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors", state.objective === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{OBJECTIVE_LABEL[value]}</span>
          </button>
        ))}
      </div>
      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <SelectedIcon className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">{OBJECTIVE_LABEL[selected.value]}</h3>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{OBJECTIVE_DESCRIPTION[selected.value]}</p>
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">Bom para:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES_BY_OBJECTIVE[selected.value].map((outcome) => (
              <span key={outcome} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs">{EXPECTED_OUTCOME_LABEL[outcome]}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CampaignOutcomeStep({ state, setState }: BuilderStepProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {OUTCOMES_BY_OBJECTIVE[state.objective].map((outcome) => (
        <button key={outcome} type="button" onClick={() => setState((current) => ({ ...current, expectedOutcome: outcome }))} className={cn("rounded-lg border p-4 text-left transition-colors", state.expectedOutcome === outcome ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40")}>
          <p className="font-semibold">{EXPECTED_OUTCOME_LABEL[outcome]}</p>
          <p className="mt-1 text-xs text-muted-foreground">Resultado esperado para {OBJECTIVE_LABEL[state.objective]}.</p>
        </button>
      ))}
    </div>
  );
}

export function CampaignBasicInfoStep({ state, setState }: BuilderStepProps) {
  // Existing system data — no manual typing, keeps relationships consistent.
  const { users } = useUsers();
  const { data: projects } = useMarketingProjects();

  const userList = users ?? [];
  const ownerOption = (u: { id: string; full_name?: string | null; email?: string | null }) =>
    (u.full_name && u.full_name.trim()) || u.email || u.id;
  const selectedOwnerId = userList.find((u) => ownerOption(u) === state.owner)?.id ?? "";

  const projectList = projects ?? [];
  // Linked entity options: music projects (artists use the AsyncEntityCombobox
  // below — server-side search, never capped at the first 50 per tenant).
  const entityList = projectList.map((p) => ({ id: p.id, name: p.name }));

  // Content-driven flow: only PUBLISHED contents of the selected project can be
  // promoted (no campaigns for inexistent/unpublished assets).
  const { data: contents } = useMarketingContents();
  const publishedContents = (contents ?? []).filter((c) => c.projectId === state.project && c.status === "publicado");
  const selectedContent = (contents ?? []).find((c) => c.id === state.contentId);

  const togglePublishChannel = (channel: ContentChannel) => setState((c) => {
    const has = c.publishChannels.includes(channel);
    const publishChannels = has
      ? c.publishChannels.filter((item) => item !== channel)
      : [...c.publishChannels, channel];
    return { ...c, publishChannels };
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Contexto">
        <Select value={state.context} onValueChange={(context) => setState((c) => ({ ...c, context: context as MarketingTarget }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="empresa">Empresa</SelectItem>
            <SelectItem value="artista">Artista</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nome da campanha"><Input value={state.name} onChange={(event) => setState((c) => ({ ...c, name: event.target.value }))} /></Field>
      <Field label="Plataformas de publicação (seleção múltipla)" className="md:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {PUBLISH_PLATFORMS.map((option) => {
            const active = state.publishChannels.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => togglePublishChannel(option.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                )}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Uma campanha pode ser publicada simultaneamente em várias plataformas. Todas as seleções são salvas.
        </p>
      </Field>
      <Field label="Responsável">
        <Select
          value={selectedOwnerId}
          onValueChange={(id) => {
            const user = userList.find((u) => u.id === id);
            setState((c) => ({ ...c, owner: user ? ownerOption(user) : "" }));
          }}
        >
          <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
          <SelectContent>
            {userList.length === 0 ? (
              <SelectItem value="__none" disabled>Nenhum usuário cadastrado</SelectItem>
            ) : (
              userList.map((u) => <SelectItem key={u.id} value={u.id}>{ownerOption(u)}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field label="O que sera promovido">
        <Select value={state.promotedEntityType} onValueChange={(promotedEntityType) => setState((c) => ({ ...c, promotedEntityType: promotedEntityType as PromotedEntityType, promotedEntityId: "", promotedEntityName: "" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_PROMOTED_ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{PROMOTED_ENTITY_LABEL[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Entidade vinculada">
        {state.promotedEntityType === "ARTIST" ? (
          <AsyncEntityCombobox<{ id: string; nome_artistico?: string | null }>
            table="artistas"
            getLabel={(a) => a.nome_artistico ?? ""}
            value={state.promotedEntityId}
            onChange={(id, entity) =>
              setState((c) => ({ ...c, promotedEntityId: id, promotedEntityName: entity?.nome_artistico ?? "" }))
            }
            placeholder="Selecione um artista cadastrado"
            searchPlaceholder="Buscar artista…"
            data-testid="combobox-campaign-entity-artist"
          />
        ) : (
          <Select
            value={state.promotedEntityId}
            onValueChange={(id) => {
              const entity = entityList.find((e) => e.id === id);
              setState((c) => ({ ...c, promotedEntityId: id, promotedEntityName: entity?.name ?? "" }));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione uma entidade cadastrada" /></SelectTrigger>
            <SelectContent>
              {entityList.length === 0 ? (
                <SelectItem value="__none" disabled>Nenhuma entidade cadastrada</SelectItem>
              ) : (
                entityList.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="URL de destino"><Input value={state.destinationUrl} onChange={(event) => setState((c) => ({ ...c, destinationUrl: event.target.value }))} placeholder="https://..." /></Field>
      <Field label="Projeto vinculado">
        <Select value={state.project} onValueChange={(id) => setState((c) => ({ ...c, project: id, contentId: "" }))}>
          <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
          <SelectContent>
            {projectList.length === 0 ? (
              <SelectItem value="__none" disabled>Nenhum projeto disponível</SelectItem>
            ) : (
              projectList.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Conteúdo publicado para promoção" className="md:col-span-2">
        {!state.project ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Selecione um projeto para carregar os conteúdos publicados disponíveis.</p>
        ) : publishedContents.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Nenhum conteúdo publicado disponível para este projeto. Só é possível promover conteúdos já publicados.</p>
        ) : (
          <div className="space-y-2">
            <Select value={state.contentId} onValueChange={(id) => setState((c) => ({ ...c, contentId: id }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um conteúdo publicado" /></SelectTrigger>
              <SelectContent>
                {publishedContents.map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedContent && (
              <div className="flex gap-3 rounded-lg border border-border p-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                  {selectedContent.files[0]?.url ? (
                    <img src={selectedContent.files[0].url} alt={selectedContent.title} className="h-full w-full object-cover" />
                  ) : (
                    <Play className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedContent.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{CONTENT_CHANNEL_LABEL[selectedContent.channel] ?? selectedContent.channel}</span>
                    <span>·</span>
                    <span>{formatDate(selectedContent.publishDate)}</span>
                    <Badge variant="secondary" className="text-[10px]">{CONTENT_STATUS_LABEL[selectedContent.status] ?? selectedContent.status}</Badge>
                  </div>
                  {selectedContent.files[0]?.url && (
                    <a href={selectedContent.files[0].url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary underline">Abrir conteúdo</a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Field>
      <Field label="Fase">
        <Select value={state.phase} onValueChange={(phase) => setState((c) => ({ ...c, phase: phase as typeof state.phase }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pre_lancamento">Pré-lançamento</SelectItem>
            <SelectItem value="lancamento">Lançamento</SelectItem>
            <SelectItem value="sustentacao">Sustentação</SelectItem>
            <SelectItem value="catalogo">Catálogo</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tags"><Input value={state.tags} onChange={(event) => setState((c) => ({ ...c, tags: event.target.value }))} /></Field>
      <Field label="Descrição interna" className="md:col-span-2"><Textarea value={state.internalDescription} onChange={(event) => setState((c) => ({ ...c, internalDescription: event.target.value }))} rows={4} /></Field>
    </div>
  );
}

export function CampaignAudienceStep({ state, setState }: BuilderStepProps) {
  const update = (patch: Partial<typeof state.audience>) => setState((c) => ({ ...c, audience: { ...c.audience, ...patch } }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Países">
        <Select value={state.audience.countries} onValueChange={(countries) => update({ countries })}>
          <SelectTrigger><SelectValue placeholder="Selecione um pais" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRY_OPTIONS.map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Estados/Cidades">
        <LocationCombobox
          value={state.audience.locations}
          onChange={(locations, geo) => {
            if (geo) {
              update({ locations, geoLat: geo.lat, geoLng: geo.lng });
            } else {
              update({ locations });
            }
          }}
        />
      </Field>
      <Field label="Idade mínima"><Input type="number" value={state.audience.ageMin} onChange={(e) => update({ ageMin: Number(e.target.value) })} /></Field>
      <Field label="Idade máxima"><Input type="number" value={state.audience.ageMax} onChange={(e) => update({ ageMax: Number(e.target.value) })} /></Field>
      <Field label="Gênero">
        <Select value={state.audience.gender} onValueChange={(gender) => update({ gender })}>
          <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((gender) => (
              <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Idioma">
        <Select value={state.audience.language} onValueChange={(language) => update({ language })}>
          <SelectTrigger><SelectValue placeholder="Selecione um idioma" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {LANGUAGE_OPTIONS.map((language) => (
              <SelectItem key={language.value} value={language.value}>{language.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Segmentação geográfica (mapa + raio)" className="md:col-span-2">
        <CampaignGeoMap
          lat={state.audience.geoLat}
          lng={state.audience.geoLng}
          radiusKm={state.audience.geoRadiusKm}
          onChange={(geo) => update({ geoLat: geo.lat, geoLng: geo.lng, geoRadiusKm: geo.radiusKm })}
        />
      </Field>
      <Field label="Interesses" className="md:col-span-2"><Textarea value={state.audience.interests} onChange={(e) => update({ interests: e.target.value })} rows={3} /></Field>
      <Field label="Exclusões / remarketing" className="md:col-span-2"><Textarea value={state.audience.exclusions} onChange={(e) => update({ exclusions: e.target.value })} rows={3} /></Field>
    </div>
  );
}

export function CampaignPlatformsStep({ state, setState }: BuilderStepProps) {
  const compatible = PLATFORMS.filter((platform) => PLATFORMS_BY_OBJECTIVE[state.objective].includes(platform));
  const togglePlatform = (platform: CampaignPlatform) => setState((current) => {
    const platforms = current.platforms.includes(platform) ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];
    return { ...current, platforms, placements: current.placements.filter((placement) => getRequiredPlacements(platforms).includes(placement)) };
  });
  return <div className="grid gap-3 sm:grid-cols-2">{compatible.map((platform) => <Toggle key={platform} active={state.platforms.includes(platform)} onClick={() => togglePlatform(platform)} label={PLATFORM_LABEL[platform]} />)}</div>;
}

export function CampaignPlacementsStep({ state, setState }: BuilderStepProps) {
  const available = getRequiredPlacements(state.platforms);
  const togglePlacement = (placement: CampaignPlacement) => setState((current) => ({ ...current, placements: current.placements.includes(placement) ? current.placements.filter((item) => item !== placement) : [...current.placements, placement] }));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">{available.map((placement) => <Toggle key={placement} active={state.placements.includes(placement)} onClick={() => togglePlacement(placement)} label={`${PLATFORM_LABEL[placementPlatform(placement)]} · ${PLACEMENT_LABEL[placement]} · ${expectedRatio(placement)}`} />)}</div>
      {available.length === 0 && <p className="text-sm text-muted-foreground">Selecione uma plataforma antes de escolher posicionamentos.</p>}
    </div>
  );
}

export function CampaignCreativesStep({ state, setState }: BuilderStepProps) {
  const { data: contents } = useMarketingContents();
  const contentList = contents ?? [];
  const add = (placement: CampaignPlacement) => setState((c) => ({ ...c, creatives: [...c.creatives, createCreative(placement, c.destinationUrl)] }));
  const addFromContent = (content: MarketingContent) => setState((c) => {
    if (c.creatives.some((creative) => creative.contentId === content.id)) return c;
    return { ...c, creatives: [...c.creatives, createCreativeFromContent(content, c.destinationUrl)] };
  });
  const update = (id: string, patch: Partial<CampaignCreative>) => setState((c) => ({ ...c, creatives: c.creatives.map((creative) => creative.id === id ? { ...creative, ...patch } : creative) }));
  const remove = (id: string) => setState((c) => ({ ...c, creatives: c.creatives.filter((creative) => creative.id !== id) }));
  const duplicate = (creative: CampaignCreative) => setState((c) => ({ ...c, creatives: [...c.creatives, { ...creative, id: crypto.randomUUID(), contentId: undefined, name: `${creative.name} cópia` }] }));
  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-sm font-medium">Conteúdos existentes</p>
        {contentList.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum conteúdo cadastrado para selecionar. Crie conteúdos no Calendário de Conteúdo.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {contentList.map((content) => {
              const added = state.creatives.some((creative) => creative.contentId === content.id);
              return (
                <div key={content.id} className="flex gap-2 rounded-lg border border-border bg-background p-2">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    {content.files[0]?.url ? (
                      <img src={content.files[0].url} alt={content.title} className="h-full w-full object-cover" />
                    ) : (
                      <Play className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-medium">{content.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{CONTENT_CHANNEL_LABEL[content.channel] ?? content.channel}</span>
                      <Badge variant="secondary" className="text-[10px]">{CONTENT_STATUS_LABEL[content.status] ?? content.status}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={added ? "outline" : "default"}
                      className="mt-1.5 h-7 w-fit text-xs"
                      disabled={added}
                      onClick={() => addFromContent(content)}
                    >
                      {added ? "Adicionado" : <><Plus className="mr-1 h-3 w-3" /> Adicionar</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {state.placements.map((placement) => <Button key={placement} variant="outline" size="sm" onClick={() => add(placement)}><Plus className="mr-1 h-3 w-3" /> Criativo para {PLACEMENT_LABEL[placement]}</Button>)}
      {state.creatives.map((creative) => (
        <div key={creative.id} className="rounded-lg border border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome"><Input value={creative.name} onChange={(e) => update(creative.id, { name: e.target.value })} /></Field>
            <Field label="Tipo"><Select value={creative.type} onValueChange={(type) => update(creative.id, { type: type as CreativeType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Formato">
              <Select value={creative.placement} onValueChange={(p) => update(creative.id, { placement: p as CampaignPlacement, ratio: expectedRatio(p as CampaignPlacement) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(PLACEMENTS_BY_PLATFORM[creative.platform] ?? []).map((p) => (
                    <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]} · {expectedRatio(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Arquivo">
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{creative.fileName || "Selecionar arquivo"}</span>
                {creative.fileSizeMb ? <span className="shrink-0 text-[10px]">{creative.fileSizeMb} MB</span> : null}
                <input
                  type="file"
                  accept={acceptFor(creative.placement)}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    update(creative.id, {
                      fileName: file.name,
                      mimeType: file.type,
                      fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
                      previewUrl: URL.createObjectURL(file),
                      ratio: creative.ratio || expectedRatio(creative.placement),
                    });
                  }}
                />
              </label>
            </Field>
            <Field label="Copy principal" className="md:col-span-2"><Textarea value={creative.primaryCopy} onChange={(e) => update(creative.id, { primaryCopy: e.target.value })} rows={3} /></Field>
            <Field label="Headline"><Input value={creative.headline} onChange={(e) => update(creative.id, { headline: e.target.value })} /></Field>
            <Field label="CTA"><Input value={creative.cta} onChange={(e) => update(creative.id, { cta: e.target.value })} /></Field>
            <Field label="URL destino"><Input value={creative.destinationUrl} onChange={(e) => update(creative.id, { destinationUrl: e.target.value })} /></Field>
            <Field label="UTM final"><Input readOnly value={buildUtmUrl(creative)} /></Field>
          </div>
          <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => duplicate(creative)}><Copy className="mr-1 h-3 w-3" /> Duplicar</Button><Button size="sm" variant="outline" onClick={() => remove(creative.id)}><Trash2 className="mr-1 h-3 w-3" /> Remover</Button></div>
        </div>
      ))}
    </div>
  );
}

export function CampaignPreviewStep({ state }: BuilderStepProps) {
  return <div className="grid gap-4 md:grid-cols-2">{state.creatives.map((creative) => <PreviewCard key={creative.id} creative={creative} />)}</div>;
}

export function CampaignBudgetStep({ state, setState }: BuilderStepProps) {
  const update = (patch: Partial<typeof state.budget>) => setState((c) => ({ ...c, budget: { ...c.budget, ...patch } }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Orçamento total"><Input type="number" value={state.budget.totalBudget} onChange={(e) => update({ totalBudget: Number(e.target.value) })} /></Field>
      <Field label="Orçamento diário"><Input type="number" value={state.budget.dailyBudget} onChange={(e) => update({ dailyBudget: Number(e.target.value) })} /></Field>
      <Field label="Moeda"><Input value={state.budget.currency} onChange={(e) => update({ currency: e.target.value })} /></Field>
      <Field label="Data inicial"><DatePickerField value={state.budget.startDate} onChange={(iso) => update({ startDate: iso })} /></Field>
      <Field label="Data final"><DatePickerField value={state.budget.endDate} onChange={(iso) => update({ endDate: iso })} /></Field>
      <Field label="Estratégia"><Select value={state.budget.strategy} onValueChange={(strategy) => update({ strategy: strategy as typeof state.budget.strategy })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="menor_custo">Menor custo</SelectItem><SelectItem value="limite_custo">Limite de custo</SelectItem><SelectItem value="custo_alvo">Custo alvo</SelectItem></SelectContent></Select></Field>
    </div>
  );
}

export function CampaignReviewStep({ state }: BuilderStepProps) {
  const issues = validateCampaignStep(state, 9);
  return (
    <div className="space-y-4">
      <Result title="Erros bloqueantes" items={issues.filter((i) => i.severity === "error").map((i) => i.message)} />
      <Result title="Avisos" items={issues.filter((i) => i.severity === "warning").map((i) => i.message)} />
      <Result title="Links/UTMs" items={state.creatives.map(buildUtmUrl).filter(Boolean)} />
      <Result title="Criativos pendentes" items={state.creatives.filter((c) => c.status !== "aprovado").map((c) => c.name)} />
    </div>
  );
}

/** Ad platform matching the content's social channel. */
const CHANNEL_TO_AD_PLATFORM: Partial<Record<ContentChannel, CampaignPlatform>> = {
  instagram: "META_ADS",
  facebook: "META_ADS",
  reels: "META_ADS",
  stories: "META_ADS",
  youtube: "YOUTUBE_ADS",
  shorts: "YOUTUBE_ADS",
  tiktok: "TIKTOK_ADS",
  podcast: "SPOTIFY_ADS",
  material_publicitario: "GOOGLE_ADS",
};

function creativeTypeFromContent(content: MarketingContent): CreativeType {
  const kind = content.files?.[0]?.kind ?? "";
  if (kind.startsWith("audio")) return "audio";
  if (content.type === "carrossel") return "carrossel";
  if (["reels", "shorts", "video", "stories"].includes(content.type)) return "video";
  return "imagem";
}

/** Creates a creative from an existing content, inheriting media and caption. */
function createCreativeFromContent(content: MarketingContent, destinationUrl: string): CampaignCreative {
  const platform = CHANNEL_TO_AD_PLATFORM[content.channel] ?? "META_ADS";
  const placement = PLACEMENTS_BY_PLATFORM[platform][0];
  const file = content.files?.[0];
  return {
    id: crypto.randomUUID(),
    contentId: content.id,
    name: content.title,
    platform,
    placement,
    type: creativeTypeFromContent(content),
    fileName: file?.name ?? "",
    fileSizeMb: 0,
    previewUrl: file?.url,
    mimeType: file?.kind,
    ratio: expectedRatio(placement),
    primaryCopy: content.copy ?? "",
    headline: content.title,
    description: "",
    cta: "Saiba mais",
    destinationUrl,
    utmSource: platform.toLowerCase(),
    utmMedium: "paid",
    utmCampaign: "campanha",
    utmContent: placement.toLowerCase(),
    status: "rascunho",
  };
}

function createCreative(placement: CampaignPlacement, destinationUrl: string): CampaignCreative {
  const platform = placement.startsWith("TIKTOK") ? "TIKTOK_ADS" : placement.startsWith("YOUTUBE") ? "YOUTUBE_ADS" : placement.startsWith("GOOGLE") ? "GOOGLE_ADS" : placement.startsWith("SPOTIFY") ? "SPOTIFY_ADS" : "META_ADS";
  const lower = placement.toLowerCase();
  return { id: crypto.randomUUID(), name: PLACEMENT_LABEL[placement], platform, placement, type: lower.includes("audio") ? "audio" : lower.includes("search") ? "texto" : "video", fileName: "", fileSizeMb: 0, ratio: expectedRatio(placement), primaryCopy: "", headline: "", description: "", cta: "Saiba mais", destinationUrl, utmSource: platform.toLowerCase(), utmMedium: "paid", utmCampaign: "campanha", utmContent: placement.toLowerCase(), status: "rascunho" };
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg border p-3 text-left text-sm", active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40")}>{label}</button>;
}

function acceptFor(placement: CampaignPlacement): string {
  if (placement.includes("AUDIO")) return "audio/*";
  if (
    placement.includes("IN_STREAM") || placement.includes("VÍDEO") || placement.includes("REELS") ||
    placement.includes("SHORTS") || placement.includes("TIKTOK") || placement.includes("STORIES")
  ) {
    return "video/*";
  }
  return "image/*,video/*";
}

function CreativeMedia({ creative }: { creative: CampaignCreative }) {
  if (creative.previewUrl && creative.mimeType?.startsWith("image/")) {
    return <img src={creative.previewUrl} alt={creative.name} className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (creative.previewUrl && creative.mimeType?.startsWith("video/")) {
    return <video src={creative.previewUrl} className="absolute inset-0 h-full w-full object-cover" muted controls />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
      <Play className="h-8 w-8" />
    </div>
  );
}

/**
 * Dynamic creative preview — adapts the frame to the placement's real aspect
 * ratio and platform chrome. Updates instantly when the Formato (placement) or
 * uploaded file changes, since it is fully derived from `creative` state.
 */
function PreviewCard({ creative }: { creative: CampaignCreative }) {
  const ratio = expectedRatio(creative.placement);
  const aspect = ratio === "9:16" ? "aspect-[9/16]" : ratio === "16:9" ? "aspect-video" : "aspect-square";
  const widthClass = ratio === "9:16" ? "w-44" : ratio === "16:9" ? "w-full max-w-[300px]" : "w-full max-w-[230px]";

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-semibold">
        {PLATFORM_LABEL[creative.platform]} · {PLACEMENT_LABEL[creative.placement]} <span className="text-muted-foreground">· {ratio}</span>
      </p>

      {ratio === "n/a" ? (
        // Spotify / audio — player simulation
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className="flex h-14 w-14 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
            <Music2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{creative.headline || "Spotify Ad"}</p>
            <p className="truncate text-xs text-muted-foreground">{creative.primaryCopy || "Áudio 15s / 30s"}</p>
            <div className="mt-2 h-1 rounded bg-muted"><div className="h-full w-1/3 rounded bg-emerald-500" /></div>
          </div>
          <span className="shrink-0 rounded bg-primary px-2 py-1 text-[10px] text-primary-foreground">{creative.cta || "Ouvir"}</span>
        </div>
      ) : (
        <div className={cn("relative mx-auto overflow-hidden rounded-lg border border-border bg-muted", aspect, widthClass)}>
          <CreativeMedia creative={creative} />
          {ratio === "9:16" && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-card/90 p-2 text-foreground">
              <p className="line-clamp-2 text-[11px]">{creative.primaryCopy || "Copy principal"}</p>
              <span className="mt-1 w-fit rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{creative.cta || "CTA"}</span>
            </div>
          )}
          {ratio === "16:9" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/90 text-foreground"><Play className="h-5 w-5 fill-current" /></div>
            </div>
          )}
        </div>
      )}

      {ratio === "1:1" && (
        <div className="mx-auto mt-2 max-w-[230px]">
          <p className="line-clamp-2 text-xs"><span className="font-semibold">{creative.headline || "Headline"}</span> {creative.primaryCopy || "Copy principal"}</p>
          <span className="mt-1 inline-block rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{creative.cta || "CTA"}</span>
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-muted-foreground">{creative.fileName || "Sem mídia enviada"}</p>
    </div>
  );
}

function Result({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-lg border border-border p-4"><h3 className="text-sm font-semibold">{title}</h3>{items.length ? <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Nenhum item.</p>}</section>;
}

