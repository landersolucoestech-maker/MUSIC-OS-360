import type { AiGenerationPayload, AiGeneratedResult } from "../../types/marketing.types";
import { api } from "@/shared/lib/api-client";

export type AiProviderId = "api";

export type AiProvider = {
  id: AiProviderId;
  generate(payload: AiGenerationPayload): Promise<AiGeneratedResult>;
};

const apiProvider: AiProvider = {
  id: "api",
  async generate(payload) {
    // POSTs to a dedicated endpoint whose JSON-only task framing is a FIXED
    // systemPrompt set server-side (AIService.generateMarketingSuggestion) --
    // never the generic /ai/generate, which would require concatenating that
    // instruction into the same untrusted string as targetName/prompt/
    // lyricText/audience/channels, with no structural separation from
    // user-controlled content (find-62e6b1b1, a real prompt-injection
    // surface: the model had no reliable way to tell task framing apart from
    // attacker/user-controlled data in that single message).
    const response = await api.post<{ content: string }>("/ai/marketing-suggestion", {
      kind: payload.kind,
      targetType: payload.targetType,
      targetName: payload.targetName,
      prompt: payload.prompt,
      lyricText: payload.lyricText,
      audience: payload.audience,
      channels: payload.channels,
    });
    const parsed = JSON.parse(response.content) as Partial<AiGeneratedResult>;
    const requiredArrays = [
      "strengths", "risks", "audience", "positioning", "contentIdeas",
      "campaignIdeas", "pitchSuggestions", "nextActions",
    ] as const;
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.creativeDirection !== "string" ||
      requiredArrays.some((key) => !Array.isArray(parsed[key]))
    ) {
      throw new Error("[marketing] resposta inválida do provedor de IA");
    }
    return parsed as AiGeneratedResult;
  },
};

export function getAiProviderRouter() {
  return {
    primary: apiProvider,
    async generate(payload: AiGenerationPayload) {
      return apiProvider.generate(payload);
    },
  };
}
