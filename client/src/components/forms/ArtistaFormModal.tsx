import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { FileUpload, type UploadedFile } from "@/components/shared/FileUpload";
import { type TipoArtista, type StatusArtista } from "./ArtistaForm";
import { useArtistas, type Artista } from "@/hooks/useArtistas";
import { useClientes } from "@/hooks/useClientes";
import { useContratos } from "@/hooks/useContratos";
import { toast } from "sonner";

type TipoPerfil = "independente" | "com_empresario" | "gravadora" | "editora";

const GENEROS_MUSICAIS = [
  "Funk", "Forró", "Sertanejo", "Pop", "Rock", "MPB", "Eletrônica",
  "Hip Hop", "R&B", "Axé", "Pagode", "Gospel", "Reggae", "Jazz", "Outro",
];

const BANCOS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica", "Itaú", "Santander",
  "Nubank", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Outro",
];

const DISTRIBUIDORAS = [
  { id: "onerpm", label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "tunecore", label: "TuneCore" },
  { id: "cdbaby", label: "CD Baby" },
  { id: "believe", label: "Believe" },
  { id: "amuse", label: "Amuse" },
  { id: "landr", label: "LANDR" },
  { id: "routenote", label: "RouteNote" },
];

// =============================================================================
// Extratores de ID (Task #354): aceitam URL pública OU o próprio ID cru,
// para que cole/edite seja resiliente. Retornam null quando o input não
// reconhece nada de útil.
// =============================================================================
function extractSpotifyArtistId(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  // ID puro: 22 caracteres base62 (formato típico do Spotify).
  if (/^[A-Za-z0-9]{22}$/.test(v)) return v;
  // URL: https://open.spotify.com/artist/{id} ou variações com query/locale.
  const m = v.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]{10,})/i);
  return m?.[1] ?? null;
}

function extractYoutubeChannelId(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  // ID puro começa com UC e tem 24 caracteres no total.
  if (/^UC[A-Za-z0-9_-]{22}$/.test(v)) return v;
  const m = v.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  return m?.[1] ?? null;
}

const ESPECIALIDADES = [
  { value: "dj", label: "DJ" },
  { value: "dj_produtor", label: "DJ/Produtor" },
  { value: "compositor_autor", label: "Compositor/Autor" },
  { value: "interprete", label: "Intérprete" },
  { value: "produtor", label: "Produtor" },
];

interface ArtistaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  artista?: Artista | null;
}

