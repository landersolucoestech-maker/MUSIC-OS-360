import { Trash2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import type { MusicChatMenuOption, MusicChatPriority, MusicChatTemplate } from "../types/musicchat-automation.types";
import { MusicChatMemberPicker } from "./MusicChatMemberPicker";

interface PriorityOption {
  value: MusicChatPriority;
  label: string;
}

interface Props {
  option: MusicChatMenuOption;
  templates: MusicChatTemplate[];
  priorities: PriorityOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<MusicChatMenuOption>) => void;
  onRemove: () => void;
  tagsToText: (tags: string[]) => string;
  textToTags: (value: string) => string[];
}

export function MenuQueueAccordionItem({
  option,
  templates,
  priorities,
  open,
  onOpenChange,
  onChange,
  onRemove,
  tagsToText,
  textToTags,
}: Props) {
  const priorityLabel = priorities.find((priority) => priority.value === option.priority)?.label ?? option.priority;

  return (
    <AccordionItem open={open} onOpenChange={onOpenChange}>
      <AccordionTrigger>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-foreground">
            {option.order}
          </span>
          <span className="truncate text-sm font-semibold text-foreground">{option.label || "Sem texto"}</span>
          <span className="text-xs text-muted-foreground">
            Fila {option.queue || "—"} · Setor {option.sector || "—"}
          </span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
            {priorityLabel}
          </Badge>
          <Badge
            variant={option.active ? "secondary" : "outline"}
            className="px-1.5 py-0 text-[10px]"
          >
            {option.active ? "Ativa" : "Inativa"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid gap-3 md:grid-cols-[76px_1fr_150px_120px_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              min={1}
              value={option.order}
              onChange={(event) => onChange({ order: Number(event.target.value) || 1 })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto da opção</Label>
            <Input value={option.label} onChange={(event) => onChange({ label: event.target.value })} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fila</Label>
            <Input value={option.queue} onChange={(event) => onChange({ queue: event.target.value })} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Setor</Label>
            <Input value={option.sector} onChange={(event) => onChange({ sector: event.target.value })} className="h-8 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2">
              <Switch checked={option.active} onCheckedChange={(checked) => onChange({ active: checked })} />
              <span className="text-xs text-muted-foreground">Ativa</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={option.responseTemplateId} onValueChange={(value) => onChange({ responseTemplateId: value })}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsável padrão</Label>
            <MusicChatMemberPicker
              value={option.defaultAssignee}
              onChange={(userId) => onChange({ defaultAssignee: userId })}
              label="Responsável padrão"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <Select value={option.priority} onValueChange={(value) => onChange({ priority: value as MusicChatPriority })}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags automáticas</Label>
            <Input
              value={tagsToText(option.tags ?? [])}
              onChange={(event) => onChange({ tags: textToTags(event.target.value) })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
