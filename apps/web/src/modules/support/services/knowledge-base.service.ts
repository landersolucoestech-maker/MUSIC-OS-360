/**
 * services/knowledge-base.service.ts
 *
 * Support Center — knowledge base (Decision Gate item 8). GLOBAL
 * content (not tenant-scoped) — see apps/api/.../knowledge-base.controller.ts.
 * /knowledge-articles returns only published content (tenant read);
 * /knowledge-articles/admin returns every status (authoring, super_admin).
 */
import { api } from "@/shared/lib/api-client";

export interface ApiKnowledgeCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface ApiKnowledgeArticle {
  id: string;
  category_id: string;
  title: string;
  summary: string;
  content: string;
  type: "article" | "faq" | "tutorial" | "internal_doc";
  status: "draft" | "published" | "archived";
  featured: boolean;
  views: number;
  helpful_count: number;
  read_time: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateArticleInput {
  category_id: string;
  title: string;
  summary?: string;
  content: string;
  type?: string;
  status?: string;
  featured?: boolean;
}

export const knowledgeBaseService = {
  listCategories: () => api.get<ApiKnowledgeCategory[]>("/knowledge-categories"),
  createCategory: (payload: { slug: string; name: string; description?: string; icon?: string; color?: string }) =>
    api.post<ApiKnowledgeCategory>("/knowledge-categories", payload),
  updateCategory: (id: string, payload: Partial<{ slug: string; name: string; description: string; icon: string; color: string }>) =>
    api.patch<ApiKnowledgeCategory>(`/knowledge-categories/${id}`, payload),
  deleteCategory: (id: string) => api.delete(`/knowledge-categories/${id}`),

  listPublicArticles: () => api.get<ApiKnowledgeArticle[]>("/knowledge-articles"),
  listAllArticles: () => api.get<ApiKnowledgeArticle[]>("/knowledge-articles/admin"),
  createArticle: (payload: CreateArticleInput) => api.post<ApiKnowledgeArticle>("/knowledge-articles", payload),
  updateArticle: (id: string, payload: Partial<CreateArticleInput>) =>
    api.patch<ApiKnowledgeArticle>(`/knowledge-articles/${id}`, payload),
  deleteArticle: (id: string) => api.delete(`/knowledge-articles/${id}`),
  moveArticle: (id: string, direction: "up" | "down") =>
    api.patch<ApiKnowledgeArticle>(`/knowledge-articles/${id}/move`, { direction }),
  incrementViews: (id: string) => api.post(`/knowledge-articles/${id}/view`, {}),
};
