import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Save, Trash2, Zap } from "lucide-react";
import { useSkillRun } from "@/shared/hooks/useSkillRun";
import { SkillRunPanel } from "@/shared/components/SkillRunPanel";
import { MainLayout } from "@/shared/components/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { EscalationRulesEditor } from "../components/EscalationRulesEditor";
import { TriageMenuBuilder } from "../components/TriageMenuBuilder";
import { useMusicChatAutomationSettings } from "../hooks/useMusicChatAutomationSettings";
import { useMusicChatTriageRules } from "../hooks/useMusicChatTriageRules";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import type { MusicChatAutomationSettings } from "../types/musicchat-automation.types";

type EditableSettings = Pick<
  MusicChatAutomationSettings,
  | "enabled"
  | "welcome_message"
  | "main_menu_message"
  | "menu_options"
  | "templates"
  | "required_fields"
  | "optional_fields"
  | "invalid_option_message"
  | "absence_message"
  | "out_of_hours_message"
  | "closing_message"
  | "return_to_menu_rule"
  | "escalation_rules"
  | "notification_channels"
  | "supervisor_user_id"
  | "manager_user_id"
>;

const INITIAL_REQUIRED_FIELDS = [
  "Nome do contratante ou empresa",
  "Nome do responsável",
  "Cidade e Estado",
  "Data do evento",
  "Local do evento",
  "Tipo de evento",
  "Artista desejado",
  "Público estimado",
  "Telefone para contato",
  "E-mail",
];

