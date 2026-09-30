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
    id: "flow-lancamento",
    type: "lancamento_musical",
    name: "Fluxo de Lançamento Musical",
    description: "Gera todas as tarefas necessárias para um lançamento musical 360.",
    steps: [
      { sector: "Design", task: "Criar capa e identidade do lançamento", type: "design" },
      { sector: "Audiovisual", task: "Produzir teaser e clipe", type: "audiovisual" },
      { sector: "Marketing", task: "Planejar campanha de lançamento", type: "campanha" },
      { sector: "Administração Musical", task: "Registrar obra e fonograma", type: "planejamento" },
      { sector: "Distribuição Digital", task: "Enviar para distribuição e pré-save", type: "publicacao" },
      { sector: "Comunicação", task: "Pitching para imprensa e playlists", type: "copywriting" },
      { sector: "Marketing", task: "Subir campanhas pagas", type: "trafego_pago" },
      { sector: "Comunicação", task: "Produzir conteúdos de divulgação", type: "conteudo_artistico" },
    ],
  },
  {
    id: "flow-conteudo-corporativo",
    type: "conteudo_corporativo",
    name: "Fluxo de Conteúdo Corporativo",
    description: "Produção completa de um conteúdo corporativo, do briefing à análise.",
    steps: [
      { sector: "Comunicação", task: "Elaborar briefing do conteúdo", type: "planejamento" },
      { sector: "Comunicação", task: "Produzir o conteúdo", type: "conteudo_institucional" },
      { sector: "Comunicação", task: "Revisar conteúdo", type: "revisao" },
      { sector: "Design", task: "Criar peças visuais", type: "design" },
      { sector: "Marketing", task: "Aprovar materiais", type: "aprovacao" },
      { sector: "Marketing", task: "Agendar publicação", type: "publicacao" },
      { sector: "Marketing", task: "Publicar conteúdo", type: "publicacao" },
      { sector: "Marketing", task: "Analisar performance", type: "analise" },
    ],
  },
  {
    id: "flow-bastidores",
    type: "bastidores",
    name: "Fluxo de Bastidores",
    description: "Transforma material bruto de bastidores em conteúdo publicável.",
    steps: [
      { sector: "Audiovisual", task: "Selecionar material de bastidores", type: "bastidor" },
      { sector: "Audiovisual", task: "Editar conteúdo", type: "audiovisual" },
      { sector: "Comunicação", task: "Escrever copy", type: "copywriting" },
      { sector: "Design", task: "Criar peças de apoio", type: "design" },
      { sector: "Marketing", task: "Revisar conteúdo", type: "revisao" },
      { sector: "Marketing", task: "Aprovar conteúdo", type: "aprovacao" },
      { sector: "Marketing", task: "Publicar bastidores", type: "publicacao" },
    ],
  },
  {
    id: "flow-evento",
    type: "evento",
    name: "Fluxo de Evento",
    description: "Cobertura de evento, da divulgação ao relatório de performance.",
    steps: [
      { sector: "Marketing", task: "Planejar divulgação do evento", type: "planejamento" },
      { sector: "Design", task: "Criar identidade visual do evento", type: "design" },
      { sector: "Design", task: "Produzir peças promocionais", type: "design" },
      { sector: "Marketing", task: "Montar calendário de postagens", type: "publicacao" },
      { sector: "Audiovisual", task: "Cobertura ao vivo", type: "audiovisual" },
      { sector: "Audiovisual", task: "Produzir conteúdo pós-evento", type: "audiovisual" },
      { sector: "Marketing", task: "Gerar relatório de performance", type: "analise" },
    ],
  },
  {
    id: "flow-produto-saas",
    type: "produto_servico_saas",
    name: "Fluxo de Produto, Serviço ou SaaS",
    description: "Go-to-market completo para produto, serviço ou SaaS.",
    steps: [
      { sector: "Marketing", task: "Planejar campanha de lançamento", type: "campanha" },
      { sector: "Design", task: "Criar landing page", type: "design" },
      { sector: "Comercial", task: "Produzir conteúdo comercial", type: "conteudo_comercial" },
      { sector: "Design", task: "Criar peças publicitárias", type: "design" },
      { sector: "Marketing", task: "Subir campanhas pagas", type: "trafego_pago" },
      { sector: "Comunicação", task: "Configurar e-mail marketing", type: "copywriting" },
      { sector: "CRM", task: "Configurar fluxo de CRM", type: "crm" },
      { sector: "Marketing", task: "Programar publicações", type: "publicacao" },
      { sector: "Marketing", task: "Gerar relatório de conversão", type: "analise" },
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
