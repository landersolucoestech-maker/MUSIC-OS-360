import type { Artist } from "@/modules/artist/hooks/useArtists";
import type { LancamentoWithRelations } from "@/modules/releases/hooks/useLancamentos";
import type {
  AiSuggestion,
  AnalyticsOverview,
  MarketingCampaign,
  MarketingContent,
  MarketingProject,
  MarketingTask,
} from "../../types/marketing.types";

export type IntelligenceSources = {
  releases: LancamentoWithRelations[];
  projects: MarketingProject[];
  campaigns: MarketingCampaign[];
  contents: MarketingContent[];
  tasks: MarketingTask[];
  suggestions: AiSuggestion[];
  analytics?: AnalyticsOverview;
};

export type IntelligenceEntity = {
  id: string;
  label: string;
  helper?: string;
};

export type TrackAudioAnalysis = {
  status: "pending" | "processing" | "completed" | "error";
  provider: string;
  bpm?: string;
  key?: string;
  scale?: string;
  energy?: string;
  danceability?: string;
  mood?: string;
  genrePrediction?: string;
  subgenrePrediction?: string;
  instrumentation?: string[];
  structure?: string[];
  missingData: string[];
  errorMessage?: string;
};

export type TrackLyricsAnalysis = {
  status: "pending" | "completed" | "error";
  provider: string;
  mainTheme?: string;
  secondaryThemes: string[];
  sentiment?: string;
  narrativeType?: string;
  tone?: string;
  hooks: string[];
  viralPhrases: string[];
  keywords: string[];
  targetAudience?: string;
  editorialTags: string[];
  missingData: string[];
  errorMessage?: string;
};

export type TrackDiagnosis = {
  genre: string;
  subgenre: string;
  bpm: string;
  key: string;
  mood: string;
  energy: string;
  theme: string;
  sentiment: string;
  targetAudience: string;
  editorialTags: string[];
  playlistFit: string[];
  platformPriority: string[];
  commercialPotential: string;
  viralPotential: string;
  syncPotential: string;
  differentiators: string[];
  risks: string[];
  missingData: string[];
};

export type ReleaseContext = {
  artist: IntelligenceEntity;
  release: IntelligenceEntity;
  releaseRecord?: LancamentoWithRelations;
  audioUrl: string;
  lyric: string;
  coverUrl: string;
  genre: string;
  subgenre: string;
  mood: string;
  bpm: string;
  isrc: string;
  upc: string;
  releaseDate: string;
  credits: string;
  references: string;
  artistHistory: string[];
  relatedCampaigns: MarketingCampaign[];
  relatedMetrics: string[];
  audioAnalysis: TrackAudioAnalysis;
  lyricsAnalysis: TrackLyricsAnalysis;
  diagnosis: TrackDiagnosis;
};

export type ArtistProfileContext = {
  artist: IntelligenceEntity;
  artistRecord?: Artist;
  predominantGenre: string;
  subgenres: string[];
  moods: string[];
  references: string[];
  publicSignals: string[];
  careerStage: string;
  growthRhythm: string;
  catalog: {
    totalReleases: number;
    totalTracks: number;
    releaseDates: string[];
    frequency: string;
    isrcs: string[];
  };
  operations: {
    projects: MarketingProject[];
    campaigns: MarketingCampaign[];
    contents: MarketingContent[];
    tasks: MarketingTask[];
    pitchings: AiSuggestion[];
    completedTasks: number;
    openTasks: number;
  };
  scores: {
    geral: number;
    branding: number;
    catalogo: number;
    engajamento: number;
    consistencia: number;
    crescimento: number;
  };
  bottleneck: string;
  actionPlan: {
    d30: string[];
    d60: string[];
    d90: string[];
  };
};

export type PlanningContext = {
  artist?: IntelligenceEntity;
  release?: IntelligenceEntity;
  objective: string;
  platform: string;
  period: "7" | "30" | "60" | "90";
  items: Array<{
    id: string;
    title: string;
    type: string;
    dueInDays: number;
    owner: string;
    channel: string;
    priority: string;
  }>;
};

