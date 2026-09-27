/**
 * distribution-platforms — single source of the distributor catalog and of the
 * connection state. Connected platforms come from `localStorage` (same key used
 * by Settings), which is the app's REAL state — nothing is simulated here.
 *
 * Important: the catalog lists what the system *supports*; only the platforms
 * actually connected should appear as selectable in the release flow.
 */

export interface DistributionPlatform {
  id: string;
  name: string;
  description: string;
}

export interface ConnectedDistributionPlatform extends DistributionPlatform {
  /** Connected account identification (when available). */
  username?: string;
}

/** Supported catalog (does not imply availability — see connections). */
export const DISTRIBUTION_PLATFORMS: readonly DistributionPlatform[] = [
  { id: "onerpm", name: "ONErpm", description: "Distribuição global com analytics avançados e suporte a label" },
  { id: "distrokid", name: "DistroKid", description: "Distribuição rápida para todas as plataformas de streaming" },
  { id: "symphonic", name: "Symphonic", description: "Distribuição e marketing para artistas e selos independentes" },
  { id: "soundon", name: "SoundOn", description: "Distribuidora oficial do TikTok com monetização integrada" },
  { id: "musicpro", name: "MusicPro", description: "Distribuição profissional com suporte dedicado e recebimentos externos de direitos mensais" },
  { id: "somvibe", name: "SomVibe", description: "Distribuidora brasileira independente com foco no mercado nacional" },
] as const;

/** Persistence key of the distributor connections (shared with Settings). */
export const DISTRIBUTOR_CONNECTIONS_KEY = "musicos360_distributor_connections";

type ConnectionMap = Record<string, { username?: string } | undefined>;

function readConnections(): ConnectionMap {
  try {
    const raw = localStorage.getItem(DISTRIBUTOR_CONNECTIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ConnectionMap;
    return {};
  } catch {
    return {};
  }
}

/** Returns only the platforms actually connected/enabled. */
export function getEnabledDistributionPlatforms(): ConnectedDistributionPlatform[] {
  const connections = readConnections();
  return DISTRIBUTION_PLATFORMS.filter((p) => Boolean(connections[p.id])).map((p) => ({
    ...p,
    username: connections[p.id]?.username,
  }));
}

/** Finds a catalog platform by id. */
export function findDistributionPlatform(id: string | null | undefined): DistributionPlatform | undefined {
  if (!id) return undefined;
  return DISTRIBUTION_PLATFORMS.find((p) => p.id === id);
}
