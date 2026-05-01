import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormTextarea } from "@/components/forms/FormField";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, ChevronDown, Trash2, X, Briefcase, Mic2 } from "lucide-react";
import { useProjetos, type ProjetoWithRelations } from "@/hooks/useProjetos";
import { useObras } from "@/hooks/useObras";
import { useCurrentOrgId } from "@/hooks/useCurrentOrgId";
import { AbramusSearchRow } from "@/components/forms/AbramusSearchRow";
import { useArtistasAssinados } from "@/hooks/useArtistasAssinados";
import { useDebounce } from "@/hooks/useDebounce";
import type { TipoObra } from "@/components/forms/ObraTipoSelectorModal";
import {
  dbStatusToSelect,
  normalizeStatusForDb,
  parseDuracao,
  formatDuracao,
  obraToParticipantes,
  participantesToCompositoresLetristas,
  obraTitulo,
} from "@/components/forms/registroMusicasMappers";

export const ObraTipoBadge = ({ tipo }: { tipo?: TipoObra | string | null }) => {
  if (tipo === "autoral") {
    return (
      <Badge
        className="bg-blue-600 hover:bg-blue-600 text-white"
        data-testid="badge-tipo-obra-autoral"
      >
        Obra Autoral
      </Badge>
    );
  }
  return (
    <Badge
      className="bg-amber-500 hover:bg-amber-500 text-white"
      data-testid="badge-tipo-obra-referencia"
    >
      Obra por Referência
    </Badge>
  );
};

interface ProjetoSelecionado {
  id: string;
  nome: string;
  artistaNome?: string | null;
}

interface ObraFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
  mode: "create" | "edit" | "view";
  /**
   * Tipo da obra escolhido no seletor (Task #288). Quando informado,
   * força a classificação no cabeçalho. Em modo "edit"/"view" é
   * derivado do registro `obra.tipo_obra`.
   */
  tipoObra?: TipoObra;
}

interface Participante {
  id: string;
  nome: string;
  classeFuncao: string;
  link: string;
  percentual: string;
}

interface IAElement {
  ferramenta: string;
  prompt: string;
}

const generosMusicais = [
  "Axé",
  "Blues",
  "Bolero",
  "Bossa Nova",
  "Clássica",
  "Country",
  "Eletrônica",
  "Folk",
  "Forró",
  "Funk",
  "Gospel",
  "Indie",
  "Jazz",
  "Lo-fi",
  "Metal",
  "MPB",
  "Pagode",
  "Pop",
  "Punk",
  "R&B",
  "Rap/Hip-Hop",
  "Reggae",
  "Reggaeton",
  "Rock",
  "Salsa",
  "Samba",
  "Sertanejo",
  "Soul",
  "Trap",
  "Outro",
];
const idiomas = [
  "Alemão",
  "Árabe",
  "Coreano",
  "Espanhol",
  "Francês",
  "Hebraico",
  "Hindi",
  "Holandês",
  "Inglês",
  "Italiano",
  "Japonês",
  "Latim",
  "Mandarim",
  "Norueguês",
  "Polonês",
  "Português",
  "Russo",
  "Sueco",
  "Turco",
  "Outro",
];
const situacoes = ["Em Análise", "Pendente", "Registrado", "Rejeitado"];
const classesFuncao = [
  "Editor",
  "Administrador",
  "Compositor/Autor",
  "Tradutor",
];

