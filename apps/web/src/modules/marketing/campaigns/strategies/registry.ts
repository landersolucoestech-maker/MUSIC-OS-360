/**
 * Campaigns domain — platform registry.
 *
 * Resolves a strategy by platform. Adding a new platform = implement a strategy
 * and register it here; the CampaignService / factory stays untouched.
 */

import type { PaidMediaPlatform } from "../domain/campaign-domain.types";
import type { CampaignPlatformStrategy } from "./strategy.contract";
import { MetaAdsStrategy } from "./meta-ads.strategy";
import { GoogleAdsStrategy } from "./google-ads.strategy";
import { YouTubeAdsStrategy } from "./youtube-ads.strategy";
import { TikTokAdsStrategy } from "./tiktok-ads.strategy";
import { SpotifyAdsStrategy } from "./spotify-ads.strategy";

export class CampaignPlatformRegistry {
  private readonly strategies = new Map<PaidMediaPlatform, CampaignPlatformStrategy>();

  register(strategy: CampaignPlatformStrategy): void {
    this.strategies.set(strategy.platform, strategy);
  }

  has(platform: PaidMediaPlatform): boolean {
    return this.strategies.has(platform);
  }

  /** Resolve a strategy or throw — unknown/unsupported platforms fail loudly. */
  resolve(platform: PaidMediaPlatform): CampaignPlatformStrategy {
    const strategy = this.strategies.get(platform);
    if (!strategy) {
      throw new Error(`[campaigns] Unsupported platform: ${platform}`);
    }
    return strategy;
  }

  list(): PaidMediaPlatform[] {
    return [...this.strategies.keys()];
  }
}

/** Singleton registry with the five implemented platforms registered. */
export const campaignPlatformRegistry = new CampaignPlatformRegistry();
campaignPlatformRegistry.register(new MetaAdsStrategy());
campaignPlatformRegistry.register(new GoogleAdsStrategy());
campaignPlatformRegistry.register(new YouTubeAdsStrategy());
campaignPlatformRegistry.register(new TikTokAdsStrategy());
campaignPlatformRegistry.register(new SpotifyAdsStrategy());

