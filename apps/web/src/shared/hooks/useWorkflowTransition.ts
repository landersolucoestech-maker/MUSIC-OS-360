/**
 * useWorkflowTransition.ts
 *
 * Generic hook that wraps the storage.update call with a status payload.
 * Integrates with TanStack Query cache invalidation.
 *
 * Usage:
 *   const { transition, isPending } = useWorkflowTransition({
 *     table: 'lancamentos',
 *     id: release.id,
 *     queryKey: ['lancamentos'],
 *   });
 *   <WorkflowTransitionPanel onTransition={transition} isLoading={isPending} ... />
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { storage, type StorageRow } from '@/shared/lib/storage';

interface UseWorkflowTransitionOptions {
  table: string;
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
      toast.error(`Erro na transição: ${err.message ?? 'Não foi possível alterar o status.'}`);
    },
  });

  return {
    transition:  mutation.mutateAsync,
    isPending:   mutation.isPending,
  };
}
