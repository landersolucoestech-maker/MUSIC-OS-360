import { Search } from "lucide-react";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

export type AudiovisualProjectFilters = {
  music: string;
  artist: string;
  captureStatus: string;
  editingStatus: string;
  approvalStatus: string;
};

type AudiovisualFilterBarProps = {
  filters: AudiovisualProjectFilters;
  onFiltersChange: (filters: AudiovisualProjectFilters) => void;
};

const ALL_VALUE = "__all__";

const captureStatusOptions = [
  { value: "", label: "Todos" },
  { value: "scheduled", label: "Agendada" },
  { value: "recording", label: "Em Gravação" },
  { value: "recorded", label: "Gravada" },
];

const editingStatusOptions = [
  { value: "", label: "Todos" },
  { value: "not_started", label: "Não Iniciada" },
  { value: "editing", label: "Em Edição" },
  { value: "finished", label: "Finalizada" },
];

const approvalStatusOptions = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "review", label: "Em Revisão" },
  { value: "approved", label: "Aprovado" },
];

function normalizeSelectValue(value: string) {
  return value === ALL_VALUE ? "" : value;
}

export function AudiovisualFilterBar({
  filters,
  onFiltersChange,
}: AudiovisualFilterBarProps) {
  const updateFilter = <K extends keyof AudiovisualProjectFilters>(
    key: K,
    value: AudiovisualProjectFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="mb-4">
      <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.music}
            onChange={(event) => updateFilter("music", event.target.value)}
            placeholder="Buscar por música ou artista..."
            className="h-8 border-border bg-card pl-9 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Select
          value={filters.captureStatus || ALL_VALUE}
          onValueChange={(value) => updateFilter("captureStatus", normalizeSelectValue(value))}
        >
          <SelectTrigger className="h-8 w-auto min-w-[140px] shrink-0 border-border bg-card text-sm text-foreground">
            <SelectValue placeholder="Status de captação" />
          </SelectTrigger>
          <SelectContent>
            {captureStatusOptions.map((option) => (
              <SelectItem key={option.label} value={option.value || ALL_VALUE}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.editingStatus || ALL_VALUE}
          onValueChange={(value) => updateFilter("editingStatus", normalizeSelectValue(value))}
        >
          <SelectTrigger className="h-8 w-auto min-w-[140px] shrink-0 border-border bg-card text-sm text-foreground">
            <SelectValue placeholder="Status de edição" />
          </SelectTrigger>
          <SelectContent>
            {editingStatusOptions.map((option) => (
              <SelectItem key={option.label} value={option.value || ALL_VALUE}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.approvalStatus || ALL_VALUE}
          onValueChange={(value) => updateFilter("approvalStatus", normalizeSelectValue(value))}
        >
          <SelectTrigger className="h-8 w-auto min-w-[140px] shrink-0 border-border bg-card text-sm text-foreground">
            <SelectValue placeholder="Status de aprovação" />
          </SelectTrigger>
          <SelectContent>
            {approvalStatusOptions.map((option) => (
              <SelectItem key={option.label} value={option.value || ALL_VALUE}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}


