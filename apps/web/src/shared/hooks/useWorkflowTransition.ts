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

export function useWorkflowTransition({
  table,
  id,
  queryKey,
  onSuccess,
}: UseWorkflowTransitionOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (toStatus: string) => {
      await storage.update<StorageRow>(table, id, { status: toStatus });
    },
    onSuccess: (_data, toStatus) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Status atualizado com sucesso.');
      onSuccess?.(toStatus);
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
