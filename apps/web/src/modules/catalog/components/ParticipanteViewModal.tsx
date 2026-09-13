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

interface ParticipanteViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artista: Artist | null;
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

const deriveTipoPessoa = (artista: Artist): string => {
  const raw = artista.personType;
  if (raw) {
    const r = raw.toLowerCase();
    if (r.includes("juridica") || r.includes("jurídica")) return "Jurídica";
    if (r.includes("fisica") || r.includes("física")) return "Física";
    return raw;
  }
  const perfil = (artista.profileType as string | null | undefined) ?? "";
  if (perfil.toLowerCase().includes("empresa")) return "Jurídica";
  return "Física";
};

export function ParticipanteViewModal({
  open,
  onOpenChange,
  artista,
}: ParticipanteViewModalProps) {
  if (!artista) return null;

  const nomeCivil = artista.legalName || artista.name || artista.stageName || "";
  const pseudonimo = artista.stageName || "";
  const tipoPessoa = deriveTipoPessoa(artista);
  const genero = ((artista as unknown as Record<string, unknown>).genero as string | null | undefined) ?? "";
  const dataNascimento = formatDateDMY(artista.birthDate);
  const cpfCnpj = artista.taxId || "";
  const cae = ((artista as unknown as Record<string, unknown>).cae as string | null | undefined) ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" data-testid="modal-participante-view">
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
              value={nomeCivil}
              disabled
              className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
              data-testid="input-participante-nome"
            />
          </div>

          {/* Row: Pseudônimo | Tipo de Pessoa | Gênero */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pseudônimo</Label>
              <Input
                value={pseudonimo}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participante-pseudonimo"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Pessoa</Label>
              <Select value={tipoPessoa} disabled>
                <SelectTrigger className="bg-muted/30 text-sm h-9" data-testid="select-participante-type-pessoa">
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
              <Select value={genero} disabled>
                <SelectTrigger className="bg-muted/30 text-sm h-9" data-testid="select-participante-genero">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Data de Nascimento | CPF/CNPJ | CAE */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de Nascimento</Label>
              <Input
                value={dataNascimento}
                disabled
                placeholder="DD/MM/YYYY"
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participante-data-nascimento"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
              <Input
                value={cpfCnpj}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participante-cpf-cnpj"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CAE</Label>
              <Input
                value={cae}
                disabled
                className="bg-muted/30 text-sm opacity-100 cursor-not-allowed"
                data-testid="input-participante-cae"
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">* Campo obrigatório</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

