import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/app/providers/TenantContext";
import { api } from "@/shared/lib/api-client";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import {
  knowledgeBaseService,
  type ApiKnowledgeArticle, type ApiKnowledgeCategory, type CreateArticleInput,
} from "../services/knowledge-base.service";
import type {
  SupportTicket, SupportMessage, SupportRequest,
  KnowledgeArticle, KnowledgeCategory,
  TicketStatus, TicketPriority, TicketCategory,
} from "../types";
import { toUserMessage } from "@/shared/lib/errors";

/**
 * Support — tickets and ticket messages use the real backend
 * (/support-tickets, /support-tickets/:id/messages — GAP-04 of the product
 * completeness audit).
 *
 * Live chat (GAP-05a) was resolved by pointing /support/chat to the
 * real MusicChat (/chat, "internal" tab) — see app/routes/support.routes.tsx.
 * There are no chat hooks here: that would be a second, duplicated chat system.
 *
 * Requests (/support-requests — GAP-05c) and the Knowledge Base
 * (/knowledge-categories, /knowledge-articles — Decision Gate item 8) use the
 * real backend. Every resource of this module has a real endpoint today.
 */

/* ── Tickets (backend real) ── */

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_TICKETS: SupportTicket[] = [];

export function useTickets() {
  const { tenant } = useTenant();
  const tenantId   = tenant.id;
  const queryClient = useQueryClient();

  const { data: tickets = EMPTY_TICKETS, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["support_tickets", tenantId],
    queryFn: async (): Promise<SupportTicket[]> =>
      api.get<SupportTicket[]>("/support-tickets?limit=200"),
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async (data: Pick<SupportTicket, "subject" | "description" | "category" | "priority" | "created_by">) =>
      api.post<SupportTicket>("/support-tickets", {
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_tickets", tenantId] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, changes, expectedUpdatedAt }: { id: string; changes: Partial<SupportTicket>; expectedUpdatedAt?: string }) =>
      api.patch<SupportTicket>(`/support-tickets/${id}`, { ...changes, expectedUpdatedAt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_tickets", tenantId] }),
    onError: (error: unknown) => {
      if (handleConcurrencyConflict(error, "ticket")) return;
      toast.error("Erro ao atualizar ticket. Tente novamente.");
    },
  });

  const addTicket = useCallback(
    (data: Pick<SupportTicket, "subject" | "description" | "category" | "priority" | "created_by">) => {
      addMutation.mutate(data);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId],
  );

  const updateTicket = useCallback(
    (id: string, changes: Partial<SupportTicket>, expectedUpdatedAt?: string) => {
      updateMutation.mutate({ id, changes, expectedUpdatedAt });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId],
  );

  return { tickets, isLoading, addTicket, updateTicket };
}

/* ── Ticket messages (backend real) ── */

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_MESSAGES: SupportMessage[] = [];

export function useTicketMessages(ticketId: string) {
  const queryClient = useQueryClient();

  const { data: messages = EMPTY_MESSAGES, isLoading } = useQuery<SupportMessage[]>({
    queryKey: ["support_ticket_messages", ticketId],
    queryFn: async (): Promise<SupportMessage[]> =>
      api.get<SupportMessage[]>(`/support-tickets/${ticketId}/messages`),
    enabled: Boolean(ticketId),
    staleTime: 10_000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ text, role }: { text: string; role: "user" | "support" }) =>
      api.post<SupportMessage>(`/support-tickets/${ticketId}/messages`, {
        message: text,
        internal_note: role === "user" ? false : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_ticket_messages", ticketId] }),
    onError: () => toast.error("Erro ao enviar mensagem. Tente novamente."),
  });

  const addMessage = useCallback(
    (text: string, role: "user" | "support" = "support"): Promise<SupportMessage> =>
      addMutation.mutateAsync({ text, role }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticketId],
  );

  return { messages, isLoading, addMessage, isSending: addMutation.isPending };
}

/* ── Knowledge Base (real backend — Decision Gate item 8). GLOBAL content
   (Music OS 360 writes, every tenant reads) — see knowledge-base.service.ts. ── */

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_CATEGORIES: ApiKnowledgeCategory[] = [];
const EMPTY_ARTICLES: ApiKnowledgeArticle[] = [];

export function useKnowledgeCategories() {
  const queryClient = useQueryClient();
  const { data: raw = EMPTY_CATEGORIES, isLoading } = useQuery<ApiKnowledgeCategory[]>({
    queryKey: ["knowledge_categories"],
    queryFn: () => knowledgeBaseService.listCategories(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge_categories"] });
    queryClient.invalidateQueries({ queryKey: ["knowledge_articles"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: { slug: string; name: string; description?: string; icon?: string; color?: string }) =>
      knowledgeBaseService.createCategory(data),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao criar categoria. Tente novamente."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ slug: string; name: string; description: string; icon: string; color: string }> }) =>
      knowledgeBaseService.updateCategory(id, data),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao atualizar categoria. Tente novamente."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deleteCategory(id),
    onSuccess: invalidate,
    onError: (error: unknown) => {
      const message = toUserMessage(error, "Erro ao excluir categoria.");
      toast.error(message);
    },
  });

  const categories: KnowledgeCategory[] = raw
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      icon: c.icon ?? "BookOpen",
      color: c.color ?? "primary",
      article_count: 0, // filled in by the consumer via a local count of the articles
    }));

  return {
    categories,
    rawCategories: raw,
    isLoading,
    createCategory: (data: { slug: string; name: string; description?: string; icon?: string; color?: string }) =>
      createMutation.mutateAsync(data),
    updateCategory: (id: string, data: Partial<{ slug: string; name: string; description: string; icon: string; color: string }>) =>
      updateMutation.mutateAsync({ id, data }),
    removeCategory: (id: string) => deleteMutation.mutateAsync(id),
  };
}

function mapArticle(a: ApiKnowledgeArticle, categoryName: string): KnowledgeArticle {
  return {
    id: a.id,
    category_id: a.category_id,
    category_name: categoryName,
    title: a.title,
    summary: a.summary,
    content: a.content,
    views: a.views,
    helpful_count: a.helpful_count,
    featured: a.featured,
    created_at: a.created_at,
    updated_at: a.updated_at,
    read_time: a.read_time,
    type: a.type,
    published: a.status === "published",
    status: a.status,
    order: a.sort_order,
  };
}

/** Public read (authenticated tenant) — published articles only. */
export function useKnowledgeArticles() {
  const { rawCategories } = useKnowledgeCategories();
  const { data: raw = EMPTY_ARTICLES, isLoading } = useQuery<ApiKnowledgeArticle[]>({
    queryKey: ["knowledge_articles", "public"],
    queryFn: () => knowledgeBaseService.listPublicArticles(),
    staleTime: 30_000,
  });

  const categoryNameById = new Map(rawCategories.map((c) => [c.id, c.name]));
  const articles = raw.map((a) => mapArticle(a, categoryNameById.get(a.category_id) ?? "Geral"));

  const incrementViews = useCallback((id: string) => {
    knowledgeBaseService.incrementViews(id).catch(() => {});
  }, []);

  return { articles, isLoading, incrementViews };
}

/** Authoring (super_admin) — every status/type, with full CRUD. */
export function useKnowledgeArticlesAdmin() {
  const queryClient = useQueryClient();
  const { rawCategories } = useKnowledgeCategories();
  const { data: raw = EMPTY_ARTICLES, isLoading } = useQuery<ApiKnowledgeArticle[]>({
    queryKey: ["knowledge_articles", "admin"],
    queryFn: () => knowledgeBaseService.listAllArticles(),
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["knowledge_articles"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateArticleInput) => knowledgeBaseService.createArticle(data),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao criar conteúdo. Tente novamente."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateArticleInput> }) =>
      knowledgeBaseService.updateArticle(id, data),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao atualizar conteúdo. Tente novamente."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deleteArticle(id),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao excluir conteúdo. Tente novamente."),
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      knowledgeBaseService.moveArticle(id, direction),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao reordenar. Tente novamente."),
  });

  const categoryNameById = new Map(rawCategories.map((c) => [c.id, c.name]));
  const articles = raw.map((a) => mapArticle(a, categoryNameById.get(a.category_id) ?? "Geral"));

  return {
    articles,
    isLoading,
    createArticle: (data: Partial<KnowledgeArticle> & Pick<KnowledgeArticle, "title" | "category_id" | "content">) =>
      createMutation.mutateAsync({
        category_id: data.category_id,
        title: data.title,
        summary: data.summary,
        content: data.content,
        type: data.type,
        status: data.status,
        featured: data.featured,
      }),
    updateArticle: (id: string, data: Partial<KnowledgeArticle>) =>
      updateMutation.mutateAsync({
        id,
        data: {
          category_id: data.category_id,
          title: data.title,
          summary: data.summary,
          content: data.content,
          type: data.type,
          status: data.status,
          featured: data.featured,
        },
      }),
    removeArticle: (id: string) => deleteMutation.mutateAsync(id),
    togglePublished: (id: string) => {
      const current = raw.find((a) => a.id === id);
      if (!current) return Promise.resolve();
      return updateMutation.mutateAsync({ id, data: { status: current.status === "published" ? "draft" : "published" } });
    },
    moveArticle: (id: string, direction: "up" | "down") => moveMutation.mutateAsync({ id, direction }),
  };
}

/* ── Requests (real backend — GAP-05c of the product completeness audit) ── */

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_REQUESTS: SupportRequest[] = [];

export function useRequests() {
  const queryClient = useQueryClient();

  const { data: requests = EMPTY_REQUESTS, isLoading } = useQuery<SupportRequest[]>({
    queryKey: ["support_requests"],
    queryFn: async (): Promise<SupportRequest[]> => api.get<SupportRequest[]>("/support-requests"),
    staleTime: 15_000,
  });

  const addMutation = useMutation({
    mutationFn: async (data: Pick<SupportRequest, "title" | "description" | "type" | "priority">) =>
      api.post<SupportRequest>("/support-requests", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_requests"] }),
    onError: () => toast.error("Erro ao enviar solicitação. Tente novamente."),
  });

  const upvoteMutation = useMutation({
    mutationFn: async (id: string) => api.post<SupportRequest>(`/support-requests/${id}/upvote`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_requests"] }),
    onError: () => toast.error("Erro ao votar. Tente novamente."),
  });

  const addRequest = useCallback(
    (data: Pick<SupportRequest, "title" | "description" | "type" | "priority">): Promise<SupportRequest> =>
      addMutation.mutateAsync(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const upvote = useCallback(
    (id: string): Promise<SupportRequest> => upvoteMutation.mutateAsync(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { requests, isLoading, addRequest, upvote, isCreating: addMutation.isPending };
}

/* ── Label maps ── */

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  waiting_customer: "Aguardando",
  resolved: "Resolvido",
  closed: "Fechado",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: "Financeiro e cobrança",
  technical: "Problema técnico",
  "feature-request": "Sugestão de funcionalidade",
  access: "Acesso e permissões",
  other: "Outro",
};

export const REQUEST_STATUS_LABELS: Record<SupportRequest["status"], string> = {
  pending: "Pendente",
  in_review: "Em Análise",
  approved: "Aprovado",
  rejected: "Recusado",
  done: "Concluído",
};

export const REQUEST_TYPE_LABELS: Record<SupportRequest["type"], string> = {
  feature: "Feature",
  bug: "Bug",
  question: "Pergunta",
  billing: "Cobrança",
  integration: "Integração",
};
