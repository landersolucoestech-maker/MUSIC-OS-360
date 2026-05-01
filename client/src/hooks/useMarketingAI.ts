import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DisabledIntegrationError } from "@/lib/disabled-integration";

/** Stub da IA Criativa — desligada (sem backend para chamar OpenAI). */

export type ContentType =
  | "post"
  | "caption"
  | "bio"
  | "press-release"
  | "email"
  | "ad"
  | "lancamento"
  | "engajamento"
  | "branding";

interface GenerateContentParams {
  type: ContentType;
  artistName: string;
  genre?: string;
  context?: string;
  platform?: string;
  tone?: string;
  language?: string;
}

interface GenerateContentResponse {
  content: string;
  type: string;
  artistName: string;
  generatedAt: string;
}

export function useMarketingAI() {
  const generateContent = useMutation({
    mutationFn: async (
      _params: GenerateContentParams,
    ): Promise<GenerateContentResponse> => {
      throw new DisabledIntegrationError("IA Criativa");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    generateContent,
    isGenerating: generateContent.isPending,
  };
}
