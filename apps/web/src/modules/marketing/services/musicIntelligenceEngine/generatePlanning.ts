import type { IntelligenceEntity, PlanningContext } from "./types";

export function generatePlanningDraft(input: {
  artist?: IntelligenceEntity;
  release?: IntelligenceEntity;
  objective: string;
  platform: string;
  period: "7" | "30" | "60" | "90";
}): PlanningContext {
  const period = Number(input.period);
  const base = [
    "Revisar ativos do lançamento",
    "Criar calendário de conteúdos",
    "Produzir cortes Reels/TikTok/Shorts",
    "Preparar pitch e imprensa",
    "Configurar campanha paga",
    "Publicar bastidores",
    "Analisar resultados e ajustar rota",
  ];
  return {
    ...input,
    objective: input.objective || "crescimento e descoberta",
    platform: input.platform || "multicanal",
    items: base.slice(0, input.period === "7" ? 4 : 7).map((title, index) => ({
      id: `plan-${input.period}-${index}`,
      title,
      type: index < 2 ? "planejamento" : "execucao",
      dueInDays: Math.min(period, 2 + index * Math.max(1, Math.floor(period / 7))),
      owner: "Marketing",
      channel: input.platform || "multicanal",
      priority: index < 3 ? "alta" : "media",
    })),
  };
}
