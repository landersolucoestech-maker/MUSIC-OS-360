import { marketingService } from "../services/marketing.service";
import type { AssetCategory, MarketingAsset } from "../types/marketing.types";
import { createResourceHooks } from "./useMarketingResource";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";

const hooks = createResourceHooks<MarketingAsset>("assets", marketingService.assets, {
  singular: "Ativo",
});

export const useMarketingAssets = hooks.useList;
export const useCreateAsset = hooks.useCreate;
export const useUpdateAsset = hooks.useUpdate;
export const useRemoveAsset = hooks.useRemove;

type ProjectAsset = MarketingAsset & {
  title?: string;
  asset_type?: string;
  file_url?: string | null;
  thumbnail_url?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

const ASSET_TYPE_CATEGORY: Record<string, AssetCategory> = {
  AUDIO: "asset_campanha",
  COVER: "capa",
  ARTWORK: "arte_promocional",
  PHOTO: "fotografia",
  REEL: "reels",
  TEASER: "teaser",
  VISUALIZER: "video",
  LYRIC_VIDEO: "video",
  MUSIC_VIDEO: "video",
  PRESS_KIT: "press_kit",
  DOCUMENT: "documento_estrategico",
  INSTITUTIONAL: "material_institucional",
  AD_CREATIVE: "asset_campanha",
  LOGO: "logo",
  CORPORATE_MATERIAL: "material_comercial",
  OTHER: "asset_campanha",
};

function normalizeProjectAsset(asset: ProjectAsset): MarketingAsset {
  const metadata = asset.metadata ?? {};
  const category = asset.category ?? ASSET_TYPE_CATEGORY[asset.asset_type ?? ""] ?? "asset_campanha";
  const stamp = new Date().toISOString();
  return {
    ...asset,
    name: asset.name ?? asset.title ?? "Ativo aprovado",
    category,
    projectId: asset.projectId ?? (metadata.projectId as string | undefined),
    taskId: asset.taskId ?? (metadata.taskId as string | undefined),
    sourceDepartment: asset.sourceDepartment ?? (metadata.sourceDepartment as string | undefined),
    owner: asset.owner ?? "Sistema",
    approval: asset.approval ?? "approved",
    url: asset.url ?? asset.file_url ?? "",
    thumbnailUrl: asset.thumbnailUrl ?? asset.thumbnail_url ?? undefined,
    tags: asset.tags ?? [],
    notes: asset.notes ?? "",
    createdAt: asset.createdAt ?? stamp,
    updatedAt: asset.updatedAt ?? stamp,
  };
}

export function useProjectAssetLibrary(projectId?: string | null) {
  return useQuery({
    queryKey: ["marketing", "project-asset-library", projectId],
    enabled: Boolean(projectId && projectId !== "none"),
    queryFn: async () => {
      const assets = await api.get<ProjectAsset[]>(
        `/marketing/assets/project/${projectId}/library`,
      );
      return assets.map(normalizeProjectAsset);
    },
  });
}
