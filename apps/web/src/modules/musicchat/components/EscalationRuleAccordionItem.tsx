import { Trash2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import type { MusicChatEscalationRule, MusicChatNotificationChannel } from "../types/musicchat-automation.types";

interface ChannelOption {
  value: MusicChatNotificationChannel;
  label: string;
}

const RECIPIENT_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  manager: "Gestor",
  custom: "Usuário específico",
};

interface Props {
  rule: MusicChatEscalationRule;
  channels: ChannelOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<MusicChatEscalationRule>) => void;
  onToggleChannel: (channel: MusicChatNotificationChannel, checked: boolean) => void;
  onRemove: () => void;
}

export function EscalationRuleAccordionItem({
  rule,
  channels,
  open,
  onOpenChange,
  onChange,
  onToggleChannel,
  onRemove,
}: Props) {
  const enabledChannels = new Set(rule.channels ?? []);
  const destinationLabel = RECIPIENT_LABELS[rule.recipientRole] ?? rule.recipientRole;

  return (
    <AccordionItem open={open} onOpenChange={onOpenChange}>
      <AccordionTrigger>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-foreground">
            {rule.afterMinutes} min
          </span>
          <span className="truncate text-sm font-semibold text-foreground">{rule.level || "Sem nível"}</span>
          <span className="text-xs text-muted-foreground">Destino: {destinationLabel}</span>
          <Badge variant={rule.active ? "secondary" : "outline"} className="px-1.5 py-0 text-[10px]">
            {rule.active ? "Ativa" : "Inativa"}
          </Badge>
          <span className="flex flex-wrap items-center gap-1">
            {channels.map((channel) => (
              <Badge
                key={channel.value}
                variant="outline"
                className={
                  enabledChannels.has(channel.value)
                    ? "px-1.5 py-0 text-[10px] text-foreground"
                    : "px-1.5 py-0 text-[10px] text-muted-foreground/50 line-through"
                }
              >
                {channel.label}
              </Badge>
            ))}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid gap-3 md:grid-cols-[120px_140px_150px_1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Minutos</Label>
            <Input
              type="number"
              min={1}
              value={rule.afterMinutes}
              onChange={(event) => onChange({ afterMinutes: Number(event.target.value) || 1 })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nível</Label>
            <Input value={rule.level} onChange={(event) => onChange({ level: event.target.value })} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Destino</Label>
            <Select value={rule.recipientRole} onValueChange={(value) => onChange({ recipientRole: value })}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="custom">Usuário específico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Usuário específico opcional</Label>
            <Input
              value={rule.recipientUserId ?? ""}
              onChange={(event) => onChange({ recipientUserId: event.target.value || null })}
              className="h-8 text-sm"
              placeholder="ID do usuário"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2">
              <Switch checked={rule.active} onCheckedChange={(checked) => onChange({ active: checked })} />
              <span className="text-xs text-muted-foreground">Ativa</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {channels.map((channel) => (
            <label key={channel.value} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground">
              <Checkbox
                checked={enabledChannels.has(channel.value)}
                onCheckedChange={(checked) => onToggleChannel(channel.value, checked === true)}
              />
              {channel.label}
            </label>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