const FALLBACK_SETTINGS: EditableSettings = {
  enabled: true,
  welcome_message:
    "Olá! Seja bem-vindo(a) à Central de Atendimento da Lander Records. Para direcionarmos seu atendimento, escolha uma das opções abaixo respondendo com o número correspondente.",
  main_menu_message:
    "1. Contratação de Shows\n2. Produção Musical\n3. Editora Musical e Distribuição\n4. Design Gráfico e Criação\n5. Financeiro\n6. Redação & Conteúdo\n7. Outros Assuntos\n8. Contato por Engano",
  menu_options: [
    { id: "shows", order: 1, label: "Contratação de Shows", responseTemplateId: "shows", queue: "Comercial", sector: "Shows", defaultAssignee: null, tags: ["Show", "Comercial"], priority: "alta", active: true, required_fields: INITIAL_REQUIRED_FIELDS, optional_fields: [] },
    { id: "producao", order: 2, label: "Produção Musical", responseTemplateId: "producao", queue: "Produção Musical", sector: "Produção", defaultAssignee: null, tags: ["Produção Musical"], priority: "media", active: true },
    { id: "editora", order: 3, label: "Editora Musical e Distribuição", responseTemplateId: "editora", queue: "Catálogo", sector: "Editora/Distribuição", defaultAssignee: null, tags: ["Editora", "Distribuição"], priority: "media", active: true },
    { id: "design", order: 4, label: "Design Gráfico e Criação", responseTemplateId: "design", queue: "Marketing", sector: "Criação", defaultAssignee: null, tags: ["Design"], priority: "media", active: true },
    { id: "financeiro", order: 5, label: "Financeiro", responseTemplateId: "financeiro", queue: "Financeiro", sector: "Financeiro", defaultAssignee: null, tags: ["Financeiro"], priority: "alta", active: true },
    { id: "conteudo", order: 6, label: "Redação & Conteúdo", responseTemplateId: "conteudo", queue: "Marketing", sector: "Conteúdo", defaultAssignee: null, tags: ["Conteúdo"], priority: "media", active: true },
    { id: "outros", order: 7, label: "Outros Assuntos", responseTemplateId: "outros", queue: "Atendimento", sector: "Suporte", defaultAssignee: null, tags: ["Outros Assuntos"], priority: "media", active: true },
    { id: "engano", order: 8, label: "Contato por Engano", responseTemplateId: "engano", queue: "Atendimento", sector: "Triagem", defaultAssignee: null, tags: ["Contato por Engano"], priority: "baixa", active: true },
  ],
  templates: [
    { id: "shows", title: "Contratação de Shows", body: "Perfeito. Vamos direcionar seu atendimento para contratação de shows. Nossa equipe comercial irá analisar as informações e retornar com os próximos passos." },
    { id: "producao", title: "Produção Musical", body: "Recebemos sua solicitação sobre produção musical. A equipe responsável irá continuar o atendimento por aqui." },
    { id: "editora", title: "Editora Musical e Distribuição", body: "Obrigado pelo contato. Vamos encaminhar sua solicitação para a equipe de editora musical e distribuição." },
    { id: "design", title: "Design Gráfico e Criação", body: "Sua demanda de design e criação foi registrada. O setor criativo dará sequência ao atendimento." },
    { id: "financeiro", title: "Financeiro", body: "Vamos encaminhar seu atendimento para o financeiro. Para agilizar, envie o máximo de detalhes sobre sua solicitação." },
    { id: "conteudo", title: "Redação & Conteúdo", body: "Sua solicitação de redação e conteúdo foi recebida e direcionada para a equipe responsável." },
    { id: "outros", title: "Outros Assuntos", body: "Certo. Vamos analisar seu assunto e direcionar para a fila responsável." },
    { id: "engano", title: "Contato por Engano", body: "Sem problemas. Encerramos esta triagem como contato por engano. Se precisar falar conosco, envie uma nova mensagem." },
  ],
  required_fields: INITIAL_REQUIRED_FIELDS,
  optional_fields: [],
  invalid_option_message: "Não consegui identificar essa opção. Responda apenas com o número de uma das opções do menu principal.",
  absence_message: "No momento não identificamos uma resposta válida. Você pode responder com o número da opção desejada para continuar.",
  out_of_hours_message: "Recebemos sua mensagem fora do horário de atendimento. Sua solicitação foi registrada e será tratada no próximo período útil.",
  closing_message: "Atendimento encerrado. Obrigado por falar com a Lander Records.",
  return_to_menu_rule: { enabled: true, commands: ["0", "menu", "voltar", "inicio"] },
  escalation_rules: [
    { id: "supervisor-5m", afterMinutes: 5, level: "supervisor", recipientRole: "supervisor", recipientUserId: null, channels: ["in_app"], active: true },
    { id: "manager-10m", afterMinutes: 10, level: "manager", recipientRole: "manager", recipientUserId: null, channels: ["in_app"], active: true },
  ],
  notification_channels: { in_app: true, whatsapp: false, sms: false },
  supervisor_user_id: null,
  manager_user_id: null,
};

function toEditable(settings: MusicChatAutomationSettings): EditableSettings {
  return {
    enabled: settings.enabled,
    welcome_message: settings.welcome_message,
    main_menu_message: settings.main_menu_message,
    menu_options: settings.menu_options ?? [],
    templates: settings.templates ?? [],
    required_fields: settings.required_fields?.length ? settings.required_fields : INITIAL_REQUIRED_FIELDS,
    optional_fields: settings.optional_fields ?? [],
    invalid_option_message: settings.invalid_option_message,
    absence_message: settings.absence_message,
    out_of_hours_message: settings.out_of_hours_message,
    closing_message: settings.closing_message,
    return_to_menu_rule: settings.return_to_menu_rule ?? { enabled: true, commands: [] },
    escalation_rules: settings.escalation_rules ?? [],
    notification_channels: settings.notification_channels ?? {},
    supervisor_user_id: settings.supervisor_user_id ?? null,
    manager_user_id: settings.manager_user_id ?? null,
  };
}

function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueCommands(commands: string[]) {
  return Array.from(new Set(commands.map((command) => command.trim()).filter(Boolean)));
}

function splitReturnCommands(commands: string[] = []) {
  const normalized = uniqueCommands(commands);
  const quickCommand = normalized.find((command) => /^\d+$/.test(command)) ?? "";
  const textCommands = normalized.filter((command) => command !== quickCommand);

  return { quickCommand, textCommands };
}

