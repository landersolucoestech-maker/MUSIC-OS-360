import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Lead = Tables<"leads">;
export type LeadInsert = Omit<TablesInsert<"leads">, "user_id" | "id" | "created_at" | "updated_at">;
export type LeadUpdate = Omit<TablesUpdate<"leads">, "id" | "user_id" | "created_at" | "updated_at">;

export const TIPO_LEAD_OPTIONS = [
  { value: "artista_banda", label: "Artista / Banda" },
  { value: "contratante_show", label: "Contratante de Show" },
  { value: "marca_empresa", label: "Marca / Empresa" },
  { value: "produtora_eventos", label: "Produtora de Eventos" },
  { value: "gravadora_selo", label: "Gravadora / Selo" },
  { value: "agencia", label: "Agência" },
  { value: "influenciador", label: "Influenciador" },
  { value: "outros", label: "Outros" },
] as const;

export const STATUS_LEAD_OPTIONS = [
  { value: "novo", label: "Novo Lead" },
  { value: "qualificado", label: "Qualificado" },
  { value: "contato_realizado", label: "Em Contato" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "negociacao", label: "Negociação" },
  { value: "followup", label: "Follow-Up" },
  { value: "confirmado", label: "Confirmado" },
  { value: "fechado", label: "Fechado (Conversão)" },
  { value: "perdido", label: "Perdido" },
  { value: "arquivado", label: "Arquivado" },
] as const;

export const ORIGEM_LEAD_OPTIONS = [
  { value: "site", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram_ads", label: "Instagram Ads" },
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "google_search", label: "Google Search" },
  { value: "indicacao", label: "Indicação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "evento", label: "Evento" },
  { value: "parceria", label: "Parceria" },
  { value: "prospeccao_ativa", label: "Prospecção Ativa" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "Email" },
  { value: "outro", label: "Outro" },
] as const;

export const PRIORIDADE_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
] as const;

export const TIPO_CONTRATO_OPTIONS = [
  { value: "show", label: "Show" },
  { value: "festival", label: "Festival" },
  { value: "corporativo", label: "Corporativo" },
  { value: "publishing", label: "Publishing" },
  { value: "licenciamento", label: "Licenciamento" },
] as const;

export const SERVICOS_INTERESSE_OPTIONS = [
  { value: "show_booking", label: "Show / Booking" },
  { value: "agenciamento_gestao", label: "Agenciamento / Gestão de Carreira" },
  { value: "producao_musical", label: "Produção Musical" },
  { value: "edicao_musical", label: "Edição Musical (Editora)" },
  { value: "producao_audiovisual", label: "Produção Audiovisual" },
  { value: "marketing_musical", label: "Marketing Musical" },
  { value: "design_grafico", label: "Design Gráfico" },
  { value: "distribuicao_digital", label: "Distribuição Digital" },
  { value: "outro", label: "Outro" },
] as const;

export const GENERO_MUSICAL_OPTIONS = [
  { value: "sertanejo", label: "Sertanejo" },
  { value: "funk", label: "Funk" },
  { value: "trap", label: "Trap" },
  { value: "rap", label: "Rap" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "gospel", label: "Gospel" },
  { value: "eletronica", label: "Eletrônica" },
  { value: "mpb", label: "MPB" },
  { value: "pagode", label: "Pagode" },
  { value: "forro", label: "Forró" },
  { value: "outro", label: "Outro" },
] as const;

export const TIPO_EVENTO_OPTIONS = [
  { value: "show_publico", label: "Show Público" },
  { value: "festival", label: "Festival" },
  { value: "corporativo", label: "Evento Corporativo" },
  { value: "festa_privada", label: "Festa Privada" },
  { value: "casa_noturna", label: "Casa Noturna" },
  { value: "rodeio", label: "Rodeio" },
  { value: "universitario", label: "Evento Universitário" },
  { value: "evento_marca", label: "Evento de Marca" },
  { value: "outro", label: "Outro" },
] as const;

export const TIPO_PRODUCAO_MUSICAL_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Álbum" },
  { value: "beat", label: "Beat" },
  { value: "jingle", label: "Jingle" },
  { value: "producao_completa", label: "Produção Completa" },
] as const;

