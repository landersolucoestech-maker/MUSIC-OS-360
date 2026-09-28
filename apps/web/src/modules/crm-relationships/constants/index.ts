import type { ContactPriority, ContactStatus, ContactType } from "../types";

type ContactOption = { value: ContactType; label: string };

export const individualContactTypeOptions: ContactOption[] = [
  { value: "A_AND_R", label: "A&R" },
  { value: "ARTIST_AGENT", label: "Agente Artístico" },
  { value: "COMMERCIAL_AGENT", label: "Agente Comercial" },
  { value: "LICENSING_AGENT", label: "Agente de Licenciamento" },
  { value: "TOUR_AGENT", label: "Agente de Turnê" },
  { value: "LAWYER", label: "Advogado" },
  { value: "ARRANGER", label: "Arranjador" },
  { value: "ARTIST_BAND", label: "Artista/Banda" },
  { value: "ARTIST_MANAGEMENT", label: "Assessoria Artística" },
  { value: "PRESS_OFFICE", label: "Assessoria de Imprensa" },
  { value: "SONGWRITER", label: "Autor/Compositor" },
  { value: "BEATMAKER", label: "Beatmaker" },
  { value: "HAIRSTYLIST", label: "Cabeleireiro" },
  { value: "ARTISTIC_COACH", label: "Coach Artístico/Vocal" },
  { value: "MEDIA_BUYER", label: "Comprador de Mídia" },
  { value: "ART_CONSULTANT", label: "Consultor Artístico/Musical" },
  { value: "BRAND_CONSULTANT", label: "Consultor de Marca/Imagem" },
  { value: "CONTRACTOR", label: "Contratante" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "PLAYLIST_CURATOR", label: "Curador de Playlist" },
  { value: "DEVELOPER", label: "Desenvolvedor/Programador" },
  { value: "DESIGNER", label: "Designer Gráfico/Web" },
  { value: "ART_DIRECTOR", label: "Diretor Artístico" },
  { value: "DIRECTOR_OF_PHOTOGRAPHY", label: "Diretor de Fotografia" },
  { value: "MARKETING_DIRECTOR", label: "Diretor de Marketing" },
  { value: "STAGE_DIRECTOR", label: "Diretor de Palco" },
  { value: "VIDEO_DIRECTOR", label: "Diretor de Vídeo" },
  { value: "EXECUTIVE_DIRECTOR", label: "Diretor Executivo" },
  { value: "VIDEO_EDITOR", label: "Editor de Vídeo" },
  { value: "ARTIST_MANAGER", label: "Empresário Artístico" },
  { value: "AUDIO_ENGINEER", label: "Engenheiro de Áudio" },
  { value: "MIX_MASTER_ENGINEER", label: "Engenheiro de Mixagem/Masterização" },
  { value: "GROWTH_SPECIALIST", label: "Especialista em crescimento (growth)" },
  { value: "COPYRIGHT_SPECIALIST", label: "Especialista em Direitos Autorais" },
  { value: "DISTRIBUTION_SPECIALIST", label: "Especialista em Distribuição" },
  { value: "LICENSING_SYNC_SPECIALIST", label: "Especialista em Licenciamento/Sincronização" },
  { value: "BRANDING_SPECIALIST", label: "Especialista em Marca/Branding" },
  { value: "MUSIC_MARKETING_SPECIALIST", label: "Especialista em Marketing Musical" },
  { value: "METADATA_SPECIALIST", label: "Especialista em Metadados" },
  { value: "PITCHING_SPECIALIST", label: "Especialista em Pitching" },
  { value: "PAID_TRAFFIC_SPECIALIST", label: "Especialista em Tráfego Pago" },
  { value: "YOUTUBE_SPECIALIST", label: "Especialista em YouTube" },
  { value: "STYLIST", label: "Estilista" },
  { value: "DIGITAL_STRATEGIST", label: "Estrategista Digital" },
  { value: "COMMERCIAL_EXECUTIVE", label: "Executivo Comercial" },
  { value: "PHOTOGRAPHER", label: "Fotógrafo" },
  { value: "FOUNDER", label: "Fundador" },
  { value: "INFLUENCER", label: "Influenciador" },
  { value: "INVESTOR", label: "Investidor" },
  { value: "JOURNALIST", label: "Jornalista" },
  { value: "ANNOUNCER", label: "Locutor" },
  { value: "MENTOR", label: "Mentor" },
  { value: "DRONE_OPERATOR", label: "Operador de Drone" },
  { value: "OTHER", label: "Outro" },
  { value: "PARTNER", label: "Parceiro" },
  { value: "SPONSOR", label: "Patrocinador" },
  { value: "EVENT_PLANNER", label: "Planejador de Eventos" },
  { value: "MEDIA_PLANNER", label: "Planejador de Mídia" },
  { value: "ART_PRODUCER", label: "Produtor Artístico" },
  { value: "AUDIOVISUAL_PRODUCER", label: "Produtor Audiovisual" },
  { value: "CULTURAL_PRODUCER", label: "Produtor Cultural" },
  { value: "EVENT_PRODUCER", label: "Produtor de Eventos" },
  { value: "EXECUTIVE_PRODUCER", label: "Produtor Executivo" },
  { value: "MUSIC_PRODUCER", label: "Produtor Musical" },
  { value: "PUBLIC_RELATIONS", label: "Relações Públicas" },
  { value: "SCREENWRITER", label: "Roteirista" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "MUSIC_SUPERVISOR", label: "Supervisor Musical" },
  { value: "TECHNICIAN", label: "Técnico" },
  { value: "AUDIO_TECHNICIAN", label: "Técnico de Áudio" },
  { value: "LIGHTING_TECHNICIAN", label: "Técnico de Iluminação" },
  { value: "LED_TECHNICIAN", label: "Técnico de LED" },
  { value: "MONITOR_TECHNICIAN", label: "Técnico de Monitor" },
  { value: "PA_TECHNICIAN", label: "Técnico de PA" },
  { value: "STAGE_TECHNICIAN", label: "Técnico de Palco" },
  { value: "STREAMING_TECHNICIAN", label: "Técnico de Streaming" },
  { value: "VIDEOMAKER", label: "Videomaker" },
];