export function ObraFormModal({
  open,
  onOpenChange,
  obra,
  mode,
  tipoObra: tipoObraProp,
}: ObraFormModalProps) {
  const { projetos } = useProjetos();
  const { addObra, updateObra } = useObras();
  const { orgId } = useCurrentOrgId();
  const { artistas: artistasAssinados, isLoading: loadingArtistas } =
    useArtistasAssinados();

  // Resolução do tipo da obra. Em criação vem do seletor (prop). Em
  // edição/visualização vem do próprio registro. Default = referencia.
  const tipoObra: TipoObra = (tipoObraProp ??
    (obra?.tipo_obra as TipoObra | undefined) ??
    "referencia") as TipoObra;
  const isAutoral = tipoObra === "autoral";

  const [artistaId, setArtistaId] = useState<string>(obra?.artista_id ?? "");
  const [projetoSelecionado, setProjetoSelecionado] =
    useState<ProjetoSelecionado | null>(null);
  const [buscaProjeto, setBuscaProjeto] = useState("");
  const debouncedBuscaProjeto = useDebounce(buscaProjeto, 300);
  const [buscaProjetoOpen, setBuscaProjetoOpen] = useState(false);
  const initialDuracao = parseDuracao(obra?.duracao);
  const [codAbramus, setCodAbramus] = useState(obra?.cod_abramus ?? obra?.codAbramus ?? "");
  const [codEcad, setCodEcad] = useState(obra?.cod_ecad ?? obra?.codEcad ?? "");
  const [iswc, setIswc] = useState(obra?.iswc || "");
  const [tituloObra, setTituloObra] = useState(obraTitulo(obra));
  const [situacao, setSituacao] = useState(dbStatusToSelect(obra?.status));
  const [generoMusical, setGeneroMusical] = useState(
    obra?.genero?.toLowerCase() || "",
  );
  const [idioma, setIdioma] = useState(obra?.idioma || "");
  const [duracaoMin, setDuracaoMin] = useState(obra?.duracaoMin ?? initialDuracao.min);
  const [duracaoSeg, setDuracaoSeg] = useState(obra?.duracaoSeg ?? initialDuracao.seg);
  const [instrumental, setInstrumental] = useState(obra?.instrumental || "nao");
  const [criadaPorIA, setCriadaPorIA] = useState(obra?.criadaPorIA || "nao");
  const [tipoIA, setTipoIA] = useState(obra?.tipoIA || "");
  const [iaHarmonia, setIaHarmonia] = useState<IAElement>(
    obra?.iaHarmonia || { ferramenta: "", prompt: "" },
  );
  const [iaMelodia, setIaMelodia] = useState<IAElement>(
    obra?.iaMelodia || { ferramenta: "", prompt: "" },
  );
  const [iaLetra, setIaLetra] = useState<IAElement>(
    obra?.iaLetra || { ferramenta: "", prompt: "" },
  );
  const [participantes, setParticipantes] = useState<Participante[]>(
    () => obraToParticipantes(obra),
  );
  const [outrosTitulos, setOutrosTitulos] = useState<string[]>(
    obra?.outrosTitulos || [],
  );
  const [referenciasConexas, setReferenciasConexas] = useState<string[]>(
    obra?.referenciasConexas || [],
  );
  const [letraCompleta, setLetraCompleta] = useState(obra?.letraCompleta || "");
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // Sync state whenever the modal opens or the obra record changes
  useEffect(() => {
    if (!open) return;
    const dur = parseDuracao(obra?.duracao);
    setBuscaProjeto("");
    setBuscaProjetoOpen(false);
    setCodAbramus(obra?.cod_abramus ?? obra?.codAbramus ?? "");
    setCodEcad(obra?.cod_ecad ?? obra?.codEcad ?? "");
    setIswc(obra?.iswc || "");
    setTituloObra(obraTitulo(obra));
    setSituacao(dbStatusToSelect(obra?.status));
    setGeneroMusical(obra?.genero?.toLowerCase() || "");
    setIdioma(obra?.idioma || "");
    setDuracaoMin(obra?.duracaoMin ?? dur.min);
    setDuracaoSeg(obra?.duracaoSeg ?? dur.seg);
    setInstrumental(obra?.instrumental || "nao");
    setCriadaPorIA(obra?.criadaPorIA || "nao");
    setTipoIA(obra?.tipoIA || "");
    setIaHarmonia(obra?.iaHarmonia || { ferramenta: "", prompt: "" });
    setIaMelodia(obra?.iaMelodia || { ferramenta: "", prompt: "" });
    setIaLetra(obra?.iaLetra || { ferramenta: "", prompt: "" });
    setParticipantes(obraToParticipantes(obra));
    setOutrosTitulos(obra?.outrosTitulos || []);
    setReferenciasConexas(obra?.referenciasConexas || []);
    setLetraCompleta(obra?.letraCompleta || "");
    setAceitaTermos(false);
    setArtistaId(obra?.artista_id ?? "");
  }, [open, obra]);

  // Hidrata o projeto vinculado a partir de obra.projeto_id assim que a lista
  // de projetos chegar (ou quando o registro mudar). Em modo create, fica null.
  useEffect(() => {
    if (!open) return;
    const projetoId: string | undefined = obra?.projeto_id ?? obra?.projetoId;
    if (!projetoId) {
      setProjetoSelecionado(null);
      return;
    }
    const found = projetos.find((p: ProjetoWithRelations) => p.id === projetoId);
    if (found) {
      setProjetoSelecionado({
        id: found.id,
        nome: found.nome,
        artistaNome: found.artistas?.nome ?? null,
      });
    } else {
      // Ainda carregando ou projeto fora do filtro — mantém ID com placeholder.
      setProjetoSelecionado({ id: projetoId, nome: "Projeto vinculado" });
    }
  }, [open, obra, projetos]);

  // Lista de projetos concluídos filtrada pelo termo digitado
  const projetosConcluidosFiltrados: ProjetoWithRelations[] = projetos
    .filter((p: ProjetoWithRelations) => p.status === "concluido")
    .filter((p: ProjetoWithRelations) => {
      if (!buscaProjeto) return true;
      const termo = buscaProjeto.toLowerCase();
      return (
        (p.nome ?? "").toLowerCase().includes(termo) ||
        (p.artistas?.nome ?? "").toLowerCase().includes(termo)
      );
    });

  const [participacaoOpen, setParticipacaoOpen] = useState(true);
  const [outrosTitulosOpen, setOutrosTitulosOpen] = useState(false);
  const [referenciasOpen, setReferenciasOpen] = useState(false);
  const [letraOpen, setLetraOpen] = useState(true);

  const isViewMode = mode === "view";
  const title =
    mode === "create"
      ? "Nova Obra"
      : mode === "edit"
        ? "Editar Música"
        : "Detalhes da Obra";

  const calcularPercentualTotal = () => {
    return participantes.reduce(
      (total, p) => total + (parseFloat(p.percentual) || 0),
      0,
    );
  };

  const addParticipante = () => {
    setParticipantes([
      ...participantes,
      {
        id: crypto.randomUUID(),
        nome: "",
        classeFuncao: "",
        link: "",
        percentual: "",
      },
    ]);
  };

  const updateParticipante = (
    id: string,
    field: keyof Participante,
    value: string,
  ) => {
    setParticipantes(
      participantes.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const removeParticipante = (id: string) => {
    setParticipantes(participantes.filter((p) => p.id !== id));
  };

  const addOutroTitulo = () => {
    setOutrosTitulos([...outrosTitulos, ""]);
  };

  const updateOutroTitulo = (index: number, value: string) => {
    const newTitulos = [...outrosTitulos];
    newTitulos[index] = value;
    setOutrosTitulos(newTitulos);
  };

  const removeOutroTitulo = (index: number) => {
    setOutrosTitulos(outrosTitulos.filter((_, i) => i !== index));
  };

  const addReferenciaConexas = () => {
    setReferenciasConexas([...referenciasConexas, ""]);
  };

  const updateReferenciaConexas = (index: number, value: string) => {
    const newRefs = [...referenciasConexas];
    newRefs[index] = value;
    setReferenciasConexas(newRefs);
  };

  const removeReferenciaConexas = (index: number) => {
    setReferenciasConexas(referenciasConexas.filter((_, i) => i !== index));
  };

  const duracaoMinNum = Number(duracaoMin);
  const duracaoSegNum = Number(duracaoSeg);
  const duracaoMinError =
    duracaoMin !== "" && (!Number.isInteger(duracaoMinNum) || duracaoMinNum < 0)
      ? "Minutos não pode ser negativo"
      : null;
  const duracaoSegError =
    duracaoSeg !== "" &&
    (!Number.isInteger(duracaoSegNum) ||
      duracaoSegNum < 0 ||
      duracaoSegNum > 59)
      ? "Segundos deve estar entre 0 e 59"
      : null;
  const hasDuracaoError = !!(duracaoMinError || duracaoSegError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDuracaoError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    if (!tituloObra) {
      toast.error("Título da obra é obrigatório!");
      return;
    }

    if (isAutoral && !artistaId) {
      toast.error(
        "Para Obra Autoral é obrigatório selecionar um artista com contrato ativo.",
      );
      return;
    }

    if (!aceitaTermos) {
      toast.error("Você precisa aceitar os termos de uso!");
      return;
    }

    if (!orgId) {
      toast.error("Não foi possível identificar sua organização. Tente novamente.");
      return;
    }

    const { compositores, letristas } = participantesToCompositoresLetristas(participantes);
    const duracao = formatDuracao(duracaoMin, duracaoSeg);

    const payload = {
      titulo: tituloObra.trim(),
      genero: generoMusical || null,
      iswc: iswc || null,
      duracao,
      status: normalizeStatusForDb(situacao),
      compositores,
      letristas,
      projeto_id: projetoSelecionado?.id ?? null,
      artista_id: isAutoral ? artistaId || null : null,
      tipo_obra: tipoObra,
      org_id: orgId,
    };

    try {
      if (mode === "edit" && obra?.id) {
        await updateObra.mutateAsync({ id: obra.id, ...payload });
      } else {
        await addObra.mutateAsync(payload as any);
      }
      onOpenChange(false);
    } catch {
      // Erros já são exibidos via toast pelo hook useSupabaseQuery.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{title}</DialogTitle>
            <ObraTipoBadge tipo={tipoObra} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Artista (somente para Obra Autoral) */}
          {isAutoral && (
            <div className="border border-border rounded-lg p-5 space-y-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">
                  Artista com contrato ativo *
                </span>
              </div>
              <Select
                value={artistaId}
                onValueChange={setArtistaId}
                disabled={isViewMode || loadingArtistas}
              >
                <SelectTrigger
                  className="h-10"
                  data-testid="select-artista-autoral"
                >
                  <SelectValue
                    placeholder={
                      loadingArtistas
                        ? "Carregando artistas..."
                        : artistasAssinados.length === 0
                          ? "Nenhum artista com contrato ativo encontrado"
                          : "Selecione um artista"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {artistasAssinados.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      data-testid={`option-artista-${a.id}`}
                    >
                      {a.nome_artistico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A lista mostra apenas artistas com pelo menos 1 contrato com
                status <strong>assinado</strong>.
              </p>
            </div>
          )}

          {/* Vincular a Projeto Concluído */}
          <div className="border border-border rounded-lg p-5 space-y-3 bg-muted/10">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                Vincular a Projeto Concluído
              </span>
            </div>

            {projetoSelecionado ? (
              <div
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                data-testid="projeto-vinculado-card"
              >
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    data-testid="text-projeto-vinculado-nome"
                  >
                    {projetoSelecionado.nome}
                  </p>
                  {projetoSelecionado.artistaNome && (
                    <p className="text-xs text-muted-foreground truncate">
                      {projetoSelecionado.artistaNome}
                    </p>
                  )}
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setProjetoSelecionado(null)}
                    data-testid="button-remove-projeto-vinculado"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Popover
                open={buscaProjetoOpen}
                onOpenChange={setBuscaProjetoOpen}
              >
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={buscaProjeto}
                      onChange={(e) => {
                        setBuscaProjeto(e.target.value);
                        setBuscaProjetoOpen(true);
                      }}
                      onFocus={() => !isViewMode && setBuscaProjetoOpen(true)}
                      onClick={() => !isViewMode && setBuscaProjetoOpen(true)}
                      disabled={isViewMode}
                      placeholder="Digite para buscar um projeto concluído..."
                      className="pl-10"
                      data-testid="input-buscar-projeto"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[480px] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <ScrollArea className="max-h-[320px]">
                    <div className="p-2" role="listbox">
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        {buscaProjeto
                          ? `Resultados para "${buscaProjeto}"`
                          : "Projetos concluídos disponíveis"}
                      </p>
                      {projetosConcluidosFiltrados.length > 0 ? (
                        projetosConcluidosFiltrados.map((p) => {
                          const selectProjeto = () => {
                            setProjetoSelecionado({
                              id: p.id,
                              nome: p.nome,
                              artistaNome: p.artistas?.nome ?? null,
                            });
                            setBuscaProjeto("");
                            setBuscaProjetoOpen(false);
                            toast.success(`Projeto "${p.nome}" vinculado!`);
                          };
                          return (
                            <div
                              key={p.id}
                              role="option"
                              tabIndex={0}
                              aria-selected={projetoSelecionado?.id === p.id}
                              className="flex items-center gap-3 p-2 hover:bg-muted focus:bg-muted focus:outline-none rounded-lg cursor-pointer transition-colors"
                              onClick={selectProjeto}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectProjeto();
                                }
                              }}
                              data-testid={`option-projeto-${p.id}`}
                            >
                              <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {p.nome}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {p.artistas?.nome ?? "—"}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p
                          className="text-sm text-muted-foreground text-center py-4"
                          data-testid="text-empty-projetos"
                        >
                          Nenhum projeto concluído encontrado.
                        </p>
                      )}
                      <AbramusSearchRow
                        kind="obras"
                        query={debouncedBuscaProjeto}
                        onImported={() => {
                          setBuscaProjeto("");
                          setBuscaProjetoOpen(false);
                        }}
                      />
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Dados Principais da Obra */}
          <div className="border border-border rounded-lg p-5 bg-muted/10">
            <h3 className="font-semibold text-sm mb-4">
              Dados Principais da Obra
            </h3>
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Código ABRAMUS — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Código ABRAMUS
                </span>
                <Input
                  className="h-9 px-2 text-sm min-w-0"
                  value={codAbramus}
                  onChange={(e) => setCodAbramus(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* Código ECAD — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Código ECAD
                </span>
                <Input
                  className="h-9 px-2 text-sm min-w-0"
                  value={codEcad}
                  onChange={(e) => setCodEcad(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* ISWC — col-span-3 | Row 1 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  ISWC
                </span>
                <Input
                  className="h-9 px-2 text-sm min-w-0"
                  value={iswc}
                  onChange={(e) => setIswc(e.target.value)}
                  disabled={isViewMode}
                  placeholder="T-123.456.789-0"
                />
              </div>

              {/* Título da Obra — col-span-3 | Row 1 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Título da Obra *
                </span>
                <Input
                  className="h-9 px-2 text-sm min-w-0"
                  value={tituloObra}
                  onChange={(e) => setTituloObra(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* Gênero Musical — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Gênero Musical
                </span>
                <Select
                  value={generoMusical}
                  onValueChange={setGeneroMusical}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {generosMusicais.map((g) => (
                      <SelectItem key={g} value={g.toLowerCase()}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Idioma — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Idioma
                </span>
                <Select
                  value={idioma}
                  onValueChange={setIdioma}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {idiomas.map((i) => (
                      <SelectItem key={i} value={i.toLowerCase()}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duração — col-span-3 | Row 2 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Duração
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-9 w-12 min-w-0 text-center px-2 text-sm ${duracaoMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    min
                  </span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-9 w-12 min-w-0 text-center px-2 text-sm ${duracaoSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoSeg}
                    onChange={(e) => setDuracaoSeg(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    seg
                  </span>
                </div>
                {(duracaoMinError || duracaoSegError) && (
                  <p className="text-xs text-destructive">
                    {duracaoMinError || duracaoSegError}
                  </p>
                )}
              </div>

              {/* Instrumental — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Instrumental?
                </span>
                <div className="flex items-center h-9">
                  <Switch
                    checked={instrumental === "sim"}
                    onCheckedChange={(v) => setInstrumental(v ? "sim" : "nao")}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Criada por IA — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Criada por IA?
                </span>
                <div className="flex items-center h-9">
                  <Switch
                    checked={criadaPorIA === "sim"}
                    onCheckedChange={(v) => setCriadaPorIA(v ? "sim" : "nao")}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Situação — col-span-3 | Row 2 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Situação
                </span>
                <Select
                  value={situacao}
                  onValueChange={setSituacao}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {situacoes.map((s) => (
                      <SelectItem
                        key={s}
                        value={s.toLowerCase().replace(/ /g, "_")}
                      >
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Criado por IA Generativa - Condicional */}
          {criadaPorIA === "sim" && (
            <div className="border border-border rounded-lg p-6 space-y-5 bg-muted/10">
              <h3 className="font-semibold">Criado por IA Generativa</h3>

              <RadioGroup
                value={tipoIA}
                onValueChange={setTipoIA}
                className="flex gap-6"
                disabled={isViewMode}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="totalmente"
                    id="ia_total"
                    className="border-red-500 text-red-500"
                  />
                  <label htmlFor="ia_total" className="text-sm">
                    A obra foi totalmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parcialmente" id="ia_parcial" />
                  <label htmlFor="ia_parcial" className="text-sm">
                    A obra foi parcialmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
              </RadioGroup>

              {tipoIA && (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Elementos da obra musical criados por inteligência
                    artificial generativa:
                  </p>

                  {/* Harmonia */}
                  <div className="space-y-2">
                    <Label className="font-semibold">HARMONIA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaHarmonia.ferramenta}
                          onChange={(e) =>
                            setIaHarmonia({
                              ...iaHarmonia,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaHarmonia.prompt}
                            onChange={(e) =>
                              setIaHarmonia({
                                ...iaHarmonia,
                                prompt: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaHarmonia({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Melodia */}
                  <div className="space-y-2">
                    <Label className="font-semibold">MELODIA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaMelodia.ferramenta}
                          onChange={(e) =>
                            setIaMelodia({
                              ...iaMelodia,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaMelodia.prompt}
                            onChange={(e) =>
                              setIaMelodia({
                                ...iaMelodia,
                                prompt: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaMelodia({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Letra */}
                  <div className="space-y-2">
                    <Label className="font-semibold">LETRA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaLetra.ferramenta}
                          onChange={(e) =>
                            setIaLetra({
                              ...iaLetra,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaLetra.prompt}
                            onChange={(e) =>
                              setIaLetra({ ...iaLetra, prompt: e.target.value })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaLetra({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participação */}
          <Collapsible
            open={participacaoOpen}
            onOpenChange={setParticipacaoOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Participação</span>
                  <span className="text-sm text-muted-foreground">
                    Percentual total: {calcularPercentualTotal().toFixed(2)}% de
                    100%
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${participacaoOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isViewMode}
                  >
                    <Search className="w-4 h-4 mr-1" /> Buscar participante
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addParticipante}
                    disabled={isViewMode}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar participante
                  </Button>
                </div>

                {participantes.length > 0 ? (
                  <div className="space-y-3">
                    {participantes.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 gap-3 items-end"
                      >
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Nome *</Label>
                          <Input
                            value={p.nome}
                            onChange={(e) =>
                              updateParticipante(p.id, "nome", e.target.value)
                            }
                            disabled={isViewMode}
                            placeholder="Nome do participante"
                            className="min-w-0"
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Classe/Função *</Label>
                          <Select
                            value={p.classeFuncao}
                            onValueChange={(v) =>
                              updateParticipante(p.id, "classeFuncao", v)
                            }
                            disabled={isViewMode}
                          >
                            <SelectTrigger className="min-w-0">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {classesFuncao.map((c) => (
                                <SelectItem key={c} value={c.toLowerCase()}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Link</Label>
                          <Input
                            value={p.link}
                            onChange={(e) =>
                              updateParticipante(p.id, "link", e.target.value)
                            }
                            disabled={isViewMode}
                            placeholder="Link 1"
                            className="min-w-0"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">% Part. *</Label>
                          <Input
                            value={p.percentual}
                            onChange={(e) =>
                              updateParticipante(
                                p.id,
                                "percentual",
                                e.target.value,
                              )
                            }
                            disabled={isViewMode}
                            placeholder="100"
                            type="number"
                            className="min-w-0"
                          />
                        </div>
                        <div className="col-span-1 flex items-end justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParticipante(p.id)}
                            disabled={isViewMode}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum participante adicionado.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Outros Títulos */}
          <Collapsible
            open={outrosTitulosOpen}
            onOpenChange={setOutrosTitulosOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <span className="font-semibold">Outros Títulos</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addOutroTitulo();
                    }}
                    disabled={isViewMode}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${outrosTitulosOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {outrosTitulos.length > 0 ? (
                  outrosTitulos.map((titulo, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={titulo}
                        onChange={(e) =>
                          updateOutroTitulo(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="Título alternativo"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOutroTitulo(index)}
                        disabled={isViewMode}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum título alternativo adicionado.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Referência Conexa */}
          <Collapsible open={referenciasOpen} onOpenChange={setReferenciasOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <span className="font-semibold">Referência Conexa</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addReferenciaConexas();
                    }}
                    disabled={isViewMode}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${referenciasOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {referenciasConexas.length > 0 ? (
                  referenciasConexas.map((ref, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={ref}
                        onChange={(e) =>
                          updateReferenciaConexas(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="URL ou referência"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeReferenciaConexas(index)}
                        disabled={isViewMode}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma referência conexa adicionada.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Letra da Música */}
          <Collapsible open={letraOpen} onOpenChange={setLetraOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <span className="font-semibold">Letra da Música</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${letraOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                <Label>Letra Completa</Label>
                <Textarea
                  value={letraCompleta}
                  onChange={(e) => setLetraCompleta(e.target.value)}
                  disabled={isViewMode}
                  rows={6}
                  placeholder="Digite a letra completa da música aqui..."
                />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Termos de Uso */}
          {!isViewMode && (
            <div className="flex items-center gap-2 p-4 bg-muted/10 rounded-lg border border-border">
              <Checkbox
                id="termos"
                checked={aceitaTermos}
                onCheckedChange={(checked) =>
                  setAceitaTermos(checked as boolean)
                }
                className="border-red-500 data-[state=checked]:bg-red-500"
              />
              <label htmlFor="termos" className="text-sm">
                Aceito o Termo -{" "}
                <a href="#" className="text-red-500 hover:underline">
                  Leia e aceite os Termos de Uso
                </a>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={hasDuracaoError || addObra.isPending || updateObra.isPending}
                data-testid="button-submit-obra"
              >
                {addObra.isPending || updateObra.isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Criar Obra"
                    : "Atualizar Obra"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
