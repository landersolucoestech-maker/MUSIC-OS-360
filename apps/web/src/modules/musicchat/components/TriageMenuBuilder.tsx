import { useState } from "react";
import { Plus } from "lucide-react";
import { Accordion } from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { MenuQueueAccordionItem } from "./MenuQueueAccordionItem";
import type { MusicChatMenuOption, MusicChatPriority, MusicChatTemplate } from "../types/musicchat-automation.types";

interface Props {
  options: MusicChatMenuOption[];
  templates: MusicChatTemplate[];
  onChange: (options: MusicChatMenuOption[]) => void;
}

const PRIORITIES: Array<{ value: MusicChatPriority; label: string }> = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

function tagsToText(tags: string[]) {
  return tags.join(", ");
}

function textToTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function TriageMenuBuilder({ options, templates, onChange }: Props) {
  // Open/closed state is UI-only — the data lives in the page draft.
  // Everything collapsed by default; only the newly created item opens automatically.
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  const setOpen = (id: string, open: boolean) => {
    setOpenIds((current) => ({ ...current, [id]: open }));
  };

  const update = (id: string, patch: Partial<MusicChatMenuOption>) => {
    onChange(options.map((option) => (option.id === id ? { ...option, ...patch } : option)));
  };

  const add = () => {
    const nextOrder = sortedOptions.length > 0 ? Math.max(...sortedOptions.map((option) => option.order)) + 1 : 1;
    const id = `opcao-${Date.now()}`;
    onChange([
      ...options,
      {
        id,
        order: nextOrder,
        label: "Nova opção",
        responseTemplateId: templates[0]?.id ?? "",
        queue: "Atendimento",
        sector: "Triagem",
        defaultAssignee: null,
        tags: [],
        priority: "media",
        active: true,
      },
    ]);
    setOpen(id, true);
  };

  const remove = (id: string) => {
    onChange(options.filter((option) => option.id !== id));
    setOpenIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Menu principal de triagem</h3>
          <p className="text-xs text-muted-foreground">Configure ordem, fila, setor, prioridade e template de cada opção.</p>
        </div>
        <Button type="button" size="sm" className="h-8 text-xs gap-1.5" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar opção
        </Button>
      </div>

      {sortedOptions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma opção configurada. Use &quot;Adicionar opção&quot; para criar a primeira.
        </p>
      ) : (
        <Accordion>
          {sortedOptions.map((option) => (
            <MenuQueueAccordionItem
              key={option.id}
              option={option}
              templates={templates}
              priorities={PRIORITIES}
              open={openIds[option.id] ?? false}
              onOpenChange={(open) => setOpen(option.id, open)}
              onChange={(patch) => update(option.id, patch)}
              onRemove={() => remove(option.id)}
              tagsToText={tagsToText}
              textToTags={textToTags}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}
