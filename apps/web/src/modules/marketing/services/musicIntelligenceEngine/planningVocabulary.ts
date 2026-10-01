/**
 * Machine vocabulary of the local planning draft. Values are English
 * identifiers; the Portuguese words are display copy only.
 */
export const DEFAULT_PLANNING_PLATFORM = "multichannel";

export type PlanningItemType = "planning" | "execution";
export type PlanningPriority = "high" | "medium";

const PLANNING_LABELS: Record<string, string> = {
  multichannel: "multicanal",
  planning: "planejamento",
  execution: "execução",
  high: "alta",
  medium: "média",
};

/** Display copy (PT-BR); free text typed by the user (e.g. a platform name) is returned unchanged. */
export function planningLabel(value: string): string {
  return PLANNING_LABELS[value] ?? value;
}
