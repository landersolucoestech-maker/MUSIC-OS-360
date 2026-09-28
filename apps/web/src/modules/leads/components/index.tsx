import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import { leadServiceTypeOptions } from "../constants";
import { LEAD_SOURCE_OPTIONS, TEMPERATURE_OPTIONS } from "../constants/lead-form-options";
import type { Lead } from "../types";

export function LeadFilters({
  filters,
  onChange,
  responsiblePeople,
}: {
  filters: Record<string, string>;
  onChange: (field: string, value: string) => void;
  responsiblePeople: string[];
}) {
  const { getOptionsByKind } = useOperationalSettings();
  const leadStatusOptions = getOptionsByKind("lead_status");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
      <Input
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        placeholder="Buscar por nome, e-mail, WhatsApp, Instagram ou empresa"
        className="h-8 min-w-[240px] flex-1 bg-card border-border text-sm"
      />
      <FilterSelect
        value={filters.serviceType}
        onValueChange={(value) => onChange("serviceType", value)}
        options={[{ value: "all", label: "Todos os serviços" }, ...leadServiceTypeOptions]}
      />
      <FilterSelect
        value={filters.status}
        onValueChange={(value) => onChange("status", value)}
        options={[{ value: "all", label: "Todos os status" }, ...leadStatusOptions]}
      />
      <FilterSelect
        value={filters.responsiblePerson}
        onValueChange={(value) => onChange("responsiblePerson", value)}
        options={[{ value: "all", label: "Responsáveis" }, ...responsiblePeople.map((value) => ({ value, label: value }))]}
      />
      <FilterSelect
        value={filters.leadSource}
        onValueChange={(value) => onChange("leadSource", value)}
        options={[{ value: "all", label: "Origens" }, ...LEAD_SOURCE_OPTIONS]}
      />
      <FilterSelect
        value={filters.temperature}
        onValueChange={(value) => onChange("temperature", value)}
        options={[{ value: "all", label: "Temperatura" }, ...TEMPERATURE_OPTIONS]}
      />
    </div>
  );
}

function FilterSelect({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[132px] shrink-0 bg-card border-border text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function LeadRowSummary({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{lead.fullName}</p>
      <p className="truncate text-xs text-muted-foreground">{lead.email || lead.whatsapp || lead.instagram || "Sem contato"}</p>
    </div>
  );
}
