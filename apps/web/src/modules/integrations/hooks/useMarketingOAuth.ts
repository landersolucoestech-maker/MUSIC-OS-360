/**
 * OAuth state for corporate marketing integrations.
 *
 * Tokens never cross the browser boundary. The backend exchanges authorization
 * codes, encrypts credentials in oauth_connections and exposes only status and
 * disconnect operations to the authenticated frontend.
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "@/shared/lib/api-client";
import type {
  MarketingPlatformId,
  MarketingCategory,
  IMarketingOAuthConnection,
} from "@/shared/integrations/contracts/marketing.contract";

export type { MarketingPlatformId };

export const MARKETING_PLATFORM_CATEGORY: Record<MarketingPlatformId, MarketingCategory> = {
  meta_business: "corporate_metrics",
  youtube_business: "corporate_metrics",
  tiktok_business: "corporate_metrics",
  google_business: "corporate_metrics",
  corp_spotify: "corporate_metrics",
  corp_deezer: "corporate_metrics",
  corp_soundcloud: "corporate_metrics",
  corp_apple_music: "corporate_metrics",
  corp_instagram: "corporate_metrics",
  corp_tiktok: "corporate_metrics",
  corp_youtube: "corporate_metrics",
  meta_ads: "paid_ads",
  google_ads: "paid_ads",
  tiktok_ads: "paid_ads",
  youtube_ads: "paid_ads",
  spotify_ads: "paid_ads",
  deezer_ads: "paid_ads",
  apple_music_ads: "paid_ads",
  soundcloud_ads: "paid_ads",
};

const SERVER_OAUTH_PLATFORMS: readonly MarketingPlatformId[] = [
  "corp_instagram",
  "meta_business",
  "meta_ads",
  "corp_tiktok",
  "tiktok_business",
  "tiktok_ads",
  "corp_youtube",
  "youtube_business",
  "google_business",
  "google_ads",
  "youtube_ads",
  "corp_spotify",
  "spotify_ads",
];

const SERVER_OAUTH_PLATFORM_SET = new Set<MarketingPlatformId>(SERVER_OAUTH_PLATFORMS);

type ConnectionMap = Partial<Record<MarketingPlatformId, IMarketingOAuthConnection>>;
type OAuthStatus = { connected: boolean; needs_reauth?: boolean };

/** Exported for direct unit-testing of the wire-status -> connection mapping. */
export function toConnection(
  platform: MarketingPlatformId,
  status: OAuthStatus,
  scopes: string[] = [],
): IMarketingOAuthConnection {
  return {
    platform,
    connected: status.connected,
    needsReauth: status.needs_reauth === true,
    scopes,
    category: MARKETING_PLATFORM_CATEGORY[platform],
  };
}

export function useMarketingOAuth() {
  const [connections, setConnections] = useState<ConnectionMap>({});

  const refreshConnection = useCallback(
    async (platform: MarketingPlatformId, scopes: string[] = []): Promise<boolean> => {
      if (!SERVER_OAUTH_PLATFORM_SET.has(platform)) return false;

      const status = await api.get<OAuthStatus>(
        `/integrations/oauth/status?platform=${encodeURIComponent(platform)}`,
      );

      setConnections((previous) => {
        const next = { ...previous };
        if (status.connected) next[platform] = toConnection(platform, status, scopes);
        else delete next[platform];
        return next;
      });

      return status.connected;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled(
      SERVER_OAUTH_PLATFORMS.map(async (platform) => {
        const status = await api.get<OAuthStatus>(
          `/integrations/oauth/status?platform=${encodeURIComponent(platform)}`,
        );
        if (cancelled) return;
        setConnections((previous) => {
          const next = { ...previous };
          if (status.connected) next[platform] = toConnection(platform, status);
          else delete next[platform];
          return next;
        });
      }),
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(
    async (platform: MarketingPlatformId, scopes: string[]): Promise<void> => {
      if (!SERVER_OAUTH_PLATFORM_SET.has(platform)) {
        throw new Error(`OAuth server-side ainda não implementado para ${platform}.`);
      }
      const connected = await refreshConnection(platform, scopes);
      if (!connected) {
        throw new Error(`A plataforma ${platform} não confirmou a conexão persistida.`);
      }
    },
    [refreshConnection],
  );

  const disconnect = useCallback(async (platform: MarketingPlatformId): Promise<void> => {
    if (!SERVER_OAUTH_PLATFORM_SET.has(platform)) {
      setConnections((previous) => {
        const next = { ...previous };
        delete next[platform];
        return next;
      });
      return;
    }

    await api.delete(
      `/integrations/oauth/disconnect?platform=${encodeURIComponent(platform)}`,
    );
    setConnections((previous) => {
      const next = { ...previous };
      delete next[platform];
      return next;
    });
  }, []);

  const getConnection = useCallback(
    (platform: MarketingPlatformId): IMarketingOAuthConnection | undefined =>
      connections[platform],
    [connections],
  );

  const isConnected = useCallback(
    (platform: MarketingPlatformId): boolean =>
      connections[platform]?.connected === true,
    [connections],
  );

  const needsReauth = useCallback(
    (platform: MarketingPlatformId): boolean =>
      connections[platform]?.needsReauth === true,
    [connections],
  );

  const getConnectionsByCategory = useCallback(
    (category: MarketingCategory): IMarketingOAuthConnection[] =>
      Object.values(connections).filter(
        (connection): connection is IMarketingOAuthConnection =>
          connection !== undefined && connection.category === category,
      ),
    [connections],
  );

  const connectedCountByCategory = useCallback(
    (category: MarketingCategory): number =>
      Object.values(connections).filter(
        (connection) => connection?.category === category && connection.connected,
      ).length,
    [connections],
  );

  const totalConnected = useCallback(
    (): number =>
      Object.values(connections).filter((connection) => connection?.connected).length,
    [connections],
  );

  return {
    connections,
    connect,
    disconnect,
    refreshConnection,
    getConnection,
    isConnected,
    needsReauth,
    getConnectionsByCategory,
    connectedCountByCategory,
    totalConnected,
  };
}