export const companyContactTypeOptions: ContactOption[] = [
  { value: "BOOKING_AGENCY", label: "Agência de Booking" },
  { value: "INFLUENCER_AGENCY", label: "Agência de Influenciadores" },
  { value: "MARKETING_AGENCY", label: "Agência de Marketing" },
  { value: "MODEL_AGENCY", label: "Agência de Modelos" },
  { value: "ADVERTISING_AGENCY", label: "Agência de Publicidade" },
  { value: "PR_AGENCY", label: "Agência de Relações Públicas" },
  { value: "SYNC_AGENCY", label: "Agência de Sincronização" },
  { value: "DIGITAL_DISTRIBUTOR", label: "Agregadora/Distribuidora Digital" },
  { value: "COLLECTIVE_MANAGEMENT_ORGANIZATION", label: "Associação de Gestão Coletiva" },
  { value: "VENUE", label: "Casa de Show" },
  { value: "CORPORATE_CLIENT", label: "Cliente Corporativo" },
  { value: "FAN_CLUB", label: "Clube/Fã Clube" },
  { value: "ART_COLLECTIVE", label: "Coletivo Artístico/Musical" },
  { value: "MUSIC_PUBLISHER", label: "Editora Musical" },
  { value: "EVENT_FESTIVAL", label: "Evento/Festival" },
  { value: "SUPPLIER", label: "Fornecedor" },
  { value: "LABEL_RECORD", label: "Gravadora/Selo" },
  { value: "EQUIPMENT_RENTAL", label: "Locadora de Equipamentos" },
  { value: "BRAND_COMPANY", label: "Marca/Empresa" },
  { value: "OTHER", label: "Outro" },
  { value: "PARTNER", label: "Parceiro" },
  { value: "SPONSOR", label: "Patrocinador" },
  { value: "DIGITAL_PLATFORM", label: "Plataforma Digital" },
  { value: "PODCAST", label: "Podcast" },
  { value: "BLOG_PORTAL", label: "Portal/Blog" },
  { value: "SERVICE_PROVIDER", label: "Prestador de Serviço" },
  { value: "AUDIOVISUAL_PRODUCTION_COMPANY", label: "Produtora Audiovisual" },
  { value: "RADIO_TV", label: "Rádio/Tv" },
];

export const contactTypeOptions: ContactOption[] = [
  ...individualContactTypeOptions,
  ...companyContactTypeOptions.filter(
    (companyOption) =>
      !individualContactTypeOptions.some(
        (individualOption) => individualOption.value === companyOption.value
      )
  ),
];

export const contactStatusOptions: Array<{ value: ContactStatus; label: string }> = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "prospect", label: "Em prospecção" },
];

export const contactPriorityOptions: Array<{ value: ContactPriority; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "strategic", label: "Estratégica" },
];

export const relationshipUploadRules = {
  maxSize: 50 * 1024 * 1024,
  mimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime"],
  extensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov"],
};

/** PT-BR fallback for a stored value outside the option catalog (never the raw value). */
export const UNKNOWN_OPTION_LABEL = "Não identificado";

/** PT-BR label of `value`; "—" when empty, UNKNOWN_OPTION_LABEL when outside the catalog. */
export function labelFor<T extends string>(
  options: Array<{ value: T; label: string }>,
  value?: T | string
) {
  if (value == null || value === "") return "—";
  return options.find((option) => option.value === value)?.label ?? UNKNOWN_OPTION_LABEL;
}
