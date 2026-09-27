/**
 * shared/integrations/contracts/music-monitoring.contract.ts
 *
 * Music monitoring contract by audio fingerprint (ACRCloud-style).
 *
 * Covers:
 *   - Track identification by audio fingerprint
 *   - Play reports on radio, TV and digital platforms
 *   - Real-time alerts of unauthorized use
 *   - Search of artists, works and phonograms in the provider database
 *   - Configuration of monitoring projects per artist/work
 *
 * CURRENT STATE:
 *   - ACRCloud: working mock (useACRCloud.ts + mock-music-monitoring.provider.ts)
 *
 * FUTURE MIGRATION:
 *   - ACRCloudProvider implements IMusicMonitoringProvider with the real API
 */

// ─── Source identification ─────────────────────────────────────────────────────

export type MonitoringSourceType =
  | "radio"        // AM/FM radio
  | "tv"           // Broadcast / cable TV
  | "streaming"    // Spotify, Deezer, YouTube Music, Apple Music
  | "video"        // YouTube, TikTok, Instagram Reels
  | "podcast"      // Podcasts and audio shows
  | "venue"        // Concerts, live events
  | "public"       // Commercial venues (store, restaurant)
  | "unknown";

// ─── DTOs de fingerprint ───────────────────────────────────────────────────────

export interface FingerprintInput {
  /** Audio in base64 or a public URL of the clip */
  audio_data: string;
  /** Clip duration in seconds (default: 10s) */
  duration_seconds?: number;
  /** Source of the snippet, for context */
  source_type?: MonitoringSourceType;
  /** Station/platform name (e.g. "Rádio CBN", "Spotify") */
  source_name?: string;
}

export interface FingerprintMatch {
  /** Confidence score 0–100 */
  score: number;
  title: string;
  artista: string;
  isrc?: string | null;
  iswc?: string | null;
  album?: string | null;
  gravadora?: string | null;
  duracao_segundos?: number | null;
  data_lancamento?: string | null;
  genero?: string | null;
  /** ACRCloud internal identifier */
  external_id: string;
  /** Position in the clip where the track was detected (seconds) */
  offset_segundos?: number | null;
  /** Local work/phonogram ID when the match succeeds */
  local_work_id?: string | null;
  local_fonograma_id?: string | null;
}

export interface FingerprintResult {
  matched: boolean;
  matches: FingerprintMatch[];
  best_match?: FingerprintMatch | null;
  processing_time_ms: number;
  fingerprint_id: string;
  detected_at: string;
}

// ─── Play report DTOs ────────────────────────────────────────────────────────

export interface PlayReport {
  id: string;
  title: string;
  artista: string;
  isrc?: string | null;
  iswc?: string | null;
  source_type: MonitoringSourceType;
  source_name: string;
  /** Play country (ISO 3166-1 alpha-2) */
  country?: string | null;
  played_at: string;
  duration_seconds: number;
  /** Estimated audience of the play */
  estimated_audience?: number | null;
  /** Amount reported by an external platform in cents (BRL); no internal calculation */
  external_reported_amount_cents?: number | null;
  /** Local sound recording ID if the cross-match succeeds */
  local_fonograma_id?: string | null;
  local_work_id?: string | null;
  status: "pending" | "confirmed" | "disputed" | "paid";
}

export interface PlayReportQuery {
  isrc?: string;
  iswc?: string;
  artista?: string;
  title?: string;
  source_type?: MonitoringSourceType;
  /** Period start "YYYY-MM-DD" */
  date_from?: string;
  /** Period end "YYYY-MM-DD" */
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface PlayReportSummary {
  total_plays: number;
  total_duration_seconds: number;
  external_reported_amount_cents: number;
  by_source: Record<MonitoringSourceType, number>;
  by_country: Record<string, number>;
  period_from: string;
  period_to: string;
}

// ─── Alert DTOs ───────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertType =
  | "unauthorized_use"       // Unlicensed use detected
  | "high_play_count"        // Unexpected play spike
  | "new_territory"          // Detection in a new country/region
  | "unregistered_track"     // Fingerprint without an ISRC/ISWC registration
  | "external_data_discrepancy"    // Collection below expectations
  | "source_new"             // New play source detected
  | "sync_required";         // Sync required

export interface MonitoringAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  artista?: string | null;
  isrc?: string | null;
  iswc?: string | null;
  source_name?: string | null;
  message: string;
  detected_at: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  local_work_id?: string | null;
  local_fonograma_id?: string | null;
}

