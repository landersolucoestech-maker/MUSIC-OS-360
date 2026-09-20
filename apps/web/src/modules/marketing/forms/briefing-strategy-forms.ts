import type { FieldDef, FormValues } from "../components/MarketingFormModal";
import {
  BRIEFING_STATUS_OPTIONS,
  BRIEFING_TYPE_OPTIONS,
  CONTENT_CHANNEL_OPTIONS,
} from "../constants/marketing.constants";
import type {
  BriefingStatus,
  BriefingType,
  ContentChannel,
  CreateInput,
  MarketingBriefing,
} from "../types/marketing.types";


export const strategicBriefingCreateFields: FieldDef[] = [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "type", label: "Tipo", type: "select", required: true, options: BRIEFING_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: BRIEFING_STATUS_OPTIONS },
  { name: "deadline", label: "Prazo", type: "date", required: true },
  { name: "owners", label: "Responsáveis", type: "tags" },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
  { name: "context", label: "Contexto / necessidade", type: "textarea", colSpan: 2 },
];

export const strategicBriefingEditFields: FieldDef[] = [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "type", label: "Tipo", type: "select", required: true, options: BRIEFING_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: BRIEFING_STATUS_OPTIONS },
  { name: "deadline", label: "Prazo", type: "date", required: true },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
  { name: "context", label: "Contexto e necessidades", type: "textarea", colSpan: 2 },
  { name: "audience", label: "Público-alvo / personas", type: "textarea", colSpan: 2 },
  { name: "positioning", label: "Posicionamento", type: "text", colSpan: 2 },
  { name: "tone", label: "Tom de comunicação", type: "text", colSpan: 2 },
  { name: "requirements", label: "Requisitos", type: "textarea", colSpan: 2 },
  { name: "creativeDirection", label: "Direcionamento criativo", type: "textarea", colSpan: 2 },
  { name: "references", label: "Referências", type: "textarea", colSpan: 2 },
  { name: "visualGuidelines", label: "Diretrizes visuais", type: "textarea", colSpan: 2 },
  { name: "textGuidelines", label: "Diretrizes textuais", type: "textarea", colSpan: 2 },
  { name: "market", label: "Mercado / oportunidades", type: "textarea", colSpan: 2 },
  { name: "competitors", label: "Concorrentes", type: "textarea", colSpan: 2 },
  { name: "trends", label: "Tendências", type: "textarea", colSpan: 2 },
  { name: "channels", label: "Canais", type: "multiselect", options: CONTENT_CHANNEL_OPTIONS, colSpan: 2 },
  { name: "restrictions", label: "Restrições", type: "textarea", colSpan: 2 },
  { name: "resources", label: "Recursos disponíveis", type: "textarea", colSpan: 2 },
  { name: "expectations", label: "Expectativas", type: "textarea", colSpan: 2 },
  { name: "deliverables", label: "Entregáveis", type: "tags", colSpan: 2 },
  { name: "timeline", label: "Cronograma sugerido", type: "textarea", colSpan: 2 },
  { name: "executionPlan", label: "Plano de ação operacional", type: "textarea", colSpan: 2 },
  { name: "aiRecommendations", label: "Recomendações da IA", type: "textarea", colSpan: 2 },
  { name: "owners", label: "Responsáveis", type: "tags", colSpan: 2 },
];

export function strategicBriefingInitialValues(briefing?: MarketingBriefing): FormValues {
  return {
    title: briefing?.title ?? "",
    type: briefing?.type ?? "campanha",
    status: briefing?.status ?? "draft",
    deadline: briefing?.deadline ?? "",
    objective: briefing?.objective ?? "",
    context: briefing?.context ?? "",
    audience: briefing?.audience ?? "",
    positioning: briefing?.positioning ?? "",
    tone: briefing?.tone ?? "",
    requirements: briefing?.requirements ?? "",
    creativeDirection: briefing?.creativeDirection ?? "",
    references: briefing?.references ?? "",
    visualGuidelines: briefing?.visualGuidelines ?? "",
    textGuidelines: briefing?.textGuidelines ?? "",
    market: briefing?.market ?? "",
    competitors: briefing?.competitors ?? "",
    trends: briefing?.trends ?? "",
    channels: briefing?.channels ?? [],
    restrictions: briefing?.restrictions ?? "",
    resources: briefing?.resources ?? "",
    expectations: briefing?.expectations ?? "",
    deliverables: briefing?.deliverables ?? [],
    timeline: briefing?.timeline ?? "",
    executionPlan: briefing?.executionPlan ?? "",
    aiRecommendations: briefing?.aiRecommendations ?? "",
    owners: briefing?.owners ?? [],
  };
}

export function strategicBriefingToInput(values: FormValues): CreateInput<MarketingBriefing> {
  return {
    title: str(values, "title"),
    type: str(values, "type") as BriefingType,
    status: str(values, "status") as BriefingStatus,
    deadline: str(values, "deadline"),
    objective: str(values, "objective"),
    context: str(values, "context"),
    audience: str(values, "audience"),
    positioning: str(values, "positioning"),
    tone: str(values, "tone"),
    requirements: str(values, "requirements"),
    creativeDirection: str(values, "creativeDirection"),
    references: str(values, "references"),
    visualGuidelines: str(values, "visualGuidelines"),
    textGuidelines: str(values, "textGuidelines"),
    market: str(values, "market"),
    competitors: str(values, "competitors"),
    trends: str(values, "trends"),
    channels: arr(values, "channels") as ContentChannel[],
    restrictions: str(values, "restrictions"),
    resources: str(values, "resources"),
    expectations: str(values, "expectations"),
    deliverables: arr(values, "deliverables"),
    timeline: str(values, "timeline"),
    executionPlan: str(values, "executionPlan"),
    aiRecommendations: str(values, "aiRecommendations"),
    owners: arr(values, "owners"),
    files: [],
  };
}

function str(values: FormValues, key: string) {
  const value = values[key];
  return typeof value === "string" ? value : "";
}

function arr(values: FormValues, key: string) {
  const value = values[key];
  return Array.isArray(value) ? value.map(String) : [];
}
