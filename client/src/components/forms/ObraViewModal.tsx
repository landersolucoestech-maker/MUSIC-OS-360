import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music, Calendar, FolderKanban, ExternalLink, Pencil, X, Loader2, Clock, Building2, FileText, Hash } from "lucide-react";
import { Link } from "react-router-dom";
import { ObraTipoBadge } from "./ObraFormModal";
import { AbramusBadge } from "@/components/shared/AbramusBadge";
import { useObras } from "@/hooks/useObras";
import { useProjetos } from "@/hooks/useProjetos";

interface ObraViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? "";
  if (s === "registrado")
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">Registrado</Badge>;
  if (s === "analise" || s === "análise")
    return <Badge className="bg-amber-600 hover:bg-amber-600 text-white">Em Análise</Badge>;
  if (s === "pendente")
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Pendente</Badge>;
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function MonoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-mono text-sm font-medium text-primary">{value || "—"}</p>
    </div>
  );
}

export function ObraViewModal({ open, onOpenChange, obra: obraProp }: ObraViewModalProps) {
  const { obras, updateObra } = useObras();
  const { projetos } = useProjetos();
  const [editingProjeto, setEditingProjeto] = useState(false);

  useEffect(() => {
    if (!open) setEditingProjeto(false);
  }, [open]);

  if (!obraProp) return null;

  // Always prefer the freshest version from the query cache so updates made
  // inside this modal are reflected immediately, even though the parent only
  // passes a snapshot of the obra.
  const fresh = obraProp?.id ? obras.find((o) => o.id === obraProp.id) : undefined;
  const obra: any = fresh ? { ...obraProp, ...fresh } : obraProp;

  const compositoresList: string[] = obra.compositores
    ? (Array.isArray(obra.compositores)
        ? obra.compositores
        : String(obra.compositores).split(",").map((s: string) => s.trim()).filter(Boolean))
    : obra.compositor
    ? [obra.compositor]
    : [];

  const coCompositoresList: string[] = obra.co_compositores
    ? String(obra.co_compositores).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const formatDate = (d?: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };

  const currentProjetoId: string | null = obra.projetos?.id ?? obra.projeto_id ?? null;
  const isUpdatingProjeto = updateObra.isPending;

  const handleChangeProjeto = async (newProjetoId: string | null) => {
    if (!obra?.id) return;
    if (newProjetoId === currentProjetoId) {
      setEditingProjeto(false);
      return;
    }
    try {
      await updateObra.mutateAsync({ id: obra.id, projeto_id: newProjetoId });
      setEditingProjeto(false);
    } catch {
      // toast shown by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Music className="h-5 w-5 text-primary" />
              Detalhes da Obra
            </DialogTitle>
            <ObraTipoBadge tipo={obra.tipo_obra} />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-5 pr-2">

            {/* Título + status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{obra.titulo || obra.title || "—"}</h2>
                {obra.tipo && (
                  <p className="text-sm text-muted-foreground capitalize mt-0.5">{obra.tipo}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={obra.status} />
                <AbramusBadge
                  origem={obra.origem_externa}
                  sincronizadoEm={obra.origem_externa_sincronizado_em}
                />
              </div>
            </div>

            <Separator />

            {/* Projeto vinculado */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projeto Vinculado</p>
                {!editingProjeto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditingProjeto(true)}
                    data-testid="button-alterar-projeto"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {currentProjetoId ? "Alterar" : "Vincular projeto"}
                  </Button>
                )}
              </div>

              {editingProjeto ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={currentProjetoId ?? "__none__"}
                    onValueChange={(v) => handleChangeProjeto(v === "__none__" ? null : v)}
                    disabled={isUpdatingProjeto}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-projeto">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" data-testid="option-projeto-none">
                        Sem projeto
                      </SelectItem>
                      {(projetos ?? []).map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          data-testid={`option-projeto-${p.id}`}
                        >
                          {p.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentProjetoId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleChangeProjeto(null)}
                      disabled={isUpdatingProjeto}
                      data-testid="button-desvincular-projeto"
                    >
                      Desvincular
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingProjeto(false)}
                    disabled={isUpdatingProjeto}
                    aria-label="Cancelar"
                    data-testid="button-cancelar-alterar-projeto"
                  >
                    {isUpdatingProjeto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : currentProjetoId ? (
                <Link
                  to={`/projetos?projeto=${currentProjetoId}`}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  data-testid={`link-projeto-${currentProjetoId}`}
                >
                  <FolderKanban className="h-4 w-4" />
                  <span>{obra.projetos?.titulo ?? (projetos ?? []).find((p) => p.id === currentProjetoId)?.titulo ?? "Projeto"}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-projeto-empty">Sem projeto vinculado</p>
              )}
            </div>

            <Separator />

            {/* Informações gerais */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informações Gerais</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero" value={obra.genero} />
                <InfoField label="Duração" value={obra.duracao} />
                <InfoField label="Editora" value={obra.editora} />
                <InfoField label="Detentores de Direitos" value={obra.detentores} />
              </div>
            </div>

            <Separator />

            {/* Códigos de registro */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Códigos de Registro</p>
              <div className="grid grid-cols-3 gap-3">
                <MonoField label="ISRC" value={obra.isrc} />
                <MonoField label="ISWC" value={obra.iswc} />
                <MonoField label="Código ABRAMUS" value={obra.cod_abramus} />
              </div>
              <div className="mt-3">
                <MonoField label="Código ECAD" value={obra.cod_ecad} />
              </div>
            </div>

            <Separator />

            {/* Compositores */}
            {compositoresList.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compositores</p>
                <div className="flex flex-wrap gap-2">
                  {compositoresList.map((comp, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm">{comp}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Co-compositores */}
            {coCompositoresList.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Co-compositores</p>
                <div className="flex flex-wrap gap-2">
                  {coCompositoresList.map((comp, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm">{comp}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Datas */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Registrado em: <span className="font-medium text-foreground">{formatDate(obra.created_at)}</span></span>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