export const TIPO_PRODUCAO_AV_OPTIONS = [
  { value: "videoclipe", label: "Videoclipe" },
  { value: "conteudo_redes", label: "Conteúdo para Redes Sociais" },
  { value: "visualizer", label: "Visualizer" },
  { value: "documentario", label: "Documentário" },
  { value: "dvd_show_vivo", label: "DVD / Show ao Vivo" },
  { value: "aftermovie", label: "Aftermovie de Evento" },
] as const;

export const SERVICOS_MARKETING_OPTIONS = [
  { value: "identidade_visual", label: "Identidade Visual" },
  { value: "capa_single_album", label: "Capa de Single/Álbum" },
  { value: "gestao_redes", label: "Gestão de Redes Sociais" },
  { value: "trafego_pago", label: "Tráfego Pago" },
  { value: "planejamento_lancamento", label: "Planejamento de Lançamento" },
  { value: "branding_artistico", label: "Branding Artístico" },
  { value: "press_kit", label: "Press Kit" },
  { value: "epk", label: "EPK (Electronic Press Kit)" },
] as const;

export const OBJETIVO_MARKETING_OPTIONS = [
  { value: "lancamento_musica", label: "Lançamento de Música" },
  { value: "crescimento_redes", label: "Crescimento nas Redes" },
  { value: "venda_shows", label: "Venda de Shows" },
  { value: "fortalecer_marca", label: "Fortalecer Marca" },
  { value: "viralizar_conteudo", label: "Viralizar Conteúdo" },
] as const;

export const TEMPERATURA_LEAD_OPTIONS = [
  { value: "frio", label: "Frio" },
  { value: "morno", label: "Morno" },
  { value: "quente", label: "Quente" },
] as const;

export const FORMA_PAGAMENTO_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "parcelado", label: "Parcelado" },
  { value: "a_definir", label: "A Definir" },
] as const;

export const TAGS_PREDEFINIDAS = [
  "VIP",
  "Alta Prioridade",
  "Indicação",
  "Cliente Recorrente",
  "Artista",
  "Evento",
  "Marca",
  "Corporativo",
  "Festival",
  "Turnê",
] as const;

export const ARTISTA_POSSUI_OPTIONS = [
  { value: "musica_lancada", label: "Música Lançada" },
  { value: "distribuicao_digital", label: "Distribuição Digital" },
  { value: "registro_obras", label: "Registro de Obras" },
  { value: "videoclipe", label: "Videoclipe" },
  { value: "identidade_visual", label: "Identidade Visual" },
  { value: "assessoria_imprensa", label: "Assessoria de Imprensa" },
  { value: "gestao_carreira", label: "Gestão de Carreira" },
  { value: "nada_ainda", label: "Nada Ainda" },
] as const;

export const ESTRUTURA_EVENTO_OPTIONS = [
  { value: "palco", label: "Palco" },
  { value: "som", label: "Som" },
  { value: "iluminacao", label: "Iluminação" },
  { value: "backline", label: "Backline" },
  { value: "led", label: "LED" },
  { value: "streaming", label: "Streaming" },
] as const;

export const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_LEAD_OPTIONS.map(o => [o.value, o.label])
);

export const ORIGEM_LABELS: Record<string, string> = Object.fromEntries(
  ORIGEM_LEAD_OPTIONS.map(o => [o.value, o.label])
);

export function getProbabilidadeForStatus(status: string, current: number | null): number {
  if (status === "fechado" || status === "confirmado") return 100;
  if (status === "perdido") return 0;
  if (status === "arquivado") return 0;
  return current ?? 10;
}

export function useLeads() {
  const result = useSupabaseQuery<Lead>({
    queryKey: [...QUERY_KEYS.LEADS],
    table: "leads",
    orderBy: { column: "created_at", ascending: false },
  }, {
    create: { success: "Lead criado com sucesso!", error: "Erro ao criar lead" },
    update: { success: "Lead atualizado com sucesso!", error: "Erro ao atualizar lead" },
    delete: { success: "Lead excluído com sucesso!", error: "Erro ao excluir lead" },
  });

  return {
    leads: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addLead: result.create,
    updateLead: result.update,
    deleteLead: result.delete,
    refetch: result.refetch,
  };
}
