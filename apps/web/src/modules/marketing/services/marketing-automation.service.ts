/**
 * Marketing Module — Automation Service
 *
 * Declarative flow blueprints + an executor that materializes each blueprint
 * into real tasks via the marketing service. Running a flow generates one task
 * per step, assigned to the corresponding sector, and records an AutomationRun.
 */

import { marketingService } from "./marketing.service";
import type {
  AutomationFlow,
  AutomationFlowType,
  AutomationRun,
  CreateInput,
  ID,
  MarketingTask,
  Priority,
} from "../types/marketing.types";

/** The five mandatory automation blueprints. */
export const AUTOMATION_FLOWS: AutomationFlow[] = [
  {
    id: "flow-music-release",
    type: "music_release",
    name: "Fluxo de Lançamento Musical",
    description: "Gera todas as tarefas necessárias para um lançamento musical 360.",
    steps: [
      { sector: "design", task: "Criar capa e identidade do lançamento", type: "design" },
      { sector: "audiovisual", task: "Produzir teaser e clipe", type: "audiovisual" },
      { sector: "marketing", task: "Planejar campanha de lançamento", type: "campaign" },
      { sector: "music_administration", task: "Registrar obra e fonograma", type: "planning" },
      { sector: "digital_distribution", task: "Enviar para distribuição e pré-save", type: "publishing" },
      { sector: "communication", task: "Pitching para imprensa e playlists", type: "copywriting" },
      { sector: "marketing", task: "Subir campanhas pagas", type: "paid_traffic" },
      { sector: "communication", task: "Produzir conteúdos de divulgação", type: "artistic_content" },
    ],
  },
  {
    id: "flow-corporate-content",
    type: "corporate_content",
    name: "Fluxo de Conteúdo Corporativo",
    description: "Produção completa de um conteúdo corporativo, do briefing à análise.",
    steps: [
      { sector: "communication", task: "Elaborar briefing do conteúdo", type: "planning" },
      { sector: "communication", task: "Produzir o conteúdo", type: "institutional_content" },
      { sector: "communication", task: "Revisar conteúdo", type: "review" },
      { sector: "design", task: "Criar peças visuais", type: "design" },
      { sector: "marketing", task: "Aprovar materiais", type: "approval" },
      { sector: "marketing", task: "Agendar publicação", type: "publishing" },
      { sector: "marketing", task: "Publicar conteúdo", type: "publishing" },
      { sector: "marketing", task: "Analisar performance", type: "analysis" },
    ],
  },
  {
    id: "flow-behind-the-scenes",
    type: "behind_the_scenes",
    name: "Fluxo de Bastidores",
    description: "Transforma material bruto de bastidores em conteúdo publicável.",
    steps: [
      { sector: "audiovisual", task: "Selecionar material de bastidores", type: "behind_the_scenes_shot" },
      { sector: "audiovisual", task: "Editar conteúdo", type: "audiovisual" },
      { sector: "communication", task: "Escrever copy", type: "copywriting" },
      { sector: "design", task: "Criar peças de apoio", type: "design" },
      { sector: "marketing", task: "Revisar conteúdo", type: "review" },
      { sector: "marketing", task: "Aprovar conteúdo", type: "approval" },
      { sector: "marketing", task: "Publicar bastidores", type: "publishing" },
    ],
  },
  {
    id: "flow-event",
    type: "event",
    name: "Fluxo de Evento",
    description: "Cobertura de evento, da divulgação ao relatório de performance.",
    steps: [
      { sector: "marketing", task: "Planejar divulgação do evento", type: "planning" },
      { sector: "design", task: "Criar identidade visual do evento", type: "design" },
      { sector: "design", task: "Produzir peças promocionais", type: "design" },
      { sector: "marketing", task: "Montar calendário de postagens", type: "publishing" },
      { sector: "audiovisual", task: "Cobertura ao vivo", type: "audiovisual" },
      { sector: "audiovisual", task: "Produzir conteúdo pós-evento", type: "audiovisual" },
      { sector: "marketing", task: "Gerar relatório de performance", type: "analysis" },
    ],
  },
  {
    id: "flow-product-saas",
    type: "product_service_saas",
    name: "Fluxo de Produto, Serviço ou SaaS",
    description: "Go-to-market completo para produto, serviço ou SaaS.",
    steps: [
      { sector: "marketing", task: "Planejar campanha de lançamento", type: "campaign" },
      { sector: "design", task: "Criar landing page", type: "design" },
      { sector: "commercial", task: "Produzir conteúdo comercial", type: "commercial_content" },
      { sector: "design", task: "Criar peças publicitárias", type: "design" },
      { sector: "marketing", task: "Subir campanhas pagas", type: "paid_traffic" },
      { sector: "communication", task: "Configurar e-mail marketing", type: "copywriting" },
      { sector: "crm", task: "Configurar fluxo de CRM", type: "crm" },
      { sector: "marketing", task: "Programar publicações", type: "publishing" },
      { sector: "marketing", task: "Gerar relatório de conversão", type: "analysis" },
    ],
  },
];

export function getFlow(type: AutomationFlowType): AutomationFlow | undefined {
  return AUTOMATION_FLOWS.find((flow) => flow.type === type);
}

export interface RunFlowOptions {
  flowType: AutomationFlowType;
  reference: string;
  triggeredBy: string;
  projectId?: ID;
  priority?: Priority;
  /** Days from today used to space deadlines across the generated tasks. */
  startOffsetDays?: number;
}

function isoDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Executes a flow: creates one task per step and records the run.
 * Returns the run plus the created tasks for immediate UI feedback.
 */
export async function runAutomationFlow(
  options: RunFlowOptions,
): Promise<{ run: AutomationRun; tasks: MarketingTask[] }> {
  const flow = getFlow(options.flowType);
  if (!flow) throw new Error(`[marketing] unknown flow ${options.flowType}`);

  const priority: Priority = options.priority ?? "normal";
  const baseOffset = options.startOffsetDays ?? 3;

  const created: MarketingTask[] = [];
  for (let i = 0; i < flow.steps.length; i += 1) {
    const step = flow.steps[i];
    const input: CreateInput<MarketingTask> = {
      title: `${step.task} — ${options.reference}`,
      description: `Tarefa gerada automaticamente pelo ${flow.name}.`,
      type: step.type,
      status: "pending",
      priority,
      owner: "",
      sector: step.sector,
      deadline: isoDateInDays(baseOffset + i * 2),
      projectId: options.projectId,
      files: [],
      checklist: [],
      comments: [],
      history: [
        {
          id: `h-${flow.id}-${i}`,
          action: `Gerada pelo ${flow.name}`,
          author: options.triggeredBy,
          at: new Date().toISOString(),
        },
      ],
      dependencies: [],
      automationFlowId: flow.id,
    };
    const task = await marketingService.tasks.create(input);
    created.push(task);
  }

  await marketingService.logActivity({
    entity: "task",
    action: `executou o ${flow.name} gerando ${created.length} tarefas para`,
    subject: options.reference,
    author: options.triggeredBy,
  });

  const run: AutomationRun = {
    id: `run-${flow.id}-${Date.now().toString(36)}`,
    flowId: flow.id,
    flowType: flow.type,
    triggeredBy: options.triggeredBy,
    reference: options.reference,
    generatedTaskIds: created.map((t) => t.id),
    at: new Date().toISOString(),
  };

  return { run, tasks: created };
}
