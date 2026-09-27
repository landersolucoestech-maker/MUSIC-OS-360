/**
 * skills/audiovisual-briefing/parsers/audiovisual-briefing.parser.ts
 *
 * Converts the provider's raw response into a structured AudiovisualBriefingOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. if nothing is usable, return a safe structured fallback with a basic
 *     concept, a minimal checklist and deliverables matching the contentType.
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  AudiovisualBriefingInput,
  AudiovisualBriefingOutput,
  AudiovisualContentType,
  AudiovisualAssetType,
  AudiovisualScriptScene,
  AudiovisualScene,
  AudiovisualAsset,
  AudiovisualChecklistItem,
  AudiovisualTeamNeed,
  AudiovisualDeliverable,
  AudiovisualRisk,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];
const ASSET_TYPES: AudiovisualAssetType[] = ["image", "video", "audio", "document", "prop", "other"];

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter((v) => v.length > 0);
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "sim", "yes", "1"].includes(v)) return true;
    if (["false", "não", "nao", "no", "0"].includes(v)) return false;
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asAssetType(value: unknown): AudiovisualAssetType {
  const v = asString(value).toLowerCase();
  return (ASSET_TYPES as string[]).includes(v) ? (v as AudiovisualAssetType) : "other";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

/** Assigns an optional string only when non-empty (preserves `?` fields). */
function setIfPresent<T extends object>(target: T, key: keyof T, value: string): void {
  if (value) (target as unknown as Record<string, unknown>)[key as string] = value;
}

// ─── Block mappers ────────────────────────────────────────────────────────────

function mapScript(value: unknown): AudiovisualScriptScene[] {
  return asRecordArray(value).map((s, idx) => {
    const scene: AudiovisualScriptScene = {
      scene:       asNumber(s.scene, idx + 1),
      title:       asString(s.title) || `Cena ${idx + 1}`,
      description: asString(s.description),
    };
    setIfPresent(scene, "duration", asString(s.duration));
    setIfPresent(scene, "notes", asString(s.notes));
    return scene;
  });
}

function mapScenes(value: unknown): AudiovisualScene[] {
  return asRecordArray(value).map((s) => {
    const scene: AudiovisualScene = {
      name:           asString(s.name),
      requiredAssets: asStringArray(s.requiredAssets),
    };
    setIfPresent(scene, "location", asString(s.location));
    setIfPresent(scene, "visualStyle", asString(s.visualStyle));
    return scene;
  });
}

function mapAssets(value: unknown): AudiovisualAsset[] {
  return asRecordArray(value).map((a) => ({
    asset:    asString(a.asset),
    type:     asAssetType(a.type),
    required: asBoolean(a.required, true),
  }));
}

function mapChecklist(value: unknown): AudiovisualChecklistItem[] {
  return asRecordArray(value).map((c) => ({
    item:     asString(c.item),
    area:     asString(c.area),
    priority: asPriority(c.priority),
  }));
}

function mapTeamNeeds(value: unknown): AudiovisualTeamNeed[] {
  return asRecordArray(value).map((t) => ({
    role:           asString(t.role),
    responsibility: asString(t.responsibility),
    required:       asBoolean(t.required, true),
  }));
}

function mapDeliverables(value: unknown): AudiovisualDeliverable[] {
  return asRecordArray(value).map((d) => {
    const deliverable: AudiovisualDeliverable = { name: asString(d.name) };
    setIfPresent(deliverable, "format", asString(d.format));
    setIfPresent(deliverable, "platform", asString(d.platform));
    setIfPresent(deliverable, "deadlineSuggestion", asString(d.deadlineSuggestion));
    return deliverable;
  });
}

function mapRisks(value: unknown): AudiovisualRisk[] {
  return asRecordArray(value).map((r) => ({
    risk:       asString(r.risk),
    severity:   asSeverity(r.severity),
    mitigation: asString(r.mitigation),
  }));
}

// ─── Default deliverables per content type (fallback) ─────────────────────────

const DELIVERABLE_BY_TYPE: Record<AudiovisualContentType, AudiovisualDeliverable> = {
  "music-video":   { name: "Videoclipe final",        format: "MP4 1080p 16:9", platform: "YouTube" },
  "lyric-video":   { name: "Lyric video final",       format: "MP4 1080p 16:9", platform: "YouTube" },
  "visualizer":    { name: "Visualizer (loop)",       format: "MP4 1080p 16:9", platform: "YouTube" },
  "teaser":        { name: "Teaser",                   format: "MP4 9:16/1:1",   platform: "Instagram" },
  "reels":         { name: "Reels",                    format: "MP4 1080x1920 9:16", platform: "Instagram Reels" },
  "shorts":        { name: "Short",                    format: "MP4 1080x1920 9:16", platform: "YouTube Shorts" },
  "stories":       { name: "Stories",                  format: "MP4 1080x1920 9:16", platform: "Instagram Stories" },
  "institutional": { name: "Vídeo institucional",      format: "MP4 1080p 16:9", platform: "Site / YouTube" },
  "other":         { name: "Vídeo final",              format: "MP4 1080p",      platform: "A definir" },
};

// ─── Safe structured fallback ─────────────────────────────────────────────────

function buildFallback(input: AudiovisualBriefingInput): AudiovisualBriefingOutput {
  const deliverable = DELIVERABLE_BY_TYPE[input.contentType] ?? DELIVERABLE_BY_TYPE.other;

  return {
    creativeConcept:
      `Conceito base para "${input.projectTitle}" (${input.contentType}) do artista ${input.artistName}: ` +
      `peça audiovisual alinhada ao objetivo "${input.objective}", produzida em nível de orçamento ${input.budgetLevel}. ` +
      `Briefing heurístico local — refine com a direção criativa antes de produzir.`,
    script: [],
    scenes: [],
    assets: [],
    productionChecklist: [
      { item: "Definir conceito e roteiro final", area: "Pré-produção", priority: "high" },
      { item: "Levantar locações e assets necessários", area: "Pré-produção", priority: "medium" },
      { item: "Agendar captação e equipe", area: "Produção", priority: "high" },
      { item: "Pós-produção e aprovação", area: "Pós-produção", priority: "medium" },
    ],
    teamNeeds: [],
    deliverables: [deliverable],
    risks: [],
  };
}

// ─── JSON extraction from the response ────────────────────────────────────────

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;

  const direct = tryParse(candidate);
  if (direct) return direct;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return tryParse(candidate.slice(start, end + 1));
  }

  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore — the response was not valid JSON
  }
  return null;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseAudiovisualBriefingResponse(
  raw: string,
  input: AudiovisualBriefingInput,
): AudiovisualBriefingOutput {
  const json = extractJson(raw);

  const fallback = buildFallback(input);

  if (!json) {
    return fallback;
  }

  return {
    creativeConcept:     asString(json.creativeConcept) || fallback.creativeConcept,
    script:              mapScript(json.script),
    scenes:              mapScenes(json.scenes),
    assets:              mapAssets(json.assets),
    productionChecklist: json.productionChecklist !== undefined ? mapChecklist(json.productionChecklist) : fallback.productionChecklist,
    teamNeeds:           mapTeamNeeds(json.teamNeeds),
    deliverables:        json.deliverables !== undefined ? mapDeliverables(json.deliverables) : fallback.deliverables,
    risks:               mapRisks(json.risks),
  };
}
