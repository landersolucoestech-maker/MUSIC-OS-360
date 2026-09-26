import type { UseMutationResult } from "@tanstack/react-query";
import type { ReleaseWithRelations } from "@/modules/releases/hooks/useReleases";
import type {
  AiGenerationPayload,
  AiGeneratedResult,
  AiSuggestion,
  ContentChannel,
  MarketingCampaign,
  MarketingContent,
  MarketingProject,
  MarketingTask,
  MarketingTarget,
} from "../../types/marketing.types";

export type AiTab = "ideias" | "perfil" | "pitching" | "tendencias" | "analytics" | "planejamento" | "historico";

export type TargetOption = {
  id: string;
  label: string;
  helper?: string;
};

export type GenerateAiMutation = UseMutationResult<AiSuggestion, Error, AiGenerationPayload, unknown>;

export type GenerateAiHandler = (payload: AiGenerationPayload) => void;

export type ArtistProfileSources = {
  releases: ReleaseWithRelations[];
  projects: MarketingProject[];
  campaigns: MarketingCampaign[];
  contents: MarketingContent[];
  tasks: MarketingTask[];
  suggestions: AiSuggestion[];
};

export type ResultActionProps = {
  result: AiGeneratedResult | null;
  onCopy: () => void;
  onRegenerate: () => void;
  onSave?: () => void;
  canRegenerate: boolean;
  isGenerating: boolean;
};

export const DEFAULT_CHANNELS: ContentChannel[] = ["instagram", "tiktok", "youtube"];

export const TARGET_LABEL: Record<MarketingTarget, string> = {
  projeto_musical: "Projeto Musical",
  artista: "Artista",
  empresa: "Empresa",
};

