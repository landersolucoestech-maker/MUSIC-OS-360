/**
 * Creative asset card — thumbnail/placeholder, category, approval status, tags.
 */

import { FileImage, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { ASSET_CATEGORY_LABEL } from "../constants/marketing.constants";
import type { MarketingAsset } from "../types/marketing.types";
import { ApprovalBadge } from "./MarketingStatusBadge";
import { StoredFileLink } from "@/shared/components/StoredFileLink";
import { safeImageSrc } from "@/shared/lib/safe-url";

interface MarketingAssetCardProps {
  asset: MarketingAsset;
  onClick?: (asset: MarketingAsset) => void;
}

export function MarketingAssetCard({ asset, onClick }: MarketingAssetCardProps) {
  return (
    <Card
      className="overflow-hidden"
      onClick={onClick ? () => onClick(asset) : undefined}
      role={onClick ? "button" : undefined}
    >
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {safeImageSrc(asset.thumbnailUrl) ? (
          <img
            src={safeImageSrc(asset.thumbnailUrl)}
            alt={asset.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileImage className="h-8 w-8 text-muted-foreground/50" />
        )}
        <div className="absolute right-2 top-2">
          <ApprovalBadge status={asset.approval} />
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug line-clamp-1">{asset.name}</p>
          <StoredFileLink
            url={asset.url}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Abrir ativo"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </StoredFileLink>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {ASSET_CATEGORY_LABEL[asset.category]}
        </p>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