interface FieldListEditorProps {
  title: string;
  description: string;
  fields: string[];
  emptyText: string;
  onChange: (fields: string[]) => void;
}

function FieldListEditor({ title, description, fields, emptyText, onChange }: FieldListEditorProps) {
  const [newField, setNewField] = useState("");

  const update = (index: number, value: string) => {
    onChange(fields.map((field, fieldIndex) => (fieldIndex === index ? value : field)));
  };

  const remove = (index: number) => {
    onChange(fields.filter((_, fieldIndex) => fieldIndex !== index));
  };

  const add = () => {
    const value = newField.trim();
    if (!value) return;
    onChange([...fields, value]);
    setNewField("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={`${field}-${index}`} className="flex items-center gap-2">
                <Input value={field} onChange={(event) => update(index, event.target.value)} className="h-8 text-sm" />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newField}
            onChange={(event) => setNewField(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            className="h-8 text-sm"
            placeholder="Ex.: Nome do contratante ou empresa"
          />
          <Button type="button" size="sm" className="h-8 text-xs gap-1.5" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MusicChatAutomationSettings() {
  const { settings, isLoading, isError, updateSettings } = useMusicChatAutomationSettings();
  const { runEscalations } = useMusicChatTriageRules();
  const automationAudit = useSkillRun<Record<string, unknown>>("/conversations/musicchat/automation/audit");
  const automationBuilder = useSkillRun<Record<string, unknown>>("/conversations/musicchat/automation/builder-suggestions");
  const [draft, setDraft] = useState<EditableSettings>(FALLBACK_SETTINGS);
  const [openServiceQuestionnaires, setOpenServiceQuestionnaires] = useState<Record<string, boolean>>({
    [FALLBACK_SETTINGS.menu_options[0]?.id ?? "shows"]: true,
  });

  useEffect(() => {
    if (settings) setDraft(toEditable(settings));
  }, [settings]);

  const previewMenu = useMemo(() => {
    return [...draft.menu_options]
      .filter((option) => option.active !== false)
      .sort((a, b) => a.order - b.order)
      .map((option) => `${option.order}. ${option.label}`)
      .join("\n");
  }, [draft.menu_options]);

  const patch = (updates: Partial<EditableSettings>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const patchServiceFields = (optionId: string, patchFields: { required_fields?: string[]; optional_fields?: string[] }) => {
    patch({
      menu_options: draft.menu_options.map((option) => (
        option.id === optionId ? { ...option, ...patchFields } : option
      )),
    });
  };

  const getTemplateForOption = (option: EditableSettings["menu_options"][number]) => {
    return draft.templates.find((template) => template.id === option.responseTemplateId) ?? {
      id: option.responseTemplateId,
      title: option.label,
      body: "",
    };
  };

  const patchTemplateForOption = (option: EditableSettings["menu_options"][number], templatePatch: { title?: string; body?: string }) => {
    const template = getTemplateForOption(option);
    const nextTemplate = { ...template, ...templatePatch };
    const templateExists = draft.templates.some((item) => item.id === template.id);

    patch({
      templates: templateExists
        ? draft.templates.map((item) => (item.id === template.id ? nextTemplate : item))
        : [...draft.templates, nextTemplate],
    });
  };

  const addServiceQuestionnaire = () => {
    const id = `questionario-${Date.now()}`;
    const order = Math.max(0, ...draft.menu_options.map((option) => option.order)) + 1;
    const newOption = {
      id,
      order,
      label: "Novo questionário",
      responseTemplateId: id,
      queue: "Atendimento",
      sector: "Triagem",
      defaultAssignee: null,
      tags: [],
      priority: "media" as const,
      active: true,
      required_fields: [],
      optional_fields: [],
    };

    patch({
      menu_options: [...draft.menu_options, newOption],
      templates: [...draft.templates, { id, title: newOption.label, body: "" }],
      main_menu_message: "",
    });
    setOpenServiceQuestionnaires((current) => ({ ...current, [id]: true }));
  };

  const removeServiceQuestionnaire = (optionId: string) => {
    const option = draft.menu_options.find((item) => item.id === optionId);
    if (!option) return;

    patch({
      menu_options: draft.menu_options.filter((item) => item.id !== optionId),
      templates: draft.templates.filter((template) => template.id !== option.responseTemplateId),
      main_menu_message: "",
    });
    setOpenServiceQuestionnaires((current) => {
      const next = { ...current };
      delete next[optionId];
      return next;
    });
  };

  const { quickCommand: returnQuickCommand, textCommands: returnTextCommands } = splitReturnCommands(draft.return_to_menu_rule.commands);

  const updateReturnCommands = (quickCommand: string, textCommands: string[]) => {
    patch({
      return_to_menu_rule: {
        ...draft.return_to_menu_rule,
        commands: uniqueCommands([quickCommand, ...textCommands]),
      },
    });
  };

  const save = () => {
    updateSettings.mutate({
      ...draft,
      required_fields: draft.required_fields.map((field) => field.trim()).filter(Boolean),
      optional_fields: draft.optional_fields.map((field) => field.trim()).filter(Boolean),
      return_to_menu_rule: {
        ...draft.return_to_menu_rule,
        commands: uniqueCommands(draft.return_to_menu_rule.commands ?? []),
      },
      main_menu_message: draft.main_menu_message || previewMenu,
      expectedUpdatedAt: getExpectedUpdatedAt(settings),
    });
  };

  return (
    <MainLayout
      title="Automações do MusicChat"
      description="Configure mensagens automáticas, triagem, campos coletados, filas, templates, notificações e escalonamentos."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={runEscalations.isPending}
            onClick={() => runEscalations.mutate(undefined)}
          >
            <Zap className="h-3.5 w-3.5" />
            Testar escalonamento
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={updateSettings.isPending}
            onClick={save}
          >
            <Save className="h-3.5 w-3.5" />
            Salvar configuração
          </Button>
        </div>
      }
    >
      {isLoading && !draft ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Carregando configurações...</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {isError && (
            <Alert>
              <AlertTitle>Modo frontend liberado</AlertTitle>
              <AlertDescription>
                A API não respondeu agora, então carreguei os padrões editáveis para você continuar ajustando o frontend.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="mensagens" className="space-y-4">
            <TabsList>
              <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
              <TabsTrigger value="menu">Menu e filas</TabsTrigger>
              <TabsTrigger value="escalonamento">Escalonamento</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="ia-diagnostico">Diagnóstico IA</TabsTrigger>
            </TabsList>

            <TabsContent value="mensagens" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base">Fluxo inicial</CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch checked={draft.enabled} onCheckedChange={(checked) => patch({ enabled: checked })} />
                      <span className="text-xs text-muted-foreground">Automação ativa</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Mensagem inicial de boas-vindas</Label>
                    <Textarea value={draft.welcome_message} onChange={(event) => patch({ welcome_message: event.target.value })} rows={4} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Menu principal de triagem</Label>
                    <Textarea
                      value={draft.main_menu_message || previewMenu}
                      onChange={(event) => patch({ main_menu_message: event.target.value })}
                      rows={8}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Mensagens de exceção e encerramento</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Opção inválida</Label>
                    <Textarea value={draft.invalid_option_message} onChange={(event) => patch({ invalid_option_message: event.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ausência de resposta</Label>
                    <Textarea value={draft.absence_message} onChange={(event) => patch({ absence_message: event.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fora do horário de atendimento</Label>
                    <Textarea value={draft.out_of_hours_message} onChange={(event) => patch({ out_of_hours_message: event.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Encerramento</Label>
                    <Textarea value={draft.closing_message} onChange={(event) => patch({ closing_message: event.target.value })} rows={3} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="menu" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <TriageMenuBuilder
                    options={draft.menu_options}
                    templates={draft.templates}
                    onChange={(menu_options) => patch({ menu_options, main_menu_message: "" })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Retorno ao menu principal</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[140px_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>Número</Label>
                    <Input
                      value={returnQuickCommand}
                      onChange={(event) => updateReturnCommands(event.target.value, returnTextCommands)}
                      className="h-8 text-sm"
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comandos textuais aceitos</Label>
                    <Input
                      value={returnTextCommands.join(", ")}
                      onChange={(event) => updateReturnCommands(returnQuickCommand, parseList(event.target.value))}
                      className="h-8 text-sm"
                      placeholder="menu, voltar, inicio"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex h-8 items-center gap-2 rounded-md border border-border px-3">
                      <Switch
                        checked={draft.return_to_menu_rule.enabled !== false}
                        onCheckedChange={(checked) => patch({ return_to_menu_rule: { ...draft.return_to_menu_rule, enabled: checked } })}
                      />
                      <span className="text-xs text-muted-foreground">Ativo</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="escalonamento" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Responsáveis padrão</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Supervisor padrão</Label>
                    <Input
                      value={draft.supervisor_user_id ?? ""}
                      onChange={(event) => patch({ supervisor_user_id: event.target.value || null })}
                      placeholder="ID do usuário supervisor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gestor padrão</Label>
                    <Input
                      value={draft.manager_user_id ?? ""}
                      onChange={(event) => patch({ manager_user_id: event.target.value || null })}
                      placeholder="ID do usuário gestor"
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <EscalationRulesEditor rules={draft.escalation_rules} onChange={(escalation_rules) => patch({ escalation_rules })} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Questionários por serviço</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Abra um serviço do menu e configure quais perguntas serão coletadas inicialmente para ele.
                      </p>
                    </div>
                    <Button type="button" size="sm" className="h-8 text-xs gap-1.5" onClick={addServiceQuestionnaire}>
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar questionário
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...draft.menu_options].sort((a, b) => a.order - b.order).map((option) => {
                    const isOpen = openServiceQuestionnaires[option.id] ?? false;
                    const requiredFields = option.required_fields?.length ? option.required_fields : draft.required_fields;
                    const configuredCount = requiredFields.length;
                    const template = getTemplateForOption(option);

                    return (
                      <Collapsible
                        key={option.id}
                        open={isOpen}
                        onOpenChange={(open) => setOpenServiceQuestionnaires((current) => ({ ...current, [option.id]: open }))}
                      >
                        <div className="rounded-lg border border-border bg-card">
                          <CollapsibleTrigger asChild>
                            <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{option.order}. {option.label}</span>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                    {configuredCount} campo(s)
                                  </span>
                                  {!option.active && (
                                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Inativa</span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Fila {option.queue} / Setor {option.sector}
                                </p>
                              </div>
                              <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-4 border-t border-border p-4">
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                                  onClick={() => removeServiceQuestionnaire(option.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir questionário
                                </Button>
                              </div>
                              <FieldListEditor
                                title="Campos obrigatórios"
                                description="Perguntas que precisam ser respondidas para este tipo de serviço."
                                fields={requiredFields}
                                emptyText="Nenhum campo obrigatório configurado para este serviço."
                                onChange={(required_fields) => patchServiceFields(option.id, { required_fields })}
                              />
                              <div className="rounded-lg border border-border bg-card p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <Label className="text-xs">Mensagem Automática</Label>
                                  </div>
                                  <Textarea
                                    value={template.body}
                                    onChange={(event) => patchTemplateForOption(option, { body: event.target.value })}
                                    rows={4}
                                  />
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ia-diagnostico" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Auditoria da automação (IA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillRunPanel
                    label="Auditar automação"
                    result={automationAudit.result}
                    isRunning={automationAudit.isRunning}
                    error={automationAudit.error}
                    onRun={() => automationAudit.run(undefined)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Sugestões de melhoria (IA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillRunPanel
                    label="Gerar sugestões"
                    result={automationBuilder.result}
                    isRunning={automationBuilder.isRunning}
                    error={automationBuilder.error}
                    onRun={() => automationBuilder.run(undefined)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </MainLayout>
  );
}
