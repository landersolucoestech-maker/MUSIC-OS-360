/**
 * components/SupportCenterView.tsx
 *
 * Central de Atendimento (equipe <-> público externo) — árvore de
 * componentes/estado/serviço próprios, isolados de Chat Interno
 * (modules/musicchat-interno). Renderizada pelo tab "Central de Atendimento"
 * em modules/musicchat/pages/MusicChat.tsx — nunca junto com o tab "Chat
 * Interno" (o pai não usa `forceMount`, então só o tab ativo é montado).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { Textarea } from "@/shared/ui/textarea";
import {
  ChatAttachment,
  resolveAttachmentKind,
  type ChatAttachmentData,
  type ChatAttachmentKind,
} from "@/shared/components/ChatAttachment";
import { toast } from "sonner";
import { LeadFormModal, type LeadFormPayload } from "@/modules/leads/modals/LeadFormModal";
import { useLeads } from "@/modules/leads/hooks";
import type { Lead, LeadClientType, LeadServiceType } from "@/modules/leads/types";
import { ContatoFormModal, type ContatoFormPayload } from "@/modules/crm-relationships/modals/ContatoFormModal";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { contatoPayloadToContactData } from "@/modules/crm-relationships/services/contacts.service";
import { SchedulerFormModal } from "@/modules/events/components/SchedulerFormModal";
import { useMusicChatAutomationSettings } from "@/modules/musicchat/hooks/useMusicChatAutomationSettings";
import { useMusicChatTriageRules } from "@/modules/musicchat/hooks/useMusicChatTriageRules";
import { musicChatConversationsService } from "@/modules/musicchat/services/conversations.service";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useUploadToR2, R2NotConfiguredError, type UploadCategory } from "@/shared/hooks/useUploadToR2";
import { useWsEvent } from "@/shared/hooks/useWsEvent";
import { useTenant } from "@/app/providers/TenantContext";
import {
  Archive,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Headphones,
  Inbox,
  Link,
  Mic,
  Paperclip,
  Phone,
  Search,
  Send,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";

type SupportChannel = "whatsapp" | "instagram" | "facebook" | "tiktok" | "site" | "custom";
type SupportStatus =
  | "nova"
  | "aguardando_atendimento"
  | "em_atendimento"
  | "aguardando_cliente"
  | "resolvida"
  | "arquivada";
type DeadlineState = "on_track" | "at_risk" | "overdue";

export interface SupportConversation {
  id: string;
  customer: string;
  handle: string;
  phone: string;
  instagram: string;
  email: string;
  originLabel: string;
  channel: SupportChannel;
  queue: string;
  sector: string;
  status: SupportStatus;
  assignee: string;
  protocol: string;
  sla: number;
  remainingTimeLabel: string;
  deadlineState: DeadlineState;
  tags: string[];
  /** Assunto do formulário do site (origem "Site"). */
  assunto?: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  lastReplyAt: string;
  unread: number;
  value: string;
  crmSummary: {
    existingCustomer: boolean;
    lead: string;
    openDeal: string;
    stage: string;
  };
  auditTrail: string[];
  /** Concorrência otimista (Task M) — ver useConcurrencyConflict. */
  updated_at: string;
}

interface SupportMessage {
  id: string;
  sender: "customer" | "agent" | "system";
  author: string;
  body: string;
  time: string;
  attachments?: ChatAttachmentData[];
  deliveryStatus?: "sent" | "failed" | "internal_only";
  deliveryError?: string;
}

const statusLabels: Record<SupportStatus, string> = {
  nova: "Nova",
  aguardando_atendimento: "Aguardando Atendimento",
  em_atendimento: "Em Atendimento",
  aguardando_cliente: "Aguardando Cliente",
  resolvida: "Resolvida",
  arquivada: "Arquivada",
};

const channelLabels: Record<SupportChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram DM",
  facebook: "Facebook DM",
  tiktok: "TikTok DM",
  site: "Site",
  custom: "Canal Futuro",
};

const channelStyles: Record<SupportChannel, string> = {
  whatsapp: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  instagram: "border-pink-500/30 bg-pink-500/10 text-pink-700",
  facebook: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  tiktok: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700",
  site: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",
  custom: "border-violet-500/30 bg-violet-500/10 text-violet-700",
};

const statusStyles: Record<SupportStatus, string> = {
  nova: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  aguardando_atendimento: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  em_atendimento: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  aguardando_cliente: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  resolvida: "border-muted bg-muted text-muted-foreground",
  arquivada: "border-border bg-background text-muted-foreground",
};

const deadlineLabels: Record<DeadlineState, string> = {
  on_track: "Dentro do prazo",
  at_risk: "Próximo do vencimento",
  overdue: "Prazo vencido",
};

const deadlineStyles: Record<DeadlineState, string> = {
  on_track: "text-emerald-700",
  at_risk: "text-amber-700",
  overdue: "text-red-700",
};

const deadlineProgressStyles: Record<DeadlineState, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  overdue: "bg-red-500",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function currentTimeLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function recordingDurationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

