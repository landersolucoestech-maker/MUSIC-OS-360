import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { toUserMessage } from "@/shared/lib/errors";
export type AiGenerateType =
  | "bio"
  | "description"
  | "copy"
  | "briefing"
  | "insights"
  | "summary"
  | "strategy"
  | "profile"
  | "post"
  | "caption"
  | "press-release"
  | "email"
  | "ad";

export interface AiGenerateParams {
  prompt: string;
  type: AiGenerateType;
}

export interface AiGenerateResult {
  content: string;
}

async function callAi(params: AiGenerateParams): Promise<AiGenerateResult> {
  const res = await fetch("/api/v1/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `AI request failed (HTTP ${res.status})`);
  }
  return res.json();
}

export function useAi() {
  const generate = useMutation({
    mutationFn: callAi,
    onError: (error: Error) => {
      toast.error(`IA: ${toUserMessage(error)}`);
    },
  });

  return {
    generate,
    isGenerating: generate.isPending,
    callAi,
  };
}
