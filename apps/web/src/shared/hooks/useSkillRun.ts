import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * useSkillRun — generic invocation of a real ON_DEMAND AI Skill (backend
 * runOnDemandSkill / packages/ai-skills/*). Each skill already has its own
 * real endpoint (POST .../ai/<skill>); this hook only standardizes the
 * HTTP call + loading/error/toast state, never fabricates a result.
 *
 * The envelope returned by the backend is always { parsed, provider, model,
 * generatedAt, fromCache, skillRunId } — parsed is the skill's typed output.
 */
export interface SkillRunEnvelope<T> {
  parsed: T;
  provider: string;
  model: string;
  generatedAt: string;
  fromCache: boolean;
  skillRunId: string;
}

export function useSkillRun<T>(path: string) {
  const mutation = useMutation({
    mutationFn: (body?: Record<string, unknown>) => api.post<SkillRunEnvelope<T>>(path, body ?? {}),
    onError: (error: Error) => {
      toast.error(`IA: ${toUserMessage(error)}`);
    },
  });

  return {
    run: mutation.mutate,
    runAsync: mutation.mutateAsync,
    result: mutation.data,
    isRunning: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
