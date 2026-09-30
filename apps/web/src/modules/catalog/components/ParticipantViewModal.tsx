import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { GENDER_LABELS } from "@/modules/artist/mappers";

interface ParticipantViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: Artist | null;
}

const formatDateDMY = (d?: string | null): string => {
  if (!d) return "";
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d.replace(/\//g, "-");
  const datePart = d.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
  }
  return d;
};

/**
 * The artist contract has no person-type field: it is derived from the
 * CPF/CNPJ (14 digits = CNPJ → pessoa jurídica). The profile type (managed,
 * record_label…) describes commercial representation, not the person type.
 */
const derivePersonType = (artist: Artist): string => {
  const digits = (artist.taxId ?? "").replace(/\D/g, "");
  return digits.length === 14 ? "Jurídica" : "Física";
};

export function ParticipantViewModal({
  open,
  onOpenChange,
  artist,
}: ParticipantViewModalProps) {
  if (!artist) return null;

  const fullName = artist.fullName || artist.stageName || "";
  const pseudonym = artist.stageName || "";
  const personType = derivePersonType(artist);
  const gender = artist.gender ?? "";
  const birthDate = formatDateDMY(artist.birthDate);
  const taxId = artist.taxId || "";
  // The artist contract (CZ-042) has no CAE field — shown empty.
  const cae = "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" data-testid="modal-participant-view">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">
            Visualizar Participante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <Label className="text-xs text-foreground">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={fullName}
              disabled
              className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
              data-testid="input-participant-name"
            />
          </div>

          {/* Row: Pseudonym | Person type | Gender */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pseudônimo</Label>
              <Input
                value={pseudonym}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participant-pseudonym"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Pessoa</Label>
              <Select value={personType} disabled>
                <SelectTrigger className="bg-muted/30 text-sm h-9" data-testid="select-participant-person-type">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Física">Física</SelectItem>
                  <SelectItem value="Jurídica">Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gênero</Label>
              <Select value={gender} disabled>
                <SelectTrigger className="bg-muted/30 text-sm h-9" data-testid="select-participant-gender">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GENDER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: date of birth | CPF/CNPJ | CAE */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de Nascimento</Label>
              <Input
                value={birthDate}
                disabled
                placeholder="DD/MM/AAAA"
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participant-birth-date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
              <Input
                value={taxId}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participant-cpf-cnpj"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CAE</Label>
              <Input
                value={cae}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participant-cae"
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">* Campo obrigatório</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

