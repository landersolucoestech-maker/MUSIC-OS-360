import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Clock, Lightbulb, Send, Sparkles, TrendingUp, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useTenant } from "@/app/providers/TenantContext";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { useMarketingAnalytics } from "../../hooks/useMarketingAnalytics";
import { useMarketingCampaigns } from "../../hooks/useMarketingCampaigns";
import { useMarketingContents } from "../../hooks/useMarketingContents";
import { useMarketingProjects } from "../../hooks/useMarketingProjects";
import { useMarketingTasks } from "../../hooks/useMarketingTasks";
import { useAiSuggestions, useGenerateAi } from "../../hooks/useMarketingAI";
import type { AiGenerationPayload } from "../../types/marketing.types";
import type { AiTab, TargetOption } from "./aiCreative.types";
import { IdeasTab } from "./IdeasTab";
import { ProfileTab } from "./ProfileTab";
import { PitchingTab } from "./PitchingTab";
import { TrendsTab } from "./TrendsTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { HistoryTab } from "./HistoryTab";
import { PlanningTab } from "./PlanningTab";

const TABS: Array<{ value: AiTab; label: string; icon: typeof Sparkles }> = [
  { value: "ideias", label: "Ideias", icon: Lightbulb },
  { value: "perfil", label: "Perfil", icon: UserRound },
  { value: "pitching", label: "Pitching", icon: Send },
  { value: "tendencias", label: "Tendências", icon: TrendingUp },
  { value: "analytics", label: "Métricas", icon: BarChart3 },
  { value: "planejamento", label: "Planejamento", icon: CalendarDays },
  { value: "historico", label: "Histórico", icon: Clock },
];

function isAiTab(value: string): value is AiTab {
  return TABS.some((tab) => tab.value === value);
}

export function AiCreativeWorkspace() {
  const { tenant } = useTenant();
  const { data: suggestions = [] } = useAiSuggestions();
  const { releases: releases = [] } = useReleases();
  const { data: marketingProjects = [] } = useMarketingProjects();
  const { data: campaigns = [] } = useMarketingCampaigns();
  const { data: contents = [] } = useMarketingContents();
  const { data: tasks = [] } = useMarketingTasks();
  const { data: analytics } = useMarketingAnalytics();
  const generate = useGenerateAi();
  const [activeTab, setActiveTab] = useState<AiTab>("ideias");

  const campaignOptions = useMemo<TargetOption[]>(() => (
    campaigns
      .map((campaign) => ({
        id: campaign.id,
        label: campaign.name,
        helper: campaign.status,
      }))
      .filter((option) => option.id && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }))
  ), [campaigns]);

  const handleGenerate = (payload: AiGenerationPayload) => generate.mutate(payload);
  const companyName = tenant.name || "Empresa";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isAiTab(value)) setActiveTab(value);
      }}
      className="space-y-6"
    >
      <TabsList className="flex-wrap h-auto">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex items-center gap-2"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="ideias">
        <IdeasTab
          campaignOptions={campaignOptions}
          suggestions={suggestions}
          onGenerate={handleGenerate}
          isGenerating={generate.isPending}
        />
      </TabsContent>
      <TabsContent value="perfil">
        <ProfileTab
          sources={{
            releases,
            projects: marketingProjects,
            campaigns,
            contents,
            tasks,
            suggestions,
          }}
          onGenerate={handleGenerate}
          isGenerating={generate.isPending}
        />
      </TabsContent>
      <TabsContent value="pitching">
        <PitchingTab
          sources={{
            releases,
            projects: marketingProjects,
            campaigns,
            contents,
            tasks,
            suggestions,
            analytics,
          }}
          onGenerate={handleGenerate}
          isGenerating={generate.isPending}
        />
      </TabsContent>
      <TabsContent value="tendencias">
        <TrendsTab companyName={companyName} suggestions={suggestions} onGenerate={handleGenerate} isGenerating={generate.isPending} />
      </TabsContent>
      <TabsContent value="analytics">
        <AnalyticsTab
          companyName={companyName}
          analytics={analytics}
          contents={contents}
          campaigns={campaigns}
          suggestions={suggestions}
          onGenerate={handleGenerate}
          isGenerating={generate.isPending}
        />
      </TabsContent>
      <TabsContent value="planejamento">
        <PlanningTab
          releaseOptions={releases.map((release) => ({ id: release.id, label: release.title, helper: release.music_genre || undefined }))}
          onGenerate={handleGenerate}
          isGenerating={generate.isPending}
        />
      </TabsContent>
      <TabsContent value="historico">
        <HistoryTab suggestions={suggestions} onGenerate={handleGenerate} />
      </TabsContent>
    </Tabs>
  );
}


