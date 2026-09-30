import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/shared/ui/command";
import { cn } from "@/shared/lib/utils";
import { BR_STATES } from "./br-locations";
import { useIbgeMunicipalities, geocodeLocation } from "./useIbgeLocations";

interface Props {
  value: string;
  onChange: (value: string, geo?: { lat: number; lng: number }) => void;
}

export function LocationCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");

  const { options: cityOptions, loading: loadingCities } = useIbgeMunicipalities(selectedStateCode);

  const selected = useMemo(
    () => value.split(",").map((s) => s.trim()).filter(Boolean),
    [value],
  );

  const setSelected = (next: string[]) => onChange(next.join(", "));

  const toggle = async (label: string) => {
    const next = selected.includes(label)
      ? selected.filter((s) => s !== label)
      : [...selected, label];
    onChange(next.join(", "));

    if (!selected.includes(label)) {
      const geo = await geocodeLocation(label.replace(/^[A-Z]{2} - /, ""));
      if (geo) onChange(next.join(", "), geo);
    }
  };

  const filteredStates = useMemo(
    () =>
      BR_STATES.filter(
        (s) =>
          s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
          s.stateCode.toLowerCase().includes(stateSearch.toLowerCase()),
      ),
    [stateSearch],
  );

  const filteredCities = useMemo(
    () =>
      cityOptions.filter((c) =>
        c.city.toLowerCase().includes(citySearch.toLowerCase()),
      ),
    [cityOptions, citySearch],
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-start text-xs font-normal text-muted-foreground"
          >
            <MapPin className="mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              {selected.length > 0
                ? `${selected.length} local(is) selecionado(s)`
                : "Buscar estado ou cidade..."}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[340px] p-0" align="start">
          {selectedStateCode === null ? (
            <Command>
              <CommandInput
                placeholder="Buscar estado..."
                value={stateSearch}
                onValueChange={setStateSearch}
              />
              <CommandList>
                <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                <CommandGroup heading="Estados">
                  {filteredStates.map((s) => {
                    const stateLabel = `${s.stateCode} - ${s.name} (todo o estado)`;
                    const active = selected.includes(stateLabel);
                    return (
                      <CommandItem
                        key={s.stateCode}
                        value={s.stateCode}
                        onSelect={() => {
                          setSelectedStateCode(s.stateCode);
                          setStateSearch("");
                          setCitySearch("");
                        }}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Check
                            className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")}
                          />
                          <span>
                            <span className="font-sans text-[11px] text-muted-foreground">{s.stateCode}</span>
                            {" "}
                            {s.name}
                          </span>
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <Command>
              <div className="flex items-center border-b border-border px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mr-2 h-6 px-2 text-xs"
                  onClick={() => {
                    setSelectedStateCode(null);
                    setCitySearch("");
                  }}
                >
                  ← Estados
                </Button>
                <span className="text-xs font-medium">
                  {BR_STATES.find((s) => s.stateCode === selectedStateCode)?.name}
                </span>
              </div>
              <CommandInput
                placeholder="Buscar cidade..."
                value={citySearch}
                onValueChange={setCitySearch}
              />
              <CommandList>
                {loadingCities ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando municípios...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                    <CommandGroup heading="Todo o estado">
                      {(() => {
                        const stateName = BR_STATES.find((s) => s.stateCode === selectedStateCode)?.name ?? selectedStateCode;
                        const stateLabel = `${selectedStateCode} - ${stateName} (todo o estado)`;
                        const active = selected.includes(stateLabel);
                        return (
                          <CommandItem
                            key="all-state"
                            value={stateLabel}
                            onSelect={() => toggle(stateLabel)}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")}
                            />
                            {stateLabel}
                          </CommandItem>
                        );
                      })()}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading={`Municípios de ${selectedStateCode} (${filteredCities.length})`}>
                      {filteredCities.map((loc) => {
                        const active = selected.includes(loc.label);
                        return (
                          <CommandItem
                            key={loc.label}
                            value={loc.label}
                            onSelect={() => toggle(loc.label)}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")}
                            />
                            {loc.city}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((label) => (
            <Badge key={label} variant="secondary" className="gap-1 text-[11px]">
              {label}
              <button
                type="button"
                onClick={() => toggle(label)}
                aria-label={`Remover ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
