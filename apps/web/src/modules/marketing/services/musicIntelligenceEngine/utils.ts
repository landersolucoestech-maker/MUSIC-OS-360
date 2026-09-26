import type { ReleaseWithRelations } from "@/modules/releases/hooks/useReleases";

export function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join(", ");
  return "";
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function mostCommon(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export function pickReleaseString(release: ReleaseWithRelations, keys: string[]) {
  for (const key of keys) {
    const direct = stringifyValue(release[key]);
    if (direct) return direct;
    const asset = stringifyValue(release.assets?.[key]);
    if (asset) return asset;
    const schedule = stringifyValue(release.cronograma?.[key]);
    if (schedule) return schedule;
  }
  return "";
}

export function estimateReleaseFrequency(dates: string[]) {
  if (dates.length < 2) return dates.length === 1 ? "catalogo inicial" : "sem agenda de lancamentos cadastrada";
  const first = new Date(dates[0]).getTime();
  const last = new Date(dates[dates.length - 1]).getTime();
  const months = Math.max(1, Math.round((last - first) / 1000 / 60 / 60 / 24 / 30));
  const releasesPerYear = (dates.length / months) * 12;
  if (releasesPerYear >= 8) return "alta frequencia";
  if (releasesPerYear >= 4) return "frequencia consistente";
  return "frequencia baixa";
}

export function inferCareerStage(spotify?: number | null, instagram?: number | null, releases = 0) {
  const reach = Math.max(spotify ?? 0, instagram ?? 0);
  if (reach >= 1_000_000) return "Mainstream";
  if (reach >= 100_000 || releases >= 12) return "Consolidado";
  if (reach >= 10_000 || releases >= 4) return "Em crescimento";
  return "Emergente";
}

export function score(value: number, max: number) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}
