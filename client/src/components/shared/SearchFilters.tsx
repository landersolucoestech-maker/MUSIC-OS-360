import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface Filter {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

interface SearchFiltersProps {
  searchPlaceholder?: string;
  filters?: Filter[];
  onSearch?: (value: string) => void;
  onFilterChange?: (filterId: string, value: string) => void;
  onClear?: () => void;
}

export function SearchFilters({
  searchPlaceholder = "Buscar...",
  filters = [],
  onSearch,
  onFilterChange,
  onClear,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-9"
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
      {filters.map((filter) => (
        <Select key={filter.id} onValueChange={(value) => onFilterChange?.(filter.id, value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
