import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Switch } from "@/shared/ui/switch";
import { Music } from "lucide-react";
import { ObraTipoBadge } from "@/modules/catalog/components/ObraFormModal";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useObras";
import {
  obraOutrosTitulos,
  obraReferenciasConexas,
  obraLetraCompleta,
  obraCriadaPorIA,
  obraTipoIAValue,
  obraIaHarmonia,
  obraIaMelodia,
  obraIaLetra,
  obraToParticipantes,
  exportInstrumental,
  parseDuracao,
} from "@/modules/catalog/mappers";

interface ObraViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? "";
  if (s === "registered")
    return <Badge variant="success">Registrado</Badge>;
  if (s === "under_review" || s === "in_review")
    return <Badge variant="warning">Em Análise</Badge>;
  if (s === "pending")
    return <Badge variant="warning">Pendente</Badge>;
  if (s === "rejected")
    return <Badge variant="danger">Rejeitado</Badge>;
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
      {children}
    </p>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function MonoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-sans text-sm font-medium text-primary">
        {value || "—"}
      </p>
    </div>
  );
}

function SwitchField({ label, value }: { label: string; value: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center h-9">
        <Switch checked={value} disabled />
      </div>
    </div>
  );
}

export function ObraViewModal({
  open,
  onOpenChange,
  obra: obraProp,
}: ObraViewModalProps) {
  // Busca DIRETO por ID (GET /works/:id) — não depende da obra estar entre
  // os primeiros registros carregados (Task J: antes usava useObras() sem
  // filtro, que truncava em 50 obras por tenant).
  const { entity: fresh } = useEntityById<ObraWithRelations>("obras", open ? obraProp?.id : undefined);
  if (!obraProp) return null;

  const obra: any = fresh ? { ...obraProp, ...fresh } : obraProp;

  const outrosTitulos    = obraOutrosTitulos(obra);
  const referenciasConexas = obraReferenciasConexas(obra);
  const letraCompleta    = obraLetraCompleta(obra);
  const criadaPorIA      = obraCriadaPorIA(obra) === "sim";
  const tipoIA           = obraTipoIAValue(obra);
  const iaHarmonia       = obraIaHarmonia(obra);
  const iaMelodia        = obraIaMelodia(obra);
  const iaLetra          = obraIaLetra(obra);
  const participantes    = obraToParticipantes(obra);
  const instrumental     =
    exportInstrumental(obra as Record<string, unknown>) === "Sim";

  const dur = parseDuracao(obra.duracao);
  const duracaoDisplay =
    dur.min || dur.seg
      ? `${dur.min || "0"}min ${dur.seg || "0"}seg`
      : obra.duracao || null;

  const artistaNome   = obra.artistas?.nome_artistico ?? null;
  const projetoTitle = obra.projetos?.title ?? null;

  const iaElementos = [
    iaHarmonia.ferramenta || iaHarmonia.prompt ? "Harmonia" : null,
    iaMelodia.ferramenta  || iaMelodia.prompt  ? "Melodia"  : null,
    iaLetra.ferramenta    || iaLetra.prompt     ? "Letra"    : null,
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Detalhes da Obra</DialogTitle>
          <DialogDescription>Informações completas da obra musical</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 pb-6 space-y-6">

            {/* Header da Obra */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Music className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{obra.title || "—"}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={obra.status} />
                  <ObraTipoBadge type={obra.tipo_obra} />
                </div>
                {obra.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {new Date(obra.created_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            {/* Projeto Vinculado — exibido apenas quando há vínculo */}
            {(artistaNome || projetoTitle) && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Projeto Vinculado</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {projetoTitle && <InfoField label="Projeto" value={projetoTitle} />}
                    {artistaNome && <InfoField label="Artista do Projeto" value={artistaNome} />}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Informações Gerais */}
            <div>
              <SectionTitle>Informações Gerais</SectionTitle>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero"  value={obra.genero} />
                <InfoField label="Idioma"  value={obra.idioma} />
                <InfoField label="Duração" value={duracaoDisplay} />
                <SwitchField label="Instrumental" value={instrumental} />
              </div>
            </div>

            {/* Códigos de Registro — exibido apenas quando há algum código */}
            {(obra.cod_entidade || obra.cod_ecad || obra.isrc || obra.iswc) && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Códigos de Registro</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {obra.cod_entidade && <MonoField label="Código de Cadastro da Sociedade" value={obra.cod_entidade} />}
                    {obra.cod_ecad && <MonoField label="Código ECAD" value={obra.cod_ecad} />}
                    {obra.isrc && <MonoField label="ISRC" value={obra.isrc} />}
                    {obra.iswc && <MonoField label="ISWC" value={obra.iswc} />}
                  </div>
                </div>
              </>
            )}

            {/* Participantes (Nome, Função, %, Link) */}
            {participantes.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>
                    Participantes (Nome, Função, %, Link)
                  </SectionTitle>
                  <div className="space-y-1">
                    {participantes.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-b-0 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground block">
                            {p.nome || "—"}
                          </span>
                          {p.link && (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block"
                            >
                              {p.link}
                            </a>
                          )}
                        </div>
                        {p.classeFuncao && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal shrink-0"
                          >
                            {p.classeFuncao}
                          </Badge>
                        )}
                        {p.percentual && (
                          <span className="text-muted-foreground w-12 text-right shrink-0">
                            {p.percentual}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Inteligência Artificial */}
            {criadaPorIA && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Inteligência Artificial</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">
                    <SwitchField label="Criada por IA"    value={criadaPorIA} />
                    <InfoField   label="Tipo de Geração IA" value={tipoIA || null} />
                  </div>
                  {iaElementos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Elementos IA: {iaElementos.join(", ")}
                      </p>
                      {(iaHarmonia.ferramenta || iaHarmonia.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Harmonia
                          </p>
                          {iaHarmonia.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {iaHarmonia.ferramenta}
                            </p>
                          )}
                          {iaHarmonia.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {iaHarmonia.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(iaMelodia.ferramenta || iaMelodia.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Melodia
                          </p>
                          {iaMelodia.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {iaMelodia.ferramenta}
                            </p>
                          )}
                          {iaMelodia.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {iaMelodia.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(iaLetra.ferramenta || iaLetra.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Letra (IA)
                          </p>
                          {iaLetra.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {iaLetra.ferramenta}
                            </p>
                          )}
                          {iaLetra.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {iaLetra.prompt}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Outros Títulos */}
            {outrosTitulos.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Outros Títulos</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {outrosTitulos.map((t, i) => (
                      <Badge key={i} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Referências Conectadas */}
            {referenciasConexas.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Referências Conectadas</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {referenciasConexas.map((r, i) => (
                      <Badge key={i} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Letra */}
            {letraCompleta && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Letra</SectionTitle>
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                    {letraCompleta}
                  </pre>
                </div>
              </>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

