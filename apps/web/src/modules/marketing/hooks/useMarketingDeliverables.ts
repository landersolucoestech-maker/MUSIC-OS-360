/**
 * Marketing — Deliverables hooks.
 *
 * Deliverables live on a task, so the list query is keyed by task id. Every
 * mutation (upload, new version, approval, comment, duplicate, edit, remove)
 * invalidates the marketing cache so the task view, linked release/campaign
 * views and the list all refresh together.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import {
  marketingService,
  type CreateDeliverableInput,
  type DeliverableFileInput,
  type DeliverableLink,
} from "../services/marketing.service";
import type { DeliverableApproval, ID, MarketingDeliverable } from "../types/marketing.types";
import { MARKETING_QUERY_ROOT } from "./useMarketingResource";

const DELIVERABLES_KEY = "deliverables";

function deliverablesKey() {
  return [MARKETING_QUERY_ROOT, DELIVERABLES_KEY] as const;
}

function deliverablesByTaskKey(taskId: ID) {
  return [MARKETING_QUERY_ROOT, DELIVERABLES_KEY, "task", taskId] as const;
}

function deliverablesByLinkKey(link: DeliverableLink) {
  return [MARKETING_QUERY_ROOT, DELIVERABLES_KEY, "link", link.kind, link.id] as const;
}

/** Deliverables produced inside a task. */
export function useMarketingDeliverables() {
  return useQuery({
    queryKey: deliverablesKey(),
    queryFn: () => marketingService.deliverables.list(),
  });
}

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_DELIVERABLES: Awaited<ReturnType<typeof marketingService.deliverables.listByTask>> = [];

/** Deliverables produced inside a task. */
export function useDeliverablesByTask(taskId: ID | null | undefined) {
  const query = useQuery({
    queryKey: deliverablesByTaskKey(taskId ?? "none"),
    queryFn: () => marketingService.deliverables.listByTask(taskId as ID),
    enabled: Boolean(taskId),
  });
  return { ...query, data: query.data ?? EMPTY_DELIVERABLES };
}

/** Deliverables reachable from a linked entity (release/campaign/content/...). */
export function useDeliverablesByLink(link: DeliverableLink | null) {
  return useQuery({
    queryKey: deliverablesByLinkKey(link ?? { kind: "release", id: "none" }),
    queryFn: () => marketingService.deliverables.listByLink(link as DeliverableLink),
    enabled: Boolean(link),
  });
}

function useInvalidateDeliverables() {
  const qc = useQueryClient();
  // Invalidate the whole deliverables subtree after server mutations and
  // keeps task + linked-entity views consistent without tracking every key.
  return () => qc.invalidateQueries({ queryKey: [MARKETING_QUERY_ROOT, DELIVERABLES_KEY] });
}

export function useCreateDeliverable() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: (input: CreateDeliverableInput) => marketingService.deliverables.create(input),
    onSuccess: () => {
      invalidate();
      toast.success("Entregável enviado");
    },
    onError: () => toast.error("Erro ao enviar entregável"),
  });
}

export function useUpdateDeliverable() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: ({ id, patch, expectedUpdatedAt }: { id: ID; patch: Partial<Pick<MarketingDeliverable, "title" | "description" | "type">>; expectedUpdatedAt?: string }) =>
      marketingService.deliverables.update(id, patch, expectedUpdatedAt),
    onSuccess: () => {
      invalidate();
      toast.success("Entregável atualizado");
    },
    onError: (error: unknown) => {
      if (handleConcurrencyConflict(error, "entregável")) return;
      toast.error("Erro ao atualizar entregável");
    },
  });
}

export function useAddDeliverableVersion() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: ({ id, file, note, expectedUpdatedAt }: { id: ID; file: DeliverableFileInput; note?: string; expectedUpdatedAt?: string }) =>
      marketingService.deliverables.addVersion(id, file, note, expectedUpdatedAt),
    onSuccess: () => {
      invalidate();
      toast.success("Nova versão enviada");
    },
    onError: (error: unknown) => {
      if (handleConcurrencyConflict(error, "entregável")) return;
      toast.error("Erro ao enviar nova versão");
    },
  });
}

export function useSetDeliverableApproval() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: ({ id, approval }: { id: ID; approval: DeliverableApproval }) =>
      marketingService.deliverables.setApproval(id, approval),
    onSuccess: () => {
      invalidate();
      toast.success("Status de aprovação atualizado");
    },
    onError: () => toast.error("Erro ao atualizar aprovação"),
  });
}

export function useAddDeliverableComment() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: ({ id, message }: { id: ID; message: string }) =>
      marketingService.deliverables.addComment(id, message),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao comentar"),
  });
}

export function useDuplicateDeliverable() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: (id: ID) => marketingService.deliverables.duplicate(id),
    onSuccess: () => {
      invalidate();
      toast.success("Entregável duplicado");
    },
    onError: () => toast.error("Erro ao duplicar entregável"),
  });
}

export function useRemoveDeliverable() {
  const invalidate = useInvalidateDeliverables();
  return useMutation({
    mutationFn: (id: ID) => marketingService.deliverables.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Entregável removido");
    },
    onError: () => toast.error("Erro ao remover entregável"),
  });
}
