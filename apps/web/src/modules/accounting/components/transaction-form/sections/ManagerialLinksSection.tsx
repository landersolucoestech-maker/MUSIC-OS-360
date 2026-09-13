import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type {
  TransactionEntityLink,
  TransactionEntityType,
} from "@/modules/accounting/types/accounting.types";

export type EntityOptions = Record<TransactionEntityType, { value: string; label: string }[]>;

const ENTITY_TYPE_OPTIONS: { value: TransactionEntityType; label: string }[] = [
  { value: "projeto", label: "Projeto" },
  { value: "artista", label: "Artista" },
  { value: "empresa", label: "Empresa" },
  { value: "campanha", label: "Campanha" },
  { value: "evento", label: "Evento" },
];

interface Props {
  links: TransactionEntityLink[];
  onChange: (links: TransactionEntityLink[]) => void;
  disabled?: boolean;
  entityOptions: EntityOptions;
}

/**
 * Vínculos Gerenciais (P&L) — todo lançamento deve ser vinculado a pelo menos
 * uma entidade. Suporta múltiplos vínculos com rateio percentual (soma 100%).
 */
export function ManagerialLinksSection({ links, onChange, disabled, entityOptions }: Props) {
  const update = (index: number, patch: Partial<TransactionEntityLink>) =>
    onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const add = () =>
    onChange([...links, { entityType: "projeto", entityId: "", entityName: "", allocationPercent: undefined }]);

  const remove = (index: number) => onChange(links.filter((_, i) => i !== index));

  const multiple = links.length > 1;
  const sum = links.reduce((acc, l) => acc + (Number(l.allocationPercent) || 0), 0);

  return (
    <Card className="border-border bg-muted/30">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-medium">
          Vínculos Gerenciais (P&L) <span className="text-destructive">*</span>
        </CardTitle>
        {multiple && (
          <span className={Math.round(sum) === 100 ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
            Rateio: {sum}% / 100%
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length === 0 && (
          <p className="text-sm italic text-muted-foreground">
            Vincule este lançamento a pelo menos uma entidade para rastreabilidade no P&L.
          </p>
        )}

        {links.map((link, index) => {
          const options = entityOptions[link.entityType] ?? [];
          const hasOptions = options.length > 0;
          return (
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr_110px_auto] sm:items-center">
              <Select
                value={link.entityType}
                onValueChange={(v) =>
                  update(index, { entityType: v as TransactionEntityType, entityId: "", entityName: "" })
                }
                disabled={disabled}
              >
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasOptions ? (
                <Select
                  value={link.entityId}
                  onValueChange={(v) =>
                    update(index, { entityId: v, entityName: options.find((o) => o.value === v)?.label ?? "" })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a entidade" /></SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={link.entityName}
                  onChange={(e) => update(index, { entityName: e.target.value, entityId: "" })}
                  placeholder="Nome da entidade"
                  disabled={disabled}
                />
              )}

              <Input
                type="number"
                min={0}
                max={100}
                value={link.allocationPercent ?? ""}
                onChange={(e) =>
                  update(index, { allocationPercent: e.target.value === "" ? undefined : Number(e.target.value) })
                }
                placeholder="Rateio %"
                disabled={disabled}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label="Remover vínculo"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}

        {!disabled && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Adicionar vínculo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

