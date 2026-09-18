/**
 * packages/ai-skills/src/postiz/parser.ts
 *
 * Converte a resposta crua do provider em PostizOutput estruturado.
 *
 * ENFORCEMENT ANTI-FABRICAÇÃO (crítico, mesmo princípio de
 * campaign-report/parser.ts): o runner de automação NÃO chama
 * validateOutput — apenas validateInput. Por isso, `readyToRequestPublish`
 * é SEMPRE recalculado aqui a partir dos sinais reais do input
 * (channelReadiness==="connected" && hasCopy), IGNORANDO o que o modelo
 * tenha devolvido nesse campo.
 */

import type {
  PostizInput,
  PostizOutput,
  PostizBlocker,
  PostizRecommendedAction,
} from "./contracts";
import type { SkillPriority } from "../shared/primitives";

const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Avaliação heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapBlockers(value: unknown): PostizBlocker[] {
  return asRecordArray(value)
    .map((v) => ({ blocker: asString(v.blocker), action: asString(v.action) }))
    .filter((v) => v.blocker.length > 0);
}

function mapActions(value: unknown): PostizRecommendedAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

/** Sempre derivado dos sinais reais do input — nunca do JSON do modelo. */
function computeReadyToRequestPublish(input: PostizInput): boolean {
  return input.channelReadiness === "connected" && input.hasCopy;
}

function buildRealBlockers(input: PostizInput): PostizBlocker[] {
  const blockers: PostizBlocker[] = [];
  if (input.channelReadiness !== "connected") {
    const actionByReadiness: Record<string, string> = {
      dependency_not_met: "Configurar credenciais da plataforma no ambiente",
      available_not_connected: `Conectar a conta de ${input.channel} para este tenant`,
      requires_reauth: `Reautorizar a conexão de ${input.channel}`,
      provider_error: `Verificar o erro reportado pela última interação com ${input.channel}`,
      not_implemented: `Publicação em ${input.channel} ainda não foi implementada nesta plataforma`,
    };
    blockers.push({
      blocker: `Canal ${input.channel} não está conectado (estado: ${input.channelReadiness})`,
      action: actionByReadiness[input.channelReadiness] ?? "Verificar conexão do canal",
    });
  }
  if (!input.hasCopy) {
    blockers.push({ blocker: "Post sem legenda/copy definida", action: "Escrever a legenda antes de solicitar publicação" });
  }
  return blockers;
}

function buildFallback(input: PostizInput): PostizOutput {
  const ready = computeReadyToRequestPublish(input);
  return {
    readinessSummary: `${HEURISTIC_NOTE} Post "${input.postTitle}" (${input.channel}).`,
    readyToRequestPublish: ready,
    blockers: buildRealBlockers(input),
    recommendedActions: [],
  };
}

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
    // ignora — resposta não era JSON válido
  }
  return null;
}

export function parsePostizResponse(
  raw: string,
  input: PostizInput,
): PostizOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const blockers = mapBlockers(json.blockers);

  return {
    readinessSummary: asString(json.readinessSummary) || fallback.readinessSummary,
    // ENFORCEMENT: nunca confiado ao modelo — sempre recalculado dos sinais reais.
    readyToRequestPublish: computeReadyToRequestPublish(input),
    blockers: blockers.length > 0 ? blockers : fallback.blockers,
    recommendedActions: mapActions(json.recommendedActions),
  };
}
