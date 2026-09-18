import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

/**
 * useSkillRun — invocação genérica de um AI Skill ON_DEMAND real (backend
 * runOnDemandSkill / packages/ai-skills/*). Cada skill já tem seu próprio
 * endpoint real (POST .../ai/<skill>); este hook só padroniza a chamada
 * HTTP + estado de loading/erro/toast, nunca fabrica um resultado.
 *
 * O envelope retornado pelo backend é sempre { parsed, provider, model,
 * generatedAt, fromCache, skillRunId } — parsed é o output tipado da skill.
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
      toast.error(`IA: ${error.message}`);
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