// ─── Monitoring project DTOs ──────────────────────────────────────────────────

export interface MonitoringProject {
  id: string;
  name: string;
  artista_nome?: string | null;
  /** ISRCs to monitor */
  isrcs: string[];
  /** ISWCs to monitor */
  iswcs: string[];
  /** Sources to monitor */
  sources: MonitoringSourceType[];
  /** Countries to monitor (ISO 3166-1 alpha-2, empty = all) */
  countries: string[];
  active: boolean;
  created_at: string;
  last_detection_at?: string | null;
  total_detections: number;
}

export interface CreateMonitoringProjectInput {
  name: string;
  artista_nome?: string;
  isrcs?: string[];
  iswcs?: string[];
  sources?: MonitoringSourceType[];
  countries?: string[];
}

// ─── Catalog search DTOs ─────────────────────────────────────────────────────

export interface MusicSearchQuery {
  query: string;
  field?: "title" | "artista" | "isrc" | "iswc" | "all";
  limit?: number;
}

export interface MusicSearchResult {
  external_id: string;
  title: string;
  artista: string;
  isrc?: string | null;
  iswc?: string | null;
  album?: string | null;
  gravadora?: string | null;
  duracao_segundos?: number | null;
  data_lancamento?: string | null;
  genero?: string | null;
  total_plays_30d?: number | null;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * IMusicMonitoringProvider — music monitoring contract by fingerprint.
 *
 * Planned implementations:
 *   - MockMusicMonitoringProvider  (standalone — simulated data)
 *   - ACRCloudProvider             (production — ACRCloud v2 API)
 */
export interface IMusicMonitoringProvider {
  readonly provider_name: string;

  /** Identifies a track by audio fingerprint */
  identify(input: FingerprintInput): Promise<FingerprintResult>;

  /** Lists play reports by filter */
  getPlayReports(query: PlayReportQuery): Promise<PlayReport[]>;

  /** Play summary per period */
  getPlayReportSummary(query: PlayReportQuery): Promise<PlayReportSummary>;

  /** Lists active alerts or history */
  getAlerts(options?: { unacknowledged_only?: boolean; limit?: number }): Promise<MonitoringAlert[]>;

  /** Marks an alert as read */
  acknowledgeAlert(alertId: string): Promise<void>;

  /** Searches tracks/artists in the provider catalog */
  search(query: MusicSearchQuery): Promise<MusicSearchResult[]>;

  /** Creates a monitoring project */
  createProject(input: CreateMonitoringProjectInput): Promise<MonitoringProject>;

  /** Lists monitoring projects */
  listProjects(): Promise<MonitoringProject[]>;

  /** Enables/disables a monitoring project */
  toggleProject(projectId: string, active: boolean): Promise<MonitoringProject>;

  /** Checks the connection to the provider */
  verifyConnection(): Promise<{ ok: boolean; quota_remaining?: number; plan?: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const MONITORING_SOURCE_LABELS: Record<MonitoringSourceType, string> = {
  radio:     "Rádio",
  tv:        "TV",
  streaming: "Streaming",
  video:     "Vídeo",
  podcast:   "Podcast",
  venue:     "Show/Evento",
  public:    "Ambiente Público",
  unknown:   "Desconhecido",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  unauthorized_use:    "Uso Não Autorizado",
  high_play_count:     "Alto Volume de Execuções",
  new_territory:       "Novo Território",
  unregistered_track:  "Faixa Sem Registro",
  external_data_discrepancy: "Discrepância de Recebimentos externos de direitos",
  source_new:          "Nova Fonte Detectada",
  sync_required:       "Sincronização Necessária",
};

/** localStorage key for cached play reports */
export function playReportsStorageKey(isrc: string): string {
  return `musicos360_acrcloud_plays_${isrc}`;
}

/** localStorage key for monitoring projects */
export const MONITORING_PROJECTS_KEY = "musicos360_acrcloud_projects";

/** localStorage key for alerts */
export const MONITORING_ALERTS_KEY = "musicos360_acrcloud_alerts";