export function ArtistaFormModal({ open, onOpenChange, onSuccess, artista }: ArtistaFormModalProps) {
  const isEditing = !!artista;
  const { artistas, addArtista, updateArtista } = useArtistas();
  const { clientes, addCliente } = useClientes();
  const { contratos } = useContratos();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 1. Informações Básicas ─────────────────────────────────────
  const [imagemArtista, setImagemArtista] = useState<UploadedFile[]>([]);
  const [nomeArtistico, setNomeArtistico] = useState("");
  const [generoMusical, setGeneroMusical] = useState("");
  const [tipoArtistaTabela, setTipoArtistaTabela] = useState<TipoArtista>("artista_solo");
  const [statusArtistaTabela, setStatusArtistaTabela] = useState<StatusArtista>("contratado");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [documentosPessoais, setDocumentosPessoais] = useState<UploadedFile[]>([]);
  const [presskit, setPresskit] = useState<UploadedFile[]>([]);
  const [biografia, setBiografia] = useState("");

  // ── 2. Dados Pessoais ──────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [rg, setRg] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // ── 3. Dados Bancários ─────────────────────────────────────────
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [titularConta, setTitularConta] = useState("");

  // ── 4. Redes Sociais ───────────────────────────────────────────
  // Os campos de URL abaixo alimentam tanto a exibição quanto as
  // Edge Functions de métricas (Task #340/#354): extraímos o ID do
  // artista a partir da URL pública para não pedir dois campos ao usuário.
  const [spotify, setSpotify] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [deezer, setDeezer] = useState("");
  const [appleMusic, setAppleMusic] = useState("");

  // ── 5. Tipo de Perfil ──────────────────────────────────────────
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("independente");
  const [empresarioId, setEmpresarioId] = useState("");
  const [empresarioNome, setEmpresarioNome] = useState("");
  const [empresarioTelefone, setEmpresarioTelefone] = useState("");
  const [empresarioEmail, setEmpresarioEmail] = useState("");
  const [gravadoraId, setGravadoraId] = useState("");
  const [gravadoraNome, setGravadoraNome] = useState("");
  const [gravadoraTelefone, setGravadoraTelefone] = useState("");
  const [gravadoraEmail, setGravadoraEmail] = useState("");
  const [gravadoraResponsavelId, setGravadoraResponsavelId] = useState("");
  const [gravadoraResponsavelNome, setGravadoraResponsavelNome] = useState("");
  const [gravadoraResponsavelTelefone, setGravadoraResponsavelTelefone] = useState("");
  const [gravadoraResponsavelEmail, setGravadoraResponsavelEmail] = useState("");

  // ── 6. Distribuidoras ──────────────────────────────────────────
  const [distribuidorasSelecionadas, setDistribuidorasSelecionadas] = useState<Record<string, boolean>>({});
  const [distribuidorasEmails, setDistribuidorasEmails] = useState<Record<string, string>>({});

  // ── Contrato vinculado ─────────────────────────────────────────
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState("");

  const contatosCRM = clientes.filter((c) => c.tipo_pessoa === "pessoa_fisica" || c.tipo_pessoa === "pessoa_juridica");
  const gravadorasCRM = clientes.filter((c: any) => c.tipo_pessoa === "pessoa_juridica");
  const pessoasFisicasCRM = clientes.filter((c: any) => c.tipo_pessoa === "pessoa_fisica");
  const contratosDisponiveis = contratos.filter((c: any) => (c.status === "ativo" || c.status === "vencendo") && !c.artista_id);

  const resetForm = () => {
    setImagemArtista([]); setNomeArtistico(""); setGeneroMusical("");
    setTipoArtistaTabela("artista_solo"); setStatusArtistaTabela("contratado");
    setEspecialidades([]); setDocumentosPessoais([]); setPresskit([]); setBiografia("");
    setNome(""); setDataNascimento(""); setCpfCnpj(""); setRg("");
    setEndereco(""); setTelefone(""); setEmail("");
    setBanco(""); setAgencia(""); setConta(""); setChavePix(""); setTitularConta("");
    setSpotify(""); setInstagram(""); setYoutube(""); setTiktok("");
    setSoundcloud(""); setDeezer(""); setAppleMusic("");
    setTipoPerfil("independente");
    setEmpresarioId(""); setEmpresarioNome(""); setEmpresarioTelefone(""); setEmpresarioEmail("");
    setGravadoraId(""); setGravadoraNome(""); setGravadoraTelefone(""); setGravadoraEmail("");
    setGravadoraResponsavelId(""); setGravadoraResponsavelNome("");
    setGravadoraResponsavelTelefone(""); setGravadoraResponsavelEmail("");
    setDistribuidorasSelecionadas({}); setDistribuidorasEmails({});
    setContratoSelecionadoId("");
  };

  useEffect(() => {
    if (open) {
      if (artista) {
        setNomeArtistico(artista.nome_artistico ?? "");
        setNome(artista.nome_civil ?? "");
        setCpfCnpj(artista.cpf_cnpj ?? "");
        setEmail(artista.email ?? "");
        setTelefone(artista.telefone ?? "");
        setGeneroMusical(artista.genero_musical ?? "");
        setTipoArtistaTabela((artista.tipo as TipoArtista) ?? "artista_solo");
        setStatusArtistaTabela((artista.status as StatusArtista) ?? "contratado");
        setBiografia(artista.observacoes ?? "");
        // Reconstrói as URLs públicas a partir dos IDs salvos — assim
        // o usuário sempre vê e edita um link, nunca o ID cru.
        setSpotify(
          artista.spotify_artist_id
            ? `https://open.spotify.com/artist/${artista.spotify_artist_id}`
            : "",
        );
        setYoutube(
          artista.youtube_channel_id
            ? `https://www.youtube.com/channel/${artista.youtube_channel_id}`
            : "",
        );
        setDeezer(artista.deezer_url ?? "");
        setAppleMusic(artista.apple_music_url ?? "");
        setSoundcloud(artista.soundcloud_url ?? "");
        if (artista.foto_url) setImagemArtista([{ url: artista.foto_url, name: "foto", size: 0, type: "image/*" }]);
      } else {
        resetForm();
      }
    }
  }, [open, artista]);

  const handleEmpresarioSelect = (id: string) => {
    const c = contatosCRM.find((x) => x.id === id);
    if (c) {
      setEmpresarioId(id);
      setEmpresarioNome(c.nome);
      setEmpresarioTelefone(c.telefone ?? "");
      setEmpresarioEmail(c.email ?? "");
    }
  };

  const handleGravadoraSelect = (id: string) => {
    const c = gravadorasCRM.find((x) => x.id === id);
    if (c) {
      setGravadoraId(id);
      setGravadoraNome(c.nome);
      setGravadoraTelefone(c.telefone ?? "");
      setGravadoraEmail(c.email ?? "");
    }
  };

  const handleResponsavelGravadoraSelect = (id: string) => {
    const c = pessoasFisicasCRM.find((x) => x.id === id);
    if (c) {
      setGravadoraResponsavelId(id);
      setGravadoraResponsavelNome(c.nome);
      setGravadoraResponsavelTelefone(c.telefone ?? "");
      setGravadoraResponsavelEmail(c.email ?? "");
    }
  };

  const handleDistribuidoraToggle = (id: string) => {
    setDistribuidorasSelecionadas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDistribuidoraEmailChange = (id: string, val: string) => {
    setDistribuidorasEmails((prev) => ({ ...prev, [id]: val }));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!nomeArtistico.trim()) { toast.error("Nome artístico é obrigatório"); return; }
    if (!nome.trim()) { toast.error("Nome completo é obrigatório"); return; }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateArtista.mutateAsync({
          id: artista.id,
          nome_artistico: nomeArtistico.trim(),
          nome_civil: nome.trim() || null,
          tipo: tipoArtistaTabela,
          status: statusArtistaTabela,
          genero_musical: generoMusical || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          cpf_cnpj: cpfCnpj.trim() || null,
          foto_url: imagemArtista[0]?.url || null,
          observacoes: biografia.trim() || null,
          spotify_artist_id: extractSpotifyArtistId(spotify),
          youtube_channel_id: extractYoutubeChannelId(youtube),
          deezer_url: deezer.trim() || null,
          apple_music_url: appleMusic.trim() || null,
          soundcloud_url: soundcloud.trim() || null,
        });
      } else {
        const clienteData = {
          tipo_pessoa: "pessoa_fisica" as const,
          nome: nomeArtistico.trim(),
          cpf_cnpj: cpfCnpj.trim() || null,
          responsavel: nome.trim() || null,
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          endereco: endereco.trim() || null,
          cidade: null as string | null,
          estado: null as string | null,
          observacoes: biografia.trim() || null,
          status: "ativo",
        };
        await addCliente.mutateAsync(clienteData);
        await addArtista.mutateAsync({
          nome_artistico: nomeArtistico.trim(),
          nome_civil: nome.trim() || null,
          tipo: tipoArtistaTabela,
          status: statusArtistaTabela,
          genero_musical: generoMusical || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          cpf_cnpj: cpfCnpj.trim() || null,
          foto_url: imagemArtista[0]?.url || null,
          observacoes: biografia.trim() || null,
          contrato_id: contratoSelecionadoId || null,
          spotify_artist_id: extractSpotifyArtistId(spotify),
          youtube_channel_id: extractYoutubeChannelId(youtube),
          deezer_url: deezer.trim() || null,
          apple_music_url: appleMusic.trim() || null,
          soundcloud_url: soundcloud.trim() || null,
        });
      }
      handleClose(false);
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditing ? "Editar Artista" : "Novo Artista"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do artista." : "Preencha os dados do artista."}
            {" "}Campos com <span className="text-destructive">*</span> são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-8">

            {/* ═══ 1. Informações Básicas ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">1.</span>
                <h3 className="text-lg font-semibold">Informações Básicas</h3>
              </div>
              <Separator />

              <div className="space-y-2">
                <Label>Imagem do Artista</Label>
                <FileUpload
                  folder="artistas/fotos"
                  accept="image/*"
                  maxSize={5}
                  circular
                  value={imagemArtista}
                  onChange={setImagemArtista}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Artístico <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Nome usado profissionalmente"
                    value={nomeArtistico}
                    onChange={(e) => setNomeArtistico(e.target.value)}
                    data-testid="input-nome-artistico"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gênero Musical <span className="text-destructive">*</span></Label>
                  <Select value={generoMusical} onValueChange={setGeneroMusical}>
                    <SelectTrigger data-testid="select-genero">
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {GENEROS_MUSICAIS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo <span className="text-destructive">*</span></Label>
                  <Select value={tipoArtistaTabela} onValueChange={(v) => setTipoArtistaTabela(v as TipoArtista)}>
                    <SelectTrigger data-testid="select-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="artista_solo">Artista Solo</SelectItem>
                      <SelectItem value="banda">Banda</SelectItem>
                      <SelectItem value="projeto_artistico">Projeto Artístico</SelectItem>
                      <SelectItem value="coletivo">Coletivo</SelectItem>
                      <SelectItem value="produtor">Produtor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status <span className="text-destructive">*</span></Label>
                  <Select value={statusArtistaTabela} onValueChange={(v) => setStatusArtistaTabela(v as StatusArtista)}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="contratado">Contratado</SelectItem>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                      <SelectItem value="independente">Independente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Especialidade / Função</Label>
                <div className="flex flex-wrap gap-4">
                  {ESPECIALIDADES.map((esp) => (
                    <div key={esp.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`esp-${esp.value}`}
                        checked={especialidades.includes(esp.value)}
                        onCheckedChange={(checked) => {
                          if (checked) setEspecialidades((p) => [...p, esp.value]);
                          else setEspecialidades((p) => p.filter((x) => x !== esp.value));
                        }}
                      />
                      <Label htmlFor={`esp-${esp.value}`} className="cursor-pointer">{esp.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Documentos Pessoais (PDF)</Label>
                <FileUpload
                  folder="artistas/documentos"
                  accept="application/pdf"
                  maxSize={5}
                  value={documentosPessoais}
                  onChange={setDocumentosPessoais}
                />
              </div>

              <div className="space-y-2">
                <Label>Presskit / Media Kit</Label>
                <FileUpload
                  folder="artistas/presskit"
                  accept="application/pdf,.zip"
                  maxSize={10}
                  value={presskit}
                  onChange={setPresskit}
                />
              </div>

              <div className="space-y-2">
                <Label>Biografia</Label>
                <Textarea
                  placeholder="Escreva uma breve biografia do artista, incluindo sua trajetória, conquistas e estilo musical..."
                  value={biografia}
                  onChange={(e) => setBiografia(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="textarea-biografia"
                />
              </div>
            </div>

            {/* ═══ 2. Dados Pessoais ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">2.</span>
                <h3 className="text-lg font-semibold">Dados Pessoais</h3>
              </div>
              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Nome completo conforme documento"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    data-testid="input-nome-civil"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    data-testid="input-data-nascimento"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF / CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    data-testid="input-cpf-cnpj"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input
                    placeholder="00.000.000-0"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    data-testid="input-rg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endereço Completo</Label>
                <Input
                  placeholder="Rua, número, bairro, cidade, estado, CEP"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  data-testid="input-endereco"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    data-testid="input-telefone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Contato</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                  />
                </div>
              </div>
            </div>

            {/* ═══ 3. Dados Bancários ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">3.</span>
                <h3 className="text-lg font-semibold">Dados Bancários</h3>
              </div>
              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Select value={banco} onValueChange={setBanco}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {BANCOS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input placeholder="0000" value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conta com Dígito</Label>
                  <Input placeholder="00000-0" value={conta} onChange={(e) => setConta(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chave Pix</Label>
                  <Input placeholder="CPF, e-mail, telefone ou chave aleatória" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Titular da Conta</Label>
                <Input placeholder="Nome completo do titular da conta" value={titularConta} onChange={(e) => setTitularConta(e.target.value)} />
              </div>
            </div>

            {/* ═══ 4. Perfis e Redes Sociais ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">4.</span>
                <h3 className="text-lg font-semibold">Perfis e Redes Sociais</h3>
              </div>
              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Perfil Spotify</Label>
                  <Input
                    placeholder="https://open.spotify.com/artist/..."
                    value={spotify}
                    onChange={(e) => setSpotify(e.target.value)}
                    data-testid="input-spotify-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input placeholder="https://instagram.com/perfil" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <Input
                    placeholder="https://youtube.com/channel/UC..."
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    data-testid="input-youtube-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>TikTok</Label>
                  <Input placeholder="https://tiktok.com/@perfil" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SoundCloud</Label>
                  <Input placeholder="https://soundcloud.com/perfil" value={soundcloud} onChange={(e) => setSoundcloud(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Deezer</Label>
                  <Input placeholder="https://deezer.com/artist/..." value={deezer} onChange={(e) => setDeezer(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Apple Music</Label>
                <Input placeholder="https://music.apple.com/artist/..." value={appleMusic} onChange={(e) => setAppleMusic(e.target.value)} />
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                Cole as URLs públicas dos perfis. O sistema extrai automaticamente
                os identificadores do Spotify e YouTube para buscar métricas
                reais (seguidores, inscritos e visualizações).
              </p>
            </div>

            {/* ═══ 5. Tipo de Perfil ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">5.</span>
                <h3 className="text-lg font-semibold">Tipo de Perfil</h3>
              </div>
              <Separator />

              <div className="space-y-2">
                <Label>Tipo de Perfil</Label>
                <Select value={tipoPerfil} onValueChange={(v) => setTipoPerfil(v as TipoPerfil)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="independente">Independente</SelectItem>
                    <SelectItem value="com_empresario">Com Empresário</SelectItem>
                    <SelectItem value="gravadora">Gravadora</SelectItem>
                    <SelectItem value="editora">Editora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoPerfil === "com_empresario" && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                  <h4 className="font-medium">Dados do Empresário</h4>
                  <div className="space-y-2">
                    <Label>Nome (buscar no CRM)</Label>
                    <Select value={empresarioId} onValueChange={handleEmpresarioSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contato do CRM" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        {contatosCRM.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefone / WhatsApp</Label>
                      <Input placeholder="(00) 00000-0000" value={empresarioTelefone} onChange={(e) => setEmpresarioTelefone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="email@exemplo.com" value={empresarioEmail} onChange={(e) => setEmpresarioEmail(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {(tipoPerfil === "gravadora" || tipoPerfil === "editora") && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                  <h4 className="font-medium">Dados da {tipoPerfil === "gravadora" ? "Gravadora" : "Editora"}</h4>
                  <div className="space-y-2">
                    <Label>Nome (buscar no CRM)</Label>
                    <Select value={gravadoraId || "none"} onValueChange={(v) => v === "none" ? setGravadoraId("") : handleGravadoraSelect(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione uma ${tipoPerfil === "gravadora" ? "gravadora" : "editora"} do CRM`} />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="none">Selecione...</SelectItem>
                        {gravadorasCRM.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input placeholder="(00) 00000-0000" value={gravadoraTelefone} onChange={(e) => setGravadoraTelefone(e.target.value)} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="email@exemplo.com" value={gravadoraEmail} onChange={(e) => setGravadoraEmail(e.target.value)} disabled />
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <h4 className="font-medium">Responsável pelo Contato</h4>
                  <div className="space-y-2">
                    <Label>Nome do Responsável (buscar no CRM)</Label>
                    <Select
                      value={gravadoraResponsavelId || "none"}
                      onValueChange={(v) => v === "none" ? setGravadoraResponsavelId("") : handleResponsavelGravadoraSelect(v)}
                      disabled={!gravadoraId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={gravadoraId ? "Selecione um responsável" : "Selecione uma gravadora primeiro"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="none">Selecione...</SelectItem>
                        {pessoasFisicasCRM.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input placeholder="(00) 00000-0000" value={gravadoraResponsavelTelefone} onChange={(e) => setGravadoraResponsavelTelefone(e.target.value)} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="email@exemplo.com" value={gravadoraResponsavelEmail} onChange={(e) => setGravadoraResponsavelEmail(e.target.value)} disabled />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ 6. Distribuidora / Agregadora ═══ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">6.</span>
                <h3 className="text-lg font-semibold">Distribuidora / Agregadora</h3>
              </div>
              <Separator />

              <div className="space-y-2">
                <Label>Selecione as distribuidoras</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DISTRIBUIDORAS.map((dist) => (
                    <div key={dist.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dist-${dist.id}`}
                        checked={distribuidorasSelecionadas[dist.id] || false}
                        onCheckedChange={() => handleDistribuidoraToggle(dist.id)}
                      />
                      <Label htmlFor={`dist-${dist.id}`} className="cursor-pointer text-sm">{dist.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {Object.entries(distribuidorasSelecionadas).filter(([, selected]) => selected).map(([id]) => {
                const dist = DISTRIBUIDORAS.find((d) => d.id === id);
                if (!dist) return null;
                return (
                  <div key={id} className="space-y-2">
                    <Label>Email {dist.label}</Label>
                    <Input
                      type="email"
                      placeholder={`Email cadastrado na ${dist.label}`}
                      value={distribuidorasEmails[id] || ""}
                      onChange={(e) => handleDistribuidoraEmailChange(id, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>

            {/* ═══ Contrato Vinculado ═══ */}
            {!isEditing && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-primary">7.</span>
                  <h3 className="text-lg font-semibold">Contrato Vinculado</h3>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Vincular a um contrato existente (opcional)</Label>
                  <Select value={contratoSelecionadoId || "none"} onValueChange={(v) => setContratoSelecionadoId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contrato (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contratosDisponiveis.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.titulo || c.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            data-testid="button-cancelar-modal"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
            data-testid="button-salvar-modal"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Artista"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
