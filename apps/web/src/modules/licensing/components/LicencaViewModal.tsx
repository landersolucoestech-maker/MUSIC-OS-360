import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { FileText, Music, Building, DollarSign, Calendar, MapPin, Tv } from "lucide-react";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { formatLicensingDate, formatRemuneration, workArtistLabel, mediaLabel, typeLabel } from "@/modules/licensing/lib/licenca-format";
import type { Work } from "@/modules/catalog/types/catalog.types";

interface ClientOption { id: string; name: string }

interface LicenseViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenca?: any;
}

const getStatusBadge = (status?: string) => {
  switch (status) {
    case "ativa": return <Badge variant="success">Ativa</Badge>;
    case "negociacao": return <Badge variant="warning">Em Negociação</Badge>;
    case "proposta": return <Badge variant="info">Proposta Enviada</Badge>;
    case "expirada": return <Badge variant="danger">Expirada</Badge>;
    default: return <Badge variant="neutral">{status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "—"}</Badge>;
  }
};

function Field({ label, value, icon, valueClassName }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode; valueClassName?: string }) {
  return (
    <div>
      <span className="text-sm text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <p className={`font-medium ${valueClassName ?? ""}`}>{value || "—"}</p>
    </div>
  );
}

export function LicenseViewModal({ open, onOpenChange, licenca: license }: LicenseViewModalProps) {
  // Fetches DIRECTLY by ID (GET /works/:id, GET /clients/:id) — does not depend on the
  // work/client being among the first 50 loaded by useObras() /
  // an unfiltered client listing (Task J).
  const { entity: work } = useEntityById<Work>("obras", open ? license?.work_id ?? undefined : undefined);
  const { entity: client } = useEntityById<ClientOption>("clientes", open ? license?.client_id ?? undefined : undefined);

  if (!license) return null;

  const workTitle = work?.title ?? null;
  const artist = workArtistLabel(work) || null;
  const clientName = client?.name ?? null;

  const start = formatLicensingDate(license.start_date);
  const end = formatLicensingDate(license.end_date);
  const term = start || end ? `${start ?? "—"} até ${end ?? "—"}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Licença
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* License information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Informações da Licença
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Título" value={license.title} />
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="mt-1">{getStatusBadge(license.status)}</div>
              </div>
              <Field label="Tipo de Licença" value={typeLabel(license.type)} />
              <Field label="Obra Musical" value={workTitle} />
              <Field label="Artista" value={artist} />
            </div>
          </div>

          {/* Client and project */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Cliente e Projeto
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cliente" value={clientName} />
              <Field label="Projeto" value={license.projeto} />
              <Field label="Mídia de Destino" icon={<Tv className="h-3 w-3" />} value={mediaLabel(license.midia_destino)} />
              <Field label="Território" icon={<MapPin className="h-3 w-3" />} value={typeLabel(license.territorio)} />
            </div>
          </div>

          {/* Period and compensation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Período e Remuneração
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vigência" icon={<Calendar className="h-3 w-3" />} value={term} />
              <Field label="Remuneração" value={formatRemuneration(license)} valueClassName="text-success" />
            </div>
          </div>

          {/* Notes */}
          {license.notes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Observações</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{license.notes}</p>
            </div>
          )}

          {/* Metadata */}
          {(license.created_at || license.updated_at) && (
            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3 text-xs text-muted-foreground">
              {license.created_at && <div>Criada em: {formatLicensingDate(license.created_at)}</div>}
              {license.updated_at && <div>Atualizada em: {formatLicensingDate(license.updated_at)}</div>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
