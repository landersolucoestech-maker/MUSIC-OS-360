/**
 * useWorkflowTransition.ts
 *
 * Generic hook that wraps the storage.update call with a status payload.
 * Integrates with TanStack Query cache invalidation.
 *
 * Usage:
 *   const { transition, isPending } = useWorkflowTransition({
 *     table: 'releases',
 *     id: release.id,
 *     queryKey: ['releases'],
 *   });
 *   <WorkflowTransitionPanel onTransition={transition} isLoading={isPending} ... />
 */

import type { StorageTable } from "@/shared/lib/api-client";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { storage, type StorageRow } from '@/shared/lib/storage';

import { toUserMessage } from "@/shared/lib/errors";
interface UseWorkflowTransitionOptions {
  table: StorageTable;
  id: string;
  queryKey: unknown[];
  onSuccess?: (toStatus: string) => void;
}

/** A transition may carry metadata the server records with it (e.g. the confirmation that a release was distributed). */
export interface TransitionRequest {
  toStatus: string;
  metadata?: Record<string, unknown>;
}

function normalizeRequest(request: string | TransitionRequest): TransitionRequest {
  return typeof request === 'string' ? { toStatus: request } : request;
}

export function useWorkflowTransition({
  table,
  id,
  queryKey,
  onSuccess,
}: UseWorkflowTransitionOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (request: string | TransitionRequest) => {
      const { toStatus, metadata } = normalizeRequest(request);
      await storage.update<StorageRow>(table, id, { status: toStatus, ...(metadata ? { metadata } : {}) });
    },
    onSuccess: (_data, request) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Status atualizado com sucesso.');
      onSuccess?.(normalizeRequest(request).toStatus);
    },
    onError: (err: Error) => {
      toast.error(`Erro na transição: ${toUserMessage(err, 'Não foi possível alterar o status.')}`);
    },
  });

  return {
    transition:  mutation.mutateAsync,
    isPending:   mutation.isPending,
  };
}
