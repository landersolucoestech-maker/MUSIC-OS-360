import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { toUserMessage } from "@/shared/lib/errors";

/**
 * Real envelope returned by runOnDemandSkill() in the backend
 * (apps/api/src/core/automation/on-demand-skill.runner.ts) — kept in
 * manual sync here because the runner's types package is not exposed to the
 * frontend.
 */
export interface OnDemandSkillResult<TOutput> {
  parsed: TOutput;
  provider: string;
  model: string;
  generatedAt: string;
  fromCache: boolean;
  skillRunId: string;
}

/**
 * Generic hook to trigger a real ON_DEMAND AI Skill from a
 * product screen. Invents no state: success/error always come from the
 * real API response (never from a local sample value).
 */
export function useAiSkillRun<TOutput>(
  runFn: () => Promise<OnDemandSkillResult<TOutput>>,
  options?: { successMessage?: string },
) {
  const mutation = useMutation({
    mutationFn: runFn,
    onSuccess: (result) => {
      toast.success(
        options?.successMessage ??
          (result.fromCache ? "Resultado recente reaproveitado" : "Gerado com IA"),
      );
    },
    onError: (error: unknown) => {
      toast.error(`IA: ${toUserMessage(error)}`);
    },
  });

  return mutation;
}