const teamMembers = ["Ana Mendes", "Lucas Araujo", "Bianca Rocha", "Sem responsável"];

// Persisted in sessionStorage (not React state) because SupportCenterView fully unmounts when
// the user switches to the Chat Interno tab and back (no forceMount, by design — see
// MusicChat.tsx). Without this, an in-progress reply draft or pending (already-uploaded, awaiting
// send) attachments are silently lost on every tab switch — same pattern already used by
// ChatInternoView for its own draft state. An in-progress audio recording is intentionally NOT
// persisted here: the underlying MediaStream/MediaRecorder cannot survive an unmount, and the
// existing unmount cleanup already stops the mic tracks cleanly (correct behavior, not a bug).
const draftKey = (conversationId: string) => `musicchat-support:draft:${conversationId}`;
const attachmentsKey = (conversationId: string) => `musicchat-support:attachments:${conversationId}`;

function readPersistedAttachments(conversationId: string): ChatAttachmentData[] {
  try {
    const raw = sessionStorage.getItem(attachmentsKey(conversationId));
    return raw ? (JSON.parse(raw) as ChatAttachmentData[]) : [];
  } catch {
    return [];
  }
}

const quickReplies = [
  "Olá! Recebemos o seu contato e já estamos verificando. Em instantes retornamos.",
  "Pode nos enviar mais detalhes para encaminharmos a melhor proposta?",
  "Agradecemos o contato! Vamos encaminhar para o time responsável e retornamos em breve.",
];

const leadClientByType: Partial<Record<LeadFormPayload["tipo_lead"], LeadClientType>> = {
  artista_banda: "artist",
  contratante_show: "venue",
  marca_empresa: "brand",
  produtora_eventos: "eventProducer",
  gravadora_selo: "label",
  empresario_artistico: "company",
  blog: "other",
  influenciador: "creator",
  outros: "other",
};

const leadServiceByService: Record<string, LeadServiceType> = {
  agenciamento_gestao: "gestaoArtistica",
  producao_musical: "producaoMusical",
  edicao_musical: "registroAutoral",
  producao_audiovisual: "videoclipe",
  marketing_digital: "marketingMusical",
  criacao_sites: "desenvolvimentoSite",
  consultoria: "consultoria",
  contratacao_artistas: "show",
  eventos_corporativos: "producaoEvento",
  campanhas_artistas: "marketingMusical",
  licenciamento_musical: "licenciamento",
  divulgacao_eventos: "marketingMusical",
  parcerias_comerciais: "consultoria",
  distribuicao_digital: "distribuicaoDigital",
  gestao_catalogo: "consultoria",
  estrategia_carreira: "gestaoArtistica",
  administracao_editorial: "registroAutoral",
  registro_obras: "registroAutoral",
  arrecadacao_autoral: "registroAutoral",
  sincronizacao: "licenciamento",
  influenciadores: "marketingMusical",
  producao_eventos: "producaoEvento",
  marketing_influencia: "marketingMusical",
  gestao_imagem: "marketingMusical",
  atendimento_personalizado: "consultoria",
  parcerias: "consultoria",
  projetos_especiais: "consultoria",
};

const leadOriginByChannel: Partial<Record<SupportChannel, string>> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "outro",
  site: "website",
  custom: "outro",
};

