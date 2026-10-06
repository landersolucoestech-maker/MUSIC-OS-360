import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { marketingService } from "../services/marketing.service";
import { getAiProviderRouter } from "../ai/providers/providerRouter";
import { MARKETING_QUERY_ROOT } from "./useMarketingResource";
import type { AiGenerationPayload } from "../types/marketing.types";

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_SUGGESTIONS: Awaited<ReturnType<typeof marketingService.getAiSuggestions>> = [];

export function useAiSuggestions() {
  const query = useQuery({
    queryKey: [MARKETING_QUERY_ROOT, "ai-suggestions"],
    queryFn: () => marketingService.getAiSuggestions(),
  });
  return { ...query, data: query.data ?? EMPTY_SUGGESTIONS };
}

export function useGenerateAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AiGenerationPayload) => {
      const output = await getAiProviderRouter().generate(payload);
      const { audioFile: _audioFile, ...persistablePayload } = payload;
      return marketingService.addAiSuggestion({ ...persistablePayload, output });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MARKETING_QUERY_ROOT, "ai-suggestions"] });
      toast.success("Sugestões geradas");
    },
    onError: () => toast.error("Erro ao gerar sugestões"),
  });
}
