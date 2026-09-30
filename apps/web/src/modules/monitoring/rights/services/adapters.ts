/**
 * Adapters — Rights Monitoring
 * Integration contracts for external services.
 * NOT implemented yet — interfaces and stubs only.
 */

// ─── ACRCloud ────────────────────────────────────────────────────────────────
export interface ACRCloudConfig {
  host: string;
  accessKey: string;
  accessSecret: string;
}

export interface ACRCloudResult {
  isrc?: string;
  title?: string;
  artists?: { name: string }[];
  confidence: number;
  timestamp_utc: string;
}

export const acrCloudAdapter = {
  name: "ACRCloud" as const,
  enabled: false,

  identify(_audioBuffer: ArrayBuffer, _config: ACRCloudConfig): Promise<ACRCloudResult[]> {
    throw new Error("ACRCloud integration not yet enabled. Configure VITE_ACRCLOUD_KEY to activate.");
  },

  toRightsExecution(_result: ACRCloudResult, _origin: string): Record<string, unknown> {
    throw new Error("ACRCloud integration not yet enabled.");
  },
};

// ─── BMAT ────────────────────────────────────────────────────────────────────
export interface BmatConfig {
  apiKey: string;
  territory: string;
}

export interface BmatBroadcastEvent {
  isrc: string;
  title: string;
  artist: string;
  station: string;
  country: string;
  start_time: string;
  duration: number;
}

export const bmatAdapter = {
  name: "BMAT" as const,
  enabled: false,

  fetchBroadcasts(_from: string, _to: string, _config: BmatConfig): Promise<BmatBroadcastEvent[]> {
    throw new Error("BMAT integration not yet enabled. Configure VITE_BMAT_API_KEY to activate.");
  },

  toBroadcastDetection(_event: BmatBroadcastEvent): Record<string, unknown> {
    throw new Error("BMAT integration not yet enabled.");
  },
};

// ─── Soundmouse ──────────────────────────────────────────────────────────────
export interface SoundmouseConfig {
  clientId: string;
  clientSecret: string;
}

export const soundmouseAdapter = {
  name: "Soundmouse" as const,
  enabled: false,

  fetchCueSheets(_productionId: string, _config: SoundmouseConfig): Promise<unknown[]> {
    throw new Error("Soundmouse integration not yet enabled.");
  },
};

// ─── ECAD API (futura) ────────────────────────────────────────────────────────
export interface EcadApiConfig {
  baseUrl: string;
  publisherCode: string;
  token: string;
}

export const ecadApiAdapter = {
  name: "ECAD API" as const,
  enabled: false,

  fetchCollection(_period: string, _config: EcadApiConfig): Promise<unknown[]> {
    throw new Error("ECAD API integration not yet enabled.");
  },

  submitSetlist(_setlistId: string, _config: EcadApiConfig): Promise<{ protocolo: string }> {
    throw new Error("ECAD API integration not yet enabled.");
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────
export const ADAPTERS = [
  acrCloudAdapter,
  bmatAdapter,
  soundmouseAdapter,
  ecadApiAdapter,
] as const;

export type AdapterName = (typeof ADAPTERS)[number]["name"];
