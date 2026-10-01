import { useState } from "react";
import { Plus } from "lucide-react";
import { Accordion } from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { EscalationRuleAccordionItem } from "./EscalationRuleAccordionItem";
import type { MusicChatEscalationRule, MusicChatNotificationChannel } from "../types/musicchat-automation.types";

interface Props {
  rules: MusicChatEscalationRule[];
  onChange: (rules: MusicChatEscalationRule[]) => void;
}

const CHANNELS: Array<{ value: MusicChatNotificationChannel; label: string }> = [
  { value: "in_app", label: "Sistema" },
  { value: "whatsapp", label: "WhatsApp preparado" },
  { value: "sms", label: "SMS preparado" },
];

export function EscalationRulesEditor({ rules, onChange }: Props) {
  // Open/closed state is UI-only — the data lives in the page draft.
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const sortedRules = [...rules].sort((a, b) => a.afterMinutes - b.afterMinutes);

  const setOpen = (id: string, open: boolean) => {
    setOpenIds((current) => ({ ...current, [id]: open }));
  };

  const update = (id: string, patch: Partial<MusicChatEscalationRule>) => {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const toggleChannel = (rule: MusicChatEscalationRule, channel: MusicChatNotificationChannel, checked: boolean) => {
    const current = new Set(rule.channels ?? []);
    if (checked) current.add(channel);
    else current.delete(channel);
    update(rule.id, { channels: Array.from(current) });
  };

  const add = () => {
    const id = `escalation-${Date.now()}`;
    onChange([
      ...rules,
      {
        id,
        afterMinutes: 15,
        level: "supervisor",
        recipientRole: "supervisor",
        recipientUserId: null,
        channels: ["in_app"],
        active: true,
      },
    ]);
    setOpen(id, true);
  };

  const remove = (id: string) => {
    onChange(rules.filter((rule) => rule.id !== id));
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
          <h3 className="text-sm font-semibold text-foreground">Regras de escalonamento</h3>
          <p className="text-xs text-muted-foreground">
            Defina o tempo-limite e o destino de cada nível. Estas regras são avaliadas quando o
            escalonamento é executado manualmente (botão "Testar escalonamento" ou rotina de
            atendimento) — não há disparo automático por temporizador nesta versão.
          </p>
        </div>
        <Button type="button" size="sm" className="h-8 text-xs gap-1.5" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar regra
        </Button>
      </div>

      {sortedRules.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma regra configurada. Use &quot;Adicionar regra&quot; para criar a primeira.
        </p>
      ) : (
        <Accordion>
          {sortedRules.map((rule) => (
            <EscalationRuleAccordionItem
              key={rule.id}
              rule={rule}
              channels={CHANNELS}
              open={openIds[rule.id] ?? false}
              onOpenChange={(open) => setOpen(rule.id, open)}
              onChange={(patch) => update(rule.id, patch)}
              onToggleChannel={(channel, checked) => toggleChannel(rule, channel, checked)}
              onRemove={() => remove(rule.id)}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}
