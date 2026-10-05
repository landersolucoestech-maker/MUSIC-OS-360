/** Machine codes (English) of the artist 360 activity timeline; PT-BR only in the label. */
export type ActivityType = "legal" | "financial" | "schedule" | "production" | "marketing";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  legal: "Jurídico",
  financial: "Financeiro",
  schedule: "Agenda",
  production: "Produção",
  marketing: "Marketing",
};