function buildConversationContext(conversation: SupportConversation) {
  return [
    `Origem: ${conversation.originLabel}`,
    `Protocolo: ${conversation.protocol}`,
    `Cliente: ${conversation.customer}`,
    `Contato: ${conversation.handle}`,
    `Fila: ${conversation.queue}`,
    `Setor: ${conversation.sector}`,
    `Ultima mensagem: ${conversation.lastMessage}`,
    conversation.tags.length > 0 ? `Tags: ${conversation.tags.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildLeadInitialValue(conversation: SupportConversation): Partial<LeadFormPayload> {
  return {
    nome: conversation.customer,
    email: conversation.email,
    telefone: conversation.phone || conversation.handle,
    instagram: conversation.instagram,
    tipo_lead: "contratante_show",
    servico: "contratacao_artistas",
    descricao: buildConversationContext(conversation),
    origem_lead: leadOriginByChannel[conversation.channel] ?? "outro",
    data_entrada: new Date().toISOString().split("T")[0],
    status_lead: "novo_lead",
    prioridade: conversation.deadlineState === "overdue" ? "alta" : "media",
    responsavel: conversation.assignee === "Sem responsável" ? "" : conversation.assignee,
    interacoes: [],
    uploads: [],
  };
}

function buildContactInitialValue(conversation: SupportConversation): Partial<ContatoFormPayload> {
  const priority = conversation.deadlineState === "overdue" ? "high" : "medium";
  const responsible = conversation.assignee === "Sem responsável" ? "" : conversation.assignee;
  return {
    tipo_pessoa: "pessoa_fisica",
    nome_pf: conversation.customer,
    email: conversation.email,
    telefone: conversation.phone || conversation.handle,
    categoria: "",
    status_contato: "active",
    prioridade_contato: priority,
    responsavel_nome: responsible,
    interacoes: [],
    attachments: [],
    observacoes: buildConversationContext(conversation),
    nome: conversation.customer,
    cpf_cnpj: "",
    endereco: "",
    endereco_completo: "",
    responsavel: responsible,
    status: "active",
    prioridade: priority,
  };
}

function buildEventInitialValue(conversation: SupportConversation) {
  return {
    title: `Atendimento - ${conversation.customer}`,
    tipoEvento: "reunioes",
    tipo_evento: "reunioes",
    status: "agendado",
    startDate: new Date(),
    horarioInicio: "",
    nomeLocal: conversation.originLabel,
    contatoLocal: conversation.phone || conversation.handle,
    descricao: buildConversationContext(conversation),
    observacoes: `Criado a partir do MusicChat. ${conversation.protocol}`,
  };
}

function leadPayloadToLead(
  payload: LeadFormPayload,
): Omit<Lead, "id" | "createdAt" | "updatedAt" | "historicoInteracoes"> {
  return {
    nomeCompleto: payload.nome,
    nomeArtistico: payload.nome_artista_servico,
    empresa: payload.empresa,
    email: payload.email,
    whatsapp: payload.telefone,
    instagram: payload.instagram,
    cidade: payload.cidade,
    estado: payload.estado,
    pais: "Brasil",
    tipoCliente: leadClientByType[payload.tipo_lead] ?? "other",
    tipoServico: leadServiceByService[payload.servico] ?? "consultoria",
    payloadServico: {
      tipo_lead: payload.tipo_lead,
      servico: payload.servico,
      nome_artista_servico: payload.nome_artista_servico,
      descricao: payload.descricao,
      cargo: payload.cargo,
      website: payload.website,
      endereco: payload.endereco,
      data_entrada: payload.data_entrada,
      responsavel: payload.responsavel,
      interacoes: payload.interacoes,
      ...(payload.evento ?? payload.campanha ?? payload.influenciador ?? payload.empresario ?? {}),
    },
    dadosInternosCRM: {
      statusLead: payload.status_lead,
      prioridade: payload.prioridade,
      origemLead: payload.origem_lead,
      responsavel: payload.responsavel,
      campanha_marketing: payload.campanha_marketing,
    },
    uploads: payload.uploads ?? [],
  };
}

function ChannelIcon({ channel }: { channel: SupportChannel }) {
  if (channel === "instagram") return <SiInstagram className="h-3.5 w-3.5" />;
  if (channel === "facebook") return <SiFacebook className="h-3.5 w-3.5" />;
  if (channel === "tiktok") return <SiTiktok className="h-3.5 w-3.5" />;
  if (channel === "site") return <Globe className="h-3.5 w-3.5" />;
  if (channel === "custom") return <Inbox className="h-3.5 w-3.5" />;
  return <Phone className="h-3.5 w-3.5" />;
}

function ConversationListItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: SupportConversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
        active ? "bg-primary/5" : "bg-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-muted text-xs">{getInitials(conversation.customer)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{conversation.customer}</p>
              <p className="truncate text-xs text-muted-foreground">{conversation.handle}</p>
            </div>
            <span className="text-[11px] text-muted-foreground">{conversation.lastMessageAt}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{conversation.lastMessage}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`gap-1 text-[10px] ${channelStyles[conversation.channel]}`}>
              <ChannelIcon channel={conversation.channel} />
              {channelLabels[conversation.channel]}
            </Badge>
            {conversation.unread > 0 && (
              <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                {conversation.unread}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function SupportCenterView({
  pendingNewConversation,
  onConsumePendingNewConversation,
}: {
  /** Conversa recém-criada pelo NewConversationDialog (state vive no componente pai, que
   *  controla o header) — consumida uma vez via useEffect para upsert + auto-seleção. */
  pendingNewConversation?: SupportConversation | null;
  onConsumePendingNewConversation?: () => void;
}) {
  const { canWrite } = useTenant();
  const canReply = canWrite("musicchat");
  const { createLead } = useLeads();
  const { createContact } = useContacts();
  const { settings: automationSettings } = useMusicChatAutomationSettings();
  const { runEscalations } = useMusicChatTriageRules();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, SupportMessage[]>>({});
  // Persisted so the selected conversation survives an unmount from switching to the
  // Chat Interno tab and back (this view has no forceMount, by design).
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem("musicchat-support:selected-id") ?? "");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachmentData[]>([]);
  const [isSending, setIsSending] = useState(false);
  const sendAttemptRef = useRef<{ key: string; signature: string } | null>(null);
  const { upload: uploadAttachment, isUploading: isUploadingAttachment } = useUploadToR2();
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  // Facebook/Instagram/TikTok/Website: isMarketingConnected() reflete só a
  // integração de marketing (posts/ads) via OAuth — não existe webhook real
  // de mensagens/DM para nenhum destes canais (só WhatsApp tem). Mostrar
  // "conectado" aqui seria enganoso — sempre indisponível para mensagens
  // até existir integração real de messaging. Website: não há widget/embed
  // de chat do site nem endpoint público de visitor session no backend —
  // o canal "site"/custom hoje só existe para formulário estático (campo
  // assunto), não para conversa em tempo real. Mais um canal na lista,
  // honestamente indisponível — não é o canal oficial/padrão.
  const messagingChannels = [
    { id: "facebook", label: "Facebook", connected: false, icon: SiFacebook },
    { id: "instagram", label: "Instagram", connected: false, icon: SiInstagram },
    { id: "tiktok", label: "TikTok", connected: false, icon: SiTiktok },
    { id: "site", label: "Website", connected: false, icon: Globe },
  ];
  const quickReplyOptions = useMemo(
    () => (automationSettings?.templates?.length ? automationSettings.templates.slice(0, 3).map((template) => template.body) : quickReplies),
    [automationSettings?.templates],
  );


  useEffect(() => {
    let active = true;
    setLoadingConversations(true);
    void musicChatConversationsService.list()
      .then((rows) => {
        if (!active) return;
        setConversations(rows);
        setSelectedId((current) => current || rows[0]?.id || "");
      })
      .catch(() => {
        if (active) toast.error("Não foi possível carregar as conversas do MusicChat.");
      })
      .finally(() => {
        if (active) setLoadingConversations(false);
      });
    return () => { active = false; };
  }, []);

  // Realtime real (Section 14): backend já publica conversation:* no canal
  // tenant:<id> (RealtimeService.sendToTenant). Ao chegar um evento,
  // re-busca do servidor em vez de aplicar patch local — evita mensagem
  // duplicada entre o append otimista do próprio envio e o broadcast do
  // mesmo evento voltando pelo realtime.
  // Escopado por conversationId (Section 26 do wave de remediação): antes cada evento
  // refazia list() inteiro (até 200 linhas) para toda conversa do tenant, mesmo quando só
  // uma mudou — O(eventos × tamanho da lista) por agente conectado. Agora busca só a
  // conversa afetada e faz upsert local.
  useWsEvent("conversation:created", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:updated", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:assigned", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:transferred", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:closed", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:reopened", (data) => refreshConversation(data.conversationId));
  useWsEvent("conversation:message", (data) => {
    refreshConversation(data.conversationId); // last_message_at/status vivem na conversa
    if (data.conversationId) {
      void musicChatConversationsService.messages(data.conversationId)
        .then((rows) => setMessagesByConv((previous) => ({ ...previous, [data.conversationId]: rows })))
        .catch(() => {});
    }
  });

  useEffect(() => {
    if (!selectedId || messagesByConv[selectedId]) return;
    let active = true;
    void musicChatConversationsService.messages(selectedId)
      .then((rows) => {
        if (active) setMessagesByConv((previous) => ({ ...previous, [selectedId]: rows }));
      })
      .catch(() => {
        if (active) toast.error("Não foi possível carregar as mensagens desta conversa.");
      });
    return () => { active = false; };
  }, [selectedId, messagesByConv]);

  useEffect(() => {
    if (selectedId) sessionStorage.setItem("musicchat-support:selected-id", selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) return undefined;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesChannel = channelFilter === "todos" || conversation.channel === channelFilter;
      // "Arquivada" só aparece quando o filtro de status a seleciona explicitamente;
      // na lista ativa padrão ("todos") as conversas arquivadas ficam ocultas.
      const matchesStatus =
        statusFilter === "todos"
          ? conversation.status !== "arquivada"
          : conversation.status === statusFilter;
      const matchesQuery =
        query.length === 0 ||
        conversation.customer.toLowerCase().includes(query) ||
        conversation.protocol.toLowerCase().includes(query) ||
        conversation.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesChannel && matchesStatus && matchesQuery;
    });
  }, [conversations, channelFilter, statusFilter, searchQuery]);

  // Estatísticas reais computadas da lista carregada — nunca números fixos.
  const conversationStats = useMemo(() => {
    const active = conversations.filter((c) => c.status !== "arquivada");
    return {
      novas: active.filter((c) => c.status === "nova").length,
      semResponsavel: active.filter((c) => c.assignee === "Sem responsável").length,
      resolvidas: active.filter((c) => c.status === "resolvida").length,
    };
  }, [conversations]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0];

  const isClosed = selectedConversation?.status === "resolvida" || selectedConversation?.status === "arquivada";

  const messages = selectedConversation ? messagesByConv[selectedConversation.id] ?? [] : [];

  // Restore only — writes happen directly in the draft/attachment handlers below, not via a
  // second effect keyed on `draft`/`pendingAttachments` (that would race this restore: it would
  // see the pre-restore value on the same render pass and immediately overwrite what was just
  // read — same reasoning as ChatInternoView's draft restore).
  useEffect(() => {
    if (selectedConversation) {
      setDraft(sessionStorage.getItem(draftKey(selectedConversation.id)) ?? "");
      setPendingAttachments(readPersistedAttachments(selectedConversation.id));
    } else {
      setDraft("");
      setPendingAttachments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const persistAttachments = (conversationId: string, list: ChatAttachmentData[]) => {
    if (list.length > 0) sessionStorage.setItem(attachmentsKey(conversationId), JSON.stringify(list));
    else sessionStorage.removeItem(attachmentsKey(conversationId));
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!selectedConversation) return;
    if (value) sessionStorage.setItem(draftKey(selectedConversation.id), value);
    else sessionStorage.removeItem(draftKey(selectedConversation.id));
  };

  const updateConversation = (
    id: string,
    updater: (conversation: SupportConversation) => SupportConversation,
    auditEntry?: string,
  ) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== id) return conversation;
        const next = updater(conversation);
        return auditEntry ? { ...next, auditTrail: [...next.auditTrail, auditEntry] } : next;
      }),
    );
  };

  /** Insere/atualiza uma única conversa em memória a partir de um GET escopado —
   *  usado pelos handlers de realtime abaixo em vez de refazer list() inteiro por evento. */
  const upsertConversation = (conversation: SupportConversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conversation.id);
      return exists
        ? prev.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...prev];
    });
  };

  const refreshConversation = (conversationId: string) => {
    void musicChatConversationsService.get(conversationId).then(upsertConversation).catch(() => {});
  };

  useEffect(() => {
    if (!pendingNewConversation) return;
    upsertConversation(pendingNewConversation);
    setSelectedId(pendingNewConversation.id);
    onConsumePendingNewConversation?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNewConversation]);

  const appendMessage = (id: string, message: SupportMessage) => {
    setMessagesByConv((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), message] }));
  };

  const handleTransfer = async () => {
    if (!selectedConversation || !transferTarget) return;
    try {
      const updated = await musicChatConversationsService.update(selectedConversation.id, {
        metadata: { assignee_name: transferTarget },
        service_status: "em_atendimento",
        expectedUpdatedAt: getExpectedUpdatedAt(selectedConversation),
      });
      setConversations((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Conversa transferida para ${transferTarget}.`);
      setTransferOpen(false);
      setTransferTarget("");
    } catch (err) {
      if (handleConcurrencyConflict(err, "conversa")) return;
      toast.error("Não foi possível transferir a conversa.");
    }
  };

  const handleFinalize = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await musicChatConversationsService.close(selectedConversation.id);
      setConversations((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      toast.success("Conversa finalizada.");
    } catch {
      toast.error("Não foi possível finalizar a conversa.");
    }
  };

  const handleArchive = async () => {
    if (!selectedConversation) return;
    try {
      await musicChatConversationsService.archive(selectedConversation.id);
      setConversations((previous) => previous.filter((item) => item.id !== selectedConversation.id));
      setSelectedId("");
      toast.success("Conversa arquivada.");
    } catch {
      toast.error("Não foi possível arquivar a conversa.");
    }
  };

  const handleReopen = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await musicChatConversationsService.reopen(selectedConversation.id);
      setConversations((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      toast.success("Conversa reaberta.");
    } catch {
      toast.error("Não foi possível reabrir a conversa.");
    }
  };

  const handleAddTag = async () => {
    if (!selectedConversation) return;
    const tag = tagDraft.trim();
    if (!tag) return;
    if (selectedConversation.tags.includes(tag)) {
      toast.info("Essa tag já está adicionada.");
      return;
    }
    const nextTags = [...selectedConversation.tags, tag];
    try {
      const updated = await musicChatConversationsService.update(selectedConversation.id, {
        tags: nextTags,
        expectedUpdatedAt: getExpectedUpdatedAt(selectedConversation),
      });
      setConversations((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`Tag "${tag}" adicionada.`);
      setTagDraft("");
      setTagOpen(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "conversa")) return;
      toast.error("Não foi possível adicionar a tag.");
    }
  };

  const handleCreateLead = () => {
    if (!selectedConversation) return;
    setLeadModalOpen(true);
  };

  const handleLinkCrm = () => {
    if (!selectedConversation) return;
    setContactModalOpen(true);
  };

  const handleCreateEvent = () => {
    if (!selectedConversation) return;
    setEventModalOpen(true);
  };

  const handleLeadSubmit = async (payload: LeadFormPayload) => {
    if (!selectedConversation) return;
    await createLead(leadPayloadToLead(payload));
    updateConversation(
      selectedConversation.id,
      (conversation) => ({
        ...conversation,
        crmSummary: { ...conversation.crmSummary, lead: payload.status_lead || conversation.crmSummary.lead },
      }),
      "Lead criado a partir do MusicChat",
    );
    toast.success("Lead criado a partir da conversa.");
  };

  const handleContactSubmit = async (payload: ContatoFormPayload) => {
    if (!selectedConversation) return;
    await createContact(contatoPayloadToContactData(payload));
    updateConversation(
      selectedConversation.id,
      (conversation) => ({
        ...conversation,
        crmSummary: { ...conversation.crmSummary, existingCustomer: true },
      }),
      "Contato CRM criado e vinculado",
    );
    toast.success("Contato criado e vinculado ao CRM.");
  };

  // Envio real ao storage (R2) via presigned URL — blob: local não persiste além da
  // sessão/aba atual e nunca deve ser tratado como sucesso de anexo (ver useUploadToR2).
  const attachmentCategoryFor = (kind: ChatAttachmentKind): UploadCategory =>
    kind === "audio" ? "audio" : kind === "image" ? "images" : "documents";

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    let successCount = 0;
    for (const file of files) {
      const kind = resolveAttachmentKind(file.type, file.name);
      try {
        const { publicUrl } = await uploadAttachment({ file, category: attachmentCategoryFor(kind), entity: "conversation" });
        setPendingAttachments((prev) => {
          const next = [
            ...prev,
            {
              kind,
              name: file.name,
              mime: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
              url: publicUrl,
            },
          ];
          if (selectedConversation) persistAttachments(selectedConversation.id, next);
          return next;
        });
        successCount += 1;
      } catch (err) {
        toast.error(
          err instanceof R2NotConfiguredError
            ? err.message
            : `Falha ao enviar "${file.name}" — anexo não adicionado.`,
        );
      }
    }
    if (successCount > 0) {
      toast.success(successCount === 1 ? `Anexo enviado: ${files[0].name}` : `${successCount} anexos enviados.`);
    }
  };

  const handleRemovePendingAttachment = (url: string) => {
    setPendingAttachments((prev) => {
      const next = prev.filter((attachment) => attachment.url !== url);
      if (selectedConversation) persistAttachments(selectedConversation.id, next);
      return next;
    });
  };

  const stopRecordingTracks = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const finishRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Gravação de áudio não suportada neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        toast.error("Não foi possível gravar o áudio.");
        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingSeconds(0);
        stopRecordingTracks();
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingSeconds(0);

        if (blob.size === 0) {
          toast.error("A gravação ficou vazia. Tente novamente.");
          return;
        }

        const extension = blob.type.includes("webm") ? "webm" : "ogg";
        const name = `audio-atendimento-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
        const audioFile = new File([blob], name, { type: blob.type || "audio/webm" });
        void uploadAttachment({ file: audioFile, category: "audio", entity: "conversation" })
          .then(({ publicUrl }) => {
            setPendingAttachments((prev) => {
              const next = [...prev, { kind: "audio" as const, name, mime: blob.type || "audio/webm", url: publicUrl }];
              if (selectedConversation) persistAttachments(selectedConversation.id, next);
              return next;
            });
            toast.success("Áudio gravado e pronto para envio.");
          })
          .catch((err) => {
            toast.error(
              err instanceof R2NotConfiguredError ? err.message : "Falha ao enviar o áudio gravado.",
            );
          });
      };

      recorder.start();
      setRecordingSeconds(0);
      setRecordingStartedAt(Date.now());
      setIsRecording(true);
      toast.info("Gravação de áudio iniciada.");
    } catch {
      setIsRecording(false);
      setRecordingStartedAt(null);
      setRecordingSeconds(0);
      stopRecordingTracks();
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      finishRecording();
      return;
    }

    void startRecording();
  };

  const handleQuickReply = (text: string) => {
    handleDraftChange(text);
  };

  const handleSend = async () => {
    if (!selectedConversation) return;
    if (isSending) return; // guarda contra reentrância (duplo clique/duplo Enter)
    const body = draft.trim();
    if (!body && pendingAttachments.length === 0) return;
    const sentAt = currentTimeLabel();
    const attachments = pendingAttachments;
    const fallbackBody = attachments.length === 1 ? "Anexo enviado." : `${attachments.length} anexos enviados.`;
    setIsSending(true);
    // Chave de idempotência por PAYLOAD: reenviar o mesmo texto após um timeout reusa a chave
    // (backend replaya em vez de duplicar a mensagem); texto editado gera chave nova, senão a
    // edição seria descartada em favor da resposta antiga em cache.
    const signature = `${selectedConversation.id}|${body || fallbackBody}|${attachments.map((a) => a.url).join(",")}`;
    if (sendAttemptRef.current?.signature !== signature) {
      sendAttemptRef.current = { key: crypto.randomUUID(), signature };
    }
    try {
      const saved = await musicChatConversationsService.sendMessage(
        selectedConversation.id,
        body || fallbackBody,
        attachments,
        sendAttemptRef.current.key,
      );
      appendMessage(selectedConversation.id, saved);
      updateConversation(selectedConversation.id, (conversation) => ({
        ...conversation,
        lastMessage: body || fallbackBody,
        lastMessageAt: sentAt,
      }));
      handleDraftChange("");
      setPendingAttachments([]);
      persistAttachments(selectedConversation.id, []);
    } catch {
      toast.error("Não foi possível enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  };

  const handleInternalNote = async () => {
    if (!selectedConversation) return;
    const body = draft.trim();
    if (!body) return;
    try {
      await musicChatConversationsService.addNote(selectedConversation.id, body);
      appendMessage(selectedConversation.id, {
        id: `note-${Date.now()}`,
        sender: "system",
        author: "Nota interna",
        body,
        time: currentTimeLabel(),
      });
      toast.success("Nota interna registrada.");
      handleDraftChange("");
    } catch {
      toast.error("Não foi possível registrar a nota interna.");
    }
  };

  return (
    <>
    <div className="grid min-h-[620px] gap-4 lg:h-[calc(100vh-248px)] lg:grid-cols-[320px_minmax(420px,1fr)_320px]">
      <Card className="flex min-w-0 flex-col overflow-hidden border-border bg-card">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Headphones className="h-4 w-4" />
                Atendimento
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Filas, canais e conversas multicanal.</p>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {loadingConversations ? "Carregando" : `${filteredConversations.length} abertas`}
            </Badge>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Canais de mensagens
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {messagingChannels.map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-foreground">
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{channel.label}</span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {channel.connected ? "conectado" : "mensagens indisponíveis"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, protocolo ou tag..."
              aria-label="Buscar cliente, protocolo ou tag"
              className="pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por canal">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                {Object.entries(channelLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Novas", String(conversationStats.novas)],
              ["Resolvidas", String(conversationStats.resolvidas)],
              ["Sem resp.", String(conversationStats.semResponsavel)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-muted/30 px-2 py-2">
                <p className="text-sm font-semibold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {conversations.length === 0
                ? "Nenhuma conversa ainda."
                : "Nenhuma conversa corresponde aos filtros atuais."}
            </p>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                active={selectedConversation?.id === conversation.id}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))
          )}
        </ScrollArea>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden border-border bg-card">
        {selectedConversation ? (
          <>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-muted text-xs">
                      {getInitials(selectedConversation.customer)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {selectedConversation.customer}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`gap-1 text-[11px] ${channelStyles[selectedConversation.channel]}`}>
                        <ChannelIcon channel={selectedConversation.channel} />
                        {channelLabels[selectedConversation.channel]}
                      </Badge>
                      <Badge variant="outline" className={`text-[11px] ${statusStyles[selectedConversation.status]}`}>
                        {statusLabels[selectedConversation.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{selectedConversation.protocol}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Popover open={transferOpen} onOpenChange={setTransferOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={isClosed}>
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transferir
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Transferir para</Label>
                        <Select value={transferTarget} onValueChange={setTransferTarget}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((member) => (
                              <SelectItem key={member} value={member}>
                                {member}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" className="h-8 w-full text-xs" disabled={!transferTarget} onClick={handleTransfer}>
                        Confirmar transferência
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={isClosed} onClick={handleFinalize}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Finalizar
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-muted/20 px-5 py-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "agent" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[72%] rounded-lg px-3 py-2 shadow-sm ${
                        message.sender === "system"
                          ? "border border-border bg-background text-muted-foreground"
                          : message.sender === "agent"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-foreground"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4">
                        <span className="text-[11px] font-medium opacity-80">{message.author}</span>
                        <span className="text-[10px] opacity-70">{message.time}</span>
                      </div>
                      {message.body && <p className="text-sm leading-relaxed">{message.body}</p>}
                      {message.sender === "agent" && message.deliveryStatus === "failed" && (
                        <p className="mt-1 text-[10px] font-medium text-destructive">
                          Falha no envio{message.deliveryError ? `: ${message.deliveryError}` : ""}
                        </p>
                      )}
                      {message.sender === "agent" && message.deliveryStatus === "internal_only" && (
                        <p className="mt-1 text-[10px] text-primary-foreground/70">
                          Registrado apenas internamente — canal sem envio externo real
                        </p>
                      )}
                      {(message.attachments?.length ?? 0) > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments!.map((attachment) => (
                            <ChatAttachment
                              key={`${message.id}-${attachment.url}`}
                              attachment={attachment}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4">
              {!canReply ? (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-sm text-muted-foreground">
                  Você não tem permissão para responder no MusicChat.
                </p>
              ) : isClosed ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Conversa finalizada</p>
                    <p className="text-xs text-muted-foreground">Reabra a conversa para enviar novas mensagens.</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReopen}>
                    Reabrir
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {pendingAttachments.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pendingAttachments.map((attachment) => (
                        <div
                          key={attachment.url}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">{attachment.name}</p>
                            <p className="text-[11px] text-muted-foreground">{attachment.mime}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label={`Remover ${attachment.name}`}
                            onClick={() => handleRemovePendingAttachment(attachment.url)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {isRecording && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-red-700">Gravação de áudio em andamento</p>
                          <p className="text-[11px] text-red-700/80">
                            {recordingDurationLabel(recordingSeconds)} - clique para finalizar e anexar.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 border-red-500/40 bg-background text-xs text-red-700 hover:bg-red-500/10"
                        onClick={finishRecording}
                      >
                        Parar e anexar
                      </Button>
                    </div>
                  )}
                  <Textarea
                    placeholder="Digite uma mensagem para o cliente..."
                    className="min-h-[78px] resize-none"
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={isUploadingAttachment ? "Enviando anexo…" : "Anexar arquivo"}
                        disabled={isUploadingAttachment}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={isRecording ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        title={isRecording ? "Parar gravação" : "Gravar áudio"}
                        onClick={handleToggleRecording}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            Resposta rápida
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80">
                          <DropdownMenuLabel>Respostas rápidas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {quickReplyOptions.map((reply) => (
                            <DropdownMenuItem
                              key={reply}
                              className="whitespace-normal text-xs"
                              onSelect={() => handleQuickReply(reply)}
                            >
                              {reply}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!draft.trim()}
                        onClick={handleInternalNote}
                      >
                        Nota interna
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      disabled={isSending || isRecording || (!draft.trim() && pendingAttachments.length === 0)}
                      onClick={handleSend}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isSending ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <CardContent className="flex h-full flex-col items-center justify-center text-center">
            <Inbox className="mb-4 h-14 w-14 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhuma conversa encontrada</p>
          </CardContent>
        )}
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden border-border bg-card">
        {selectedConversation && (
          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Painel Operacional</h3>
                <p className="mt-1 text-xs text-muted-foreground">Cliente, prazo, CRM e acoes da conversa.</p>
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Cliente</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-background text-xs">
                      {getInitials(selectedConversation.customer)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{selectedConversation.customer}</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedConversation.handle}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium text-foreground">{selectedConversation.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Instagram</p>
                    <p className="font-medium text-foreground">{selectedConversation.instagram}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium text-foreground">{selectedConversation.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Canal de origem</p>
                    <p className="font-medium text-foreground">{selectedConversation.originLabel}</p>
                  </div>
                  {selectedConversation.assunto && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Assunto</p>
                      <p className="font-medium text-foreground">{selectedConversation.assunto}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Conversa</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Protocolo</p>
                    <p className="font-medium text-foreground">{selectedConversation.protocol}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`mt-1 text-[11px] ${statusStyles[selectedConversation.status]}`}>
                      {statusLabels[selectedConversation.status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fila</p>
                    <p className="font-medium text-foreground">{selectedConversation.queue}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Setor</p>
                    <p className="font-medium text-foreground">{selectedConversation.sector}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium text-foreground">{selectedConversation.assignee}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4" />
                    Prazo de Atendimento
                  </p>
                  <span className={`text-xs font-medium ${deadlineStyles[selectedConversation.deadlineState]}`}>
                    {deadlineLabels[selectedConversation.deadlineState]}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${deadlineProgressStyles[selectedConversation.deadlineState]}`}
                    style={{ width: `${selectedConversation.sla}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{selectedConversation.sla}% restante</span>
                  <span>{selectedConversation.remainingTimeLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Tag className="h-4 w-4" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedConversation.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-md text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                  <Popover open={tagOpen} onOpenChange={setTagOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">
                        + Adicionar Tag
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 space-y-2">
                      <Label className="text-xs">Nova tag</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder="Ex.: Prioridade"
                          className="h-8 text-xs"
                        />
                        <Button size="sm" className="h-8 text-xs" disabled={!tagDraft.trim()} onClick={handleAddTag}>
                          Adicionar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Ações</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    onClick={handleCreateLead}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Criar Lead
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    onClick={handleLinkCrm}
                  >
                    <Link className="h-3.5 w-3.5" />
                    Vincular CRM
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    onClick={handleCreateEvent}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Criar Evento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    disabled={isClosed}
                    onClick={() => setTransferOpen(true)}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transferir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    disabled={selectedConversation.status === "arquivada"}
                    onClick={handleArchive}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    disabled={isClosed}
                    onClick={handleFinalize}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Finalizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-start gap-1.5 text-xs"
                    disabled={runEscalations.isPending}
                    onClick={() => runEscalations.mutate(undefined)}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Escalonar
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">CRM</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Cliente existente</p>
                    <p className="font-medium text-foreground">
                      {selectedConversation.crmSummary.existingCustomer ? "SIM" : "NAO"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lead</p>
                    <p className="font-medium text-foreground">{selectedConversation.crmSummary.lead}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Negócio aberto</p>
                    <p className="font-medium text-foreground">{selectedConversation.crmSummary.openDeal}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Etapa</p>
                    <p className="font-medium text-foreground">{selectedConversation.crmSummary.stage}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Histórico</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Criado</p>
                    <p className="font-medium text-foreground">{selectedConversation.createdAt}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Última resposta</p>
                    <p className="font-medium text-foreground">{selectedConversation.lastReplyAt}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Canal</p>
                    <p className="font-medium text-foreground">{selectedConversation.originLabel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium text-foreground">{statusLabels[selectedConversation.status]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fila</p>
                    <p className="font-medium text-foreground">{selectedConversation.queue}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium text-foreground">{selectedConversation.assignee}</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
    {selectedConversation && (
      <>
        <LeadFormModal
          open={leadModalOpen}
          onOpenChange={setLeadModalOpen}
          mode="create"
          initialValue={buildLeadInitialValue(selectedConversation)}
          onSubmit={handleLeadSubmit}
        />
        <ContatoFormModal
          open={contactModalOpen}
          onOpenChange={setContactModalOpen}
          mode="create"
          initialValue={buildContactInitialValue(selectedConversation)}
          onSubmit={handleContactSubmit}
        />
        <SchedulerFormModal
          open={eventModalOpen}
          onOpenChange={setEventModalOpen}
          mode="create"
          event={buildEventInitialValue(selectedConversation)}
        />
      </>
    )}
    </>
  );
}
