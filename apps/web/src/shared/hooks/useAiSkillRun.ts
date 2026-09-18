import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/lib/errors";

/**
 * Envelope real devolvido por runOnDemandSkill() no backend
 * (apps/api/src/core/automation/on-demand-skill.runner.ts) — mantido em
 * sincronia manual aqui pois o pacote de tipos do runner não é exposto ao
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
 * Hook genérico para disparar uma AI Skill ON_DEMAND real a partir de uma
 * tela do produto. Não inventa estado: sucesso/erro vêm sempre da resposta
 * real da API (nunca de um valor de amostra local).
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
      toast.error(`IA: ${getErrorMessage(error)}`);
    },
  });

  return mutation;
}
