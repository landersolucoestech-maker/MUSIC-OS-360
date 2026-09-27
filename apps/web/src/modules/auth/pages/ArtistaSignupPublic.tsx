import { useState, useEffect } from "react";
import { MUSICAL_GENRE_LABELS } from "@/constants/musicalGenres";
import { useParams } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Loader2, CheckCircle2, ChevronRight, ChevronLeft,
  AlertCircle, Shield, Zap, Star, Plus, X, CheckCircle, XCircle,
  User, Link2, FileText, CreditCard, Globe, Building, Users, Camera, Trash2,
} from "lucide-react";
import { SiSpotify, SiTiktok, SiApplemusic, SiSoundcloud } from "react-icons/si";
import {
  SPECIALTY_LABELS,
  validateSpotifyUrl,
  validateYoutubeUrl,
  validateInstagramUrl,
  validateTiktokUrl,
  validateSoundcloudUrl,
  validateDeezerUrl,
  validateAppleMusicUrl,
  type UrlValidationState,
} from "@/modules/artist/mappers";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { publicApi } from "@/shared/lib/api-client";
import { CompanyLogo } from "@/shared/ui/company-logo";
import { companyLogoService } from "@/modules/settings/services/company-logo.service";
import { useArtists } from "@/modules/artist/hooks/useArtists";

// ─── Same constants as ArtistaFormModal ───────────────────────────────────────

const MUSIC_GENRES = MUSICAL_GENRE_LABELS;

const BANCOS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica", "Itaú", "Santander",
  "Nubank", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Outro",
];

const PROFILE_TYPE_OPTIONS = [
  { value: "independente",   label: "Independente" },
  { value: "com_empresario", label: "Com empresário" },
];

const TEAM_CATEGORIES = [
  { value: "booker",          label: "Booker" },
  { value: "assessoria",      label: "Assessoria de Imprensa" },
  { value: "juridico",        label: "Jurídico" },
  { value: "financeiro",      label: "Financeiro" },
  { value: "contador",        label: "Contador" },
  { value: "editora_musical", label: "Editora Musical" },
  { value: "roadie",          label: "Roadie" },
];

const DISTRIBUTORS_OPTIONS = [
  { id: "onerpm",    label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "30por1",    label: "30 Por 1" },
  { id: "symphonic", label: "Symphonic" },
  { id: "musicpro",  label: "MusicPro" },
  { id: "somvibe",   label: "Somvibe" },
  { id: "outros",    label: "Outros" },
];

const ESPECIALIDADES = Object.entries(SPECIALTY_LABELS).map(([value, label]) => ({ value, label }));

// ─── Types (same as ArtistaFormModal) ─────────────────────────────────────────

interface DistributorEntry {
  id: string;
  email: string;
  nomeCustom?: string;
}

interface TeamContact {
  nome: string;
  categoria: string;
  telefone: string;
  email: string;
  distribuidoras: DistributorEntry[];
}

const EMPTY_CONTACT: TeamContact = {
  nome: "", categoria: "", telefone: "", email: "", distribuidoras: [],
};

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Informações Básicas",  icon: User },
  { num: 2, label: "Dados Pessoais",       icon: FileText },
  { num: 3, label: "Dados Bancários",      icon: CreditCard },
  { num: 4, label: "Redes Sociais",        icon: Link2 },
  { num: 5, label: "Distribuidoras",       icon: Globe },
  { num: 6, label: "Tipo de Perfil",       icon: Building },
  { num: 7, label: "Observações",          icon: Users },
] as const;

type StepNum = (typeof STEPS)[number]["num"];

// ─── OrgInfo ──────────────────────────────────────────────────────────────────

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  allowPublicRegistration: boolean;
  logoUrl?: string | null;
}
type SlugState = "checking" | "valid" | "invalid";

// ─── URL icon helper (same as ArtistaFormModal) ───────────────────────────────

function UrlIcon({ state }: { state: UrlValidationState }) {
  if (state === "valid")   return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  if (state === "invalid") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArtistSignupPublic() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const { addArtist } = useArtists();

  const [slugState, setSlugState] = useState<SlugState>("checking");
  const [orgInfo, setOrgInfo]     = useState<OrgInfo>({ id: "", name: "MUSIC OS 360", slug: orgSlug ?? "", allowPublicRegistration: false });
  const [step, setStep]           = useState<StepNum>(1);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);
  const [protocol, setProtocol]   = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [companyWebsite, setCompanyWebsite] = useState("");

  // ── Form state — mirrors ArtistaFormModal fields ───────────────────────────
  // Step 1: Basic information
  const [stageName, setStageName]   = useState("");
  const [musicGenre, setMusicGenre]   = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [biografia, setBiografia]           = useState("");
  const [fotoUrl, setFotoUrl]               = useState("");
  const [personalDocumentsUrl, setPersonalDocumentsUrl] = useState("");
  const [presskitUrl, setPresskitUrl]       = useState("");

  // Step 2: Personal data
  const [name, setName]               = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpfCnpj, setCpfCnpj]         = useState("");
  const [rg, setRg]                   = useState("");
  const [genre, setGenre]           = useState("");
  const [address, setAddress]       = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]             = useState("");

  // Step 3: Bank details
  const [banco, setBanco]             = useState("");
  const [agencia, setAgencia]         = useState("");
  const [account, setAccount]             = useState("");
  const [pixKey, setPixKey]       = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // Step 4: Social networks
  const [spotify, setSpotify]         = useState("");
  const [instagram, setInstagram]     = useState("");
  const [youtube, setYoutube]         = useState("");
  const [tiktok, setTiktok]           = useState("");
  const [soundcloud, setSoundcloud]   = useState("");
  const [deezer, setDeezer]           = useState("");
  const [appleMusic, setAppleMusic]   = useState("");

  // Step 5: Distributors / aggregators
  const [generalDistributors, setGeneralDistributors] = useState<DistributorEntry[]>([]);

  // Step 6: Profile type + team
  const [profileType, setProfileType]       = useState("independente");
  const [teamContacts, setTeamContacts] = useState<TeamContact[]>([{ ...EMPTY_CONTACT }]);

  // Step 7: Notes
  const [internalNotes, setInternalNotes] = useState("");

  // ── Slug validation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgSlug) { setSlugState("invalid"); return; }
    let cancelled = false;
    publicApi
      .get<OrgInfo>(`/public/workspaces/${encodeURIComponent(orgSlug)}`)
      .then((info) => {
        if (cancelled) return;
        setOrgInfo(info);
        setSlugState("valid");
      })
      .catch(() => {
        if (!cancelled) setSlugState("invalid");
      });
    return () => { cancelled = true; };
  }, [orgSlug]);

  // ── Ensure at least one empty equipe card when perfil changes ─────────────
  useEffect(() => {
    const PROFILES_WITH_TEAM = ["independente", "com_empresario"];
    if (PROFILES_WITH_TEAM.includes(profileType) && teamContacts.length === 0) {
      setTeamContacts([{ ...EMPTY_CONTACT }]);
    }
  }, [profileType]);

  // ── URL validation states (same as ArtistaFormModal) ──────────────────────
  const urlStates = {
    spotify:    validateSpotifyUrl(spotify),
    instagram:  validateInstagramUrl(instagram),
    youtube:    validateYoutubeUrl(youtube),
    tiktok:     validateTiktokUrl(tiktok),
    soundcloud: validateSoundcloudUrl(soundcloud),
    deezer:     validateDeezerUrl(deezer),
    appleMusic: validateAppleMusicUrl(appleMusic),
  };

  // ── Especialidades toggle ──────────────────────────────────────────────────
  const toggleEspecialidade = (value: string, checked: boolean) => {
    setEspecialidades((prev) =>
      checked ? [...prev, value] : prev.filter((x) => x !== value)
    );
  };

  // ── General distributor helpers (same as ArtistaFormModal) ──────────────
  const toggleDistGeneral = (distId: string, checked: boolean) => {
    if (checked) {
      setGeneralDistributors((prev) => [
        ...prev,
        { id: distId, email: "", nomeCustom: distId === "outros" ? "" : undefined },
      ]);
    } else {
      setGeneralDistributors((prev) => prev.filter((d) => d.id !== distId));
    }
  };

  const updateDistGeneralEmail = (distId: string, email: string) => {
    setGeneralDistributors((prev) =>
      prev.map((d) => (d.id === distId ? { ...d, email } : d))
    );
  };

  const updateDistGeneralCustomName = (customName: string) => {
    setGeneralDistributors((prev) =>
      prev.map((d) => (d.id === "outros" ? { ...d, nomeCustom: customName } : d))
    );
  };

  // ── Equipe helpers (same as ArtistaFormModal) ──────────────────────────────
  const addContact = () => setTeamContacts((prev) => [...prev, { ...EMPTY_CONTACT }]);

  const removeContact = (idx: number) =>
    setTeamContacts((prev) => prev.filter((_, i) => i !== idx));

  const updateContact = (idx: number, field: keyof TeamContact, value: unknown) =>
    setTeamContacts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );

  const toggleDistTeam = (contactIdx: number, distId: string, checked: boolean) => {
    setTeamContacts((prev) =>
      prev.map((c, i) => {
        if (i !== contactIdx) return c;
        if (checked) {
          return {
            ...c,
            distribuidoras: [
              ...c.distribuidoras,
              { id: distId, email: "", nomeCustom: distId === "outros" ? "" : undefined },
            ],
          };
        }
        return { ...c, distribuidoras: c.distribuidoras.filter((d) => d.id !== distId) };
      })
    );
  };

  const updateDistTeamEmail = (contactIdx: number, distId: string, email: string) => {
    setTeamContacts((prev) =>
      prev.map((c, i) =>
        i === contactIdx
          ? { ...c, distribuidoras: c.distribuidoras.map((d) => d.id === distId ? { ...d, email } : d) }
          : c
      )
    );
  };

  const updateDistTeamCustomName = (contactIdx: number, customName: string) => {
    setTeamContacts((prev) =>
      prev.map((c, i) =>
        i === contactIdx
          ? { ...c, distribuidoras: c.distribuidoras.map((d) => d.id === "outros" ? { ...d, nomeCustom: customName } : d) }
          : c
      )
    );
  };

  // ── Validation per step ────────────────────────────────────────────────────
  const clearError = (key: string) =>
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });

  const validateStep = (s: StepNum): boolean => {
    const e: Record<string, string> = {};

    if (s === 1) {
      if (!stageName.trim()) e.nomeArtistico = "Obrigatório";
      if (!musicGenre)        e.generoMusical  = "Obrigatório";
    }

    if (s === 2) {
      if (!name.trim())    e.nome    = "Obrigatório";
      if (!email.trim())   e.email   = "Obrigatório";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    }

    if (s === 4) {
      const urlCheck = (field: string, val: string) => {
        if (val.trim() && !/^https?:\/\/.+/.test(val.trim())) {
          e[field] = "URL deve começar com https://";
        }
      };
      urlCheck("spotify",    spotify);
      urlCheck("youtube",    youtube);
      urlCheck("soundcloud", soundcloud);
      urlCheck("deezer",     deezer);
      urlCheck("appleMusic", appleMusic);
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => (s + 1) as StepNum);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((s) => (s - 1) as StepNum);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Submit (same payload as ArtistaFormModal) ──────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    if (!stageName.trim()) { toast.error("Nome artístico é obrigatório"); return; }
    if (!name.trim())          { toast.error("Nome completo é obrigatório");  return; }
    if (!acceptedTerms)        { toast.error("Aceite os termos para enviar o cadastro"); return; }
    if (!orgSlug) return;

    setIsSubmitting(true);
    try {
      // Public registration creates a Lead (source=public_artist_application) via
      // LeadsService.submitPublicArtistRegistration — not an artist directly.
      // The real DTO contract (PublicArtistRegistrationDto/
      // PublicArtistApplicationDto) only has dedicated columns for a subset
      // of this form's fields; the rest (bank details, documents,
      // distribution, team contacts, full address) goes into
      // additionalData — nothing is silently discarded.
      const socialLinks: Record<string, string> = {};
      if (spotify)    socialLinks.spotify    = spotify;
      if (youtube)    socialLinks.youtube    = youtube;
      if (instagram)  socialLinks.instagram  = instagram;
      if (tiktok)     socialLinks.tiktok     = tiktok;
      if (deezer)     socialLinks.deezer     = deezer;
      if (appleMusic) socialLinks.appleMusic = appleMusic;
      if (soundcloud) socialLinks.soundcloud = soundcloud;

      const additionalData: Record<string, unknown> = {
        nomeCivil: name.trim() || null,
        genero: genre || null,
        especialidades: especialidades.length > 0 ? especialidades : null,
        fotoUrl: fotoUrl || null,
        documentosPessoaisUrl: personalDocumentsUrl || null,
        presskitUrl: presskitUrl || null,
        dataNascimento: birthDate || null,
        cpfCnpj: cpfCnpj || null,
        rg: rg || null,
        endereco: address || null,
        banco: banco || null,
        agencia: agencia || null,
        conta: account || null,
        chavePix: pixKey || null,
        titularConta: accountHolder || null,
        tipoPerfil: profileType,
        contatosEquipe: teamContacts.length > 0 ? teamContacts : null,
        distribuidorasGerais: generalDistributors.length > 0 ? generalDistributors : null,
        notasInternas: internalNotes || null,
      };

      const result = await publicApi.post<{ id: string; protocol?: string }>(
        "/public/artist-registration",
        {
          workspaceSlug: orgSlug,
          artistName: stageName.trim(),
          artisticName: stageName.trim(),
          fullName: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          musicalGenre: musicGenre || undefined,
          message: biografia.trim() || undefined,
          socialLinks,
          additionalData,
          acceptedTerms,
          companyWebsite,
        },
      );
      setProtocol(result.protocol ?? result.id ?? "OK");
      setSuccess(true);
    } catch (err: unknown) {
      toast.error("Erro ao enviar cadastro. Tente novamente.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (slugState === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando link…</p>
        </div>
      </div>
    );
  }

  // ── Invalid slug ───────────────────────────────────────────────────────────
  if (slugState === "invalid") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="mx-auto rounded-full bg-destructive/10 p-5 w-fit">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{orgSlug ? "Cadastro indisponível" : "Link inválido"}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Use o link público de cadastro fornecido pela empresa responsável.
            </p>
          </div>
          {orgSlug && (
            <p className="text-xs text-muted-foreground font-sans bg-muted/40 rounded px-3 py-1.5 inline-block">
              /{orgSlug}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-7">
          <div className="mx-auto rounded-full bg-primary/10 p-6 w-fit">
            <CheckCircle2 className="h-14 w-14 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Cadastro Recebido!</h1>
            <p className="text-muted-foreground">
              Seu cadastro entrou direto no sistema da <strong>{orgInfo.name}</strong>. Nossa equipe vai analisar e entrar em contato em breve.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-6 py-4 space-y-1">
            <p className="text-xs text-muted-foreground  tracking-widest font-sans">Protocolo</p>
            <p className="text-2xl font-bold font-sans tracking-widest text-primary">{protocol}</p>
            <p className="text-xs text-muted-foreground">Guarde este número para acompanhamento</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Verifique seu e-mail <strong>{email}</strong> nos próximos dias.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-primary/5 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
          <div className="flex justify-center mb-3">
            <CompanyLogo
              name={orgInfo.name}
              logoUrl={orgInfo.logoUrl}
              className="w-16 h-16"
              textClassName="text-xl"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{orgInfo.name}</h1>
            <div className="text-muted-foreground text-sm mt-2 space-y-2 max-w-lg mx-auto text-center">
              <p className="font-medium text-foreground">Cadastro de Artistas</p>
              <p>Preencha seus dados para realização do cadastro artístico junto à {orgInfo.name}.</p>
              <p className="text-xs leading-relaxed">
                As informações fornecidas neste formulário serão utilizadas exclusivamente para processos
                de identificação, validação cadastral, formalização e gestão de artistas, compositores,
                produtores e demais participantes relacionados às obras musicais e fonogramas vinculados
                à {orgInfo.name}.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 pt-1">
            {([
              { icon: Zap, text: "Resposta rápida" },
              { icon: Shield, text: "Dados seguros" },
              { icon: Star, text: "Sem compromisso" },
            ] as const).map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Stepper — condensed for 7 steps */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="flex items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "flex items-center justify-center rounded-full w-6 h-6 text-xs font-bold shrink-0 transition-colors",
                    step === s.num
                      ? "bg-primary text-primary-foreground"
                      : step > s.num
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span className={cn(
                    "text-xs font-medium hidden sm:block whitespace-nowrap",
                    step === s.num ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("h-px w-4 transition-colors", step > s.num ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1 — Basic information
            Mirrors ArtistaFormModal section 1
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm">Foto de Perfil</Label>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt="Avatar"
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <label
                    htmlFor="foto-upload"
                    className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                    title="Alterar foto"
                  >
                    <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="foto-upload"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary cursor-pointer hover:underline"
                    data-testid="label-upload-foto"
                  >
                    <Camera className="h-4 w-4" />
                    Selecionar foto
                  </label>
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFotoUrl("")}
                      className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline"
                      data-testid="button-remove-foto"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover foto
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP — máx. 5 MB</p>
                </div>
                <input
                  id="foto-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  data-testid="input-foto-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("A foto deve ter no máximo 5 MB");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setFotoUrl(ev.target?.result as string ?? "");
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-base">Informações Básicas</h2>
              <p className="text-sm text-muted-foreground">Nome artístico, género musical e especialidades</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm">Nome Artístico <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Nome usado profissionalmente"
                  value={stageName}
                  onChange={(e) => { setStageName(e.target.value); clearError("nomeArtistico"); }}
                  data-testid="input-nome-artistico"
                  className={errors.nomeArtistico ? "border-destructive" : ""}
                />
                {errors.nomeArtistico && <p className="text-xs text-destructive">{errors.nomeArtistico}</p>}
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm">Gênero Musical <span className="text-destructive">*</span></Label>
                <Select
                  value={musicGenre}
                  onValueChange={(v) => { setMusicGenre(v); clearError("generoMusical"); }}
                >
                  <SelectTrigger data-testid="select-genero-musical" className={errors.generoMusical ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o gênero" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {MUSIC_GENRES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.generoMusical && <p className="text-xs text-destructive">{errors.generoMusical}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Especialidade / Função</Label>
              <div className="flex flex-wrap gap-4">
                {ESPECIALIDADES.map((esp) => (
                  <div key={esp.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`esp-${esp.value}`}
                      checked={especialidades.includes(esp.value)}
                      onCheckedChange={(checked) => toggleEspecialidade(esp.value, !!checked)}
                    />
                    <Label htmlFor={`esp-${esp.value}`} className="text-sm cursor-pointer">{esp.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Link de Documentos Pessoais (PDF)</Label>
              <Input
                placeholder="https://drive.google.com/… ou Dropbox"
                value={personalDocumentsUrl}
                onChange={(e) => setPersonalDocumentsUrl(e.target.value)}
                data-testid="input-documents-pessoais-url"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Link do Presskit / Media Kit</Label>
              <Input
                placeholder="https://drive.google.com/… ou Notion"
                value={presskitUrl}
                onChange={(e) => setPresskitUrl(e.target.value)}
                data-testid="input-presskit-url"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Biografia</Label>
              <Textarea
                placeholder="Trajetória, conquistas e estilo musical…"
                className="min-h-[100px]"
                value={biografia}
                onChange={(e) => setBiografia(e.target.value)}
                data-testid="textarea-biografia"
              />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2 — Personal data
            Mirrors ArtistaFormModal section 2
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Dados Pessoais</h2>
              <p className="text-sm text-muted-foreground">Informações pessoais e de contato</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm">Nome Completo <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Nome conforme documento"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError("nome"); }}
                  data-testid="input-nome-civil"
                  className={errors.nome ? "border-destructive" : ""}
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-sm">Data de Nascimento</Label>
                <DatePickerField
                  value={birthDate}
                  onChange={setBirthDate}
                  data-testid="input-data-nascimento"
                  className="block"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  data-testid="input-cpf-cnpj"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">RG</Label>
                <Input
                  placeholder="00.000.000-0"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  data-testid="input-rg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Gênero</Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger data-testid="select-genero-pessoa">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Endereço Completo</Label>
                <Input
                  placeholder="Rua, número, bairro, cidade, CEP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="input-endereco"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Telefone / WhatsApp</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-telefone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">E-mail <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                  data-testid="input-email"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3 — Bank details
            Mirrors ArtistaFormModal section 3
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Dados Bancários</h2>
              <p className="text-sm text-muted-foreground">Conta para recebimentos e chave Pix</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Banco</Label>
                <Select value={banco} onValueChange={setBanco}>
                  <SelectTrigger data-testid="select-banco">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {BANCOS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Agência</Label>
                <Input
                  placeholder="0000"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  data-testid="input-agencia"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Conta com Dígito</Label>
                <Input
                  placeholder="00000-0"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  data-testid="input-conta"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Chave Pix</Label>
                <Input
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  data-testid="input-chave-pix"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Titular da Conta</Label>
              <Input
                placeholder="Nome completo do titular"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                data-testid="input-titular-conta"
              />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 4 — Profiles and social networks
            Mirrors ArtistaFormModal section 4
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Perfis e Redes Sociais</h2>
              <p className="text-sm text-muted-foreground">Todos os campos são opcionais — preencha o que tiver</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <SiSpotify className="h-3.5 w-3.5 text-green-500" /> Spotify
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://open.spotify.com/artist/…"
                    value={spotify}
                    onChange={(e) => { setSpotify(e.target.value); clearError("spotify"); }}
                    data-testid="input-spotify-url"
                    className={cn("flex-1", errors.spotify ? "border-destructive" : "")}
                  />
                  <UrlIcon state={urlStates.spotify} />
                </div>
                {errors.spotify && <p className="text-xs text-destructive">{errors.spotify}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 text-pink-500 flex items-center justify-center text-xs">Ig</span> Instagram
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://instagram.com/perfil"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    data-testid="input-instagram-url"
                    className="flex-1"
                  />
                  <UrlIcon state={urlStates.instagram} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 text-red-500 text-xs font-bold">▶</span> YouTube
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://youtube.com/channel/UC…"
                    value={youtube}
                    onChange={(e) => { setYoutube(e.target.value); clearError("youtube"); }}
                    data-testid="input-youtube-url"
                    className={cn("flex-1", errors.youtube ? "border-destructive" : "")}
                  />
                  <UrlIcon state={urlStates.youtube} />
                </div>
                {errors.youtube && <p className="text-xs text-destructive">{errors.youtube}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <SiTiktok className="h-3.5 w-3.5" /> TikTok
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://tiktok.com/@perfil"
                    value={tiktok}
                    onChange={(e) => setTiktok(e.target.value)}
                    data-testid="input-tiktok-url"
                    className="flex-1"
                  />
                  <UrlIcon state={urlStates.tiktok} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <SiSoundcloud className="h-3.5 w-3.5 text-orange-500" /> SoundCloud
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://soundcloud.com/perfil"
                    value={soundcloud}
                    onChange={(e) => { setSoundcloud(e.target.value); clearError("soundcloud"); }}
                    data-testid="input-soundcloud-url"
                    className={cn("flex-1", errors.soundcloud ? "border-destructive" : "")}
                  />
                  <UrlIcon state={urlStates.soundcloud} />
                </div>
                {errors.soundcloud && <p className="text-xs text-destructive">{errors.soundcloud}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 text-primary text-xs font-bold">Dz</span> Deezer
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://deezer.com/artist/…"
                    value={deezer}
                    onChange={(e) => { setDeezer(e.target.value); clearError("deezer"); }}
                    data-testid="input-deezer-url"
                    className={cn("flex-1", errors.deezer ? "border-destructive" : "")}
                  />
                  <UrlIcon state={urlStates.deezer} />
                </div>
                {errors.deezer && <p className="text-xs text-destructive">{errors.deezer}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <SiApplemusic className="h-3.5 w-3.5 text-red-400" /> Apple Music
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="https://music.apple.com/artist/…"
                  value={appleMusic}
                  onChange={(e) => { setAppleMusic(e.target.value); clearError("appleMusic"); }}
                  data-testid="input-apple-music-url"
                  className={cn("flex-1", errors.appleMusic ? "border-destructive" : "")}
                />
                <UrlIcon state={urlStates.appleMusic} />
              </div>
              {errors.appleMusic && <p className="text-xs text-destructive">{errors.appleMusic}</p>}
            </div>

            <p className="text-xs text-muted-foreground">
              Cole as URLs públicas. O sistema extrai automaticamente os identificadores
              do Spotify e YouTube para buscar métricas reais.{" "}
              Ícone <CheckCircle className="inline h-3 w-3 text-green-500" /> = URL válida.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 5 — Distributors / aggregators
            Mirrors ArtistaFormModal section 5
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Distribuidoras / Agregadoras</h2>
              <p className="text-sm text-muted-foreground">
                Selecione as plataformas que distribuem ou agregam a sua música
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {DISTRIBUTORS_OPTIONS.map((dist) => {
                const entry = generalDistributors.find((d) => d.id === dist.id);
                const isChecked = !!entry;
                return (
                  <div key={dist.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`geral-dist-${dist.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleDistGeneral(dist.id, !!checked)}
                        data-testid={`checkbox-geral-dist-${dist.id}`}
                      />
                      <Label htmlFor={`geral-dist-${dist.id}`} className="text-sm cursor-pointer font-medium">
                        {dist.label}
                      </Label>
                    </div>

                    {isChecked && dist.id === "outros" && (
                      <div className="ml-6 space-y-1.5">
                        <Input
                          value={entry?.nomeCustom ?? ""}
                          onChange={(e) => updateDistGeneralCustomName(e.target.value)}
                          placeholder="Nome da distribuidora…"
                          className="h-8 text-sm"
                          data-testid="input-geral-dist-nome-custom"
                        />
                        {(entry?.nomeCustom ?? "").trim().length > 0 && (
                          <Input
                            value={entry?.email ?? ""}
                            onChange={(e) => updateDistGeneralEmail(dist.id, e.target.value)}
                            type="email"
                            placeholder="E-mail de share…"
                            className="h-8 text-sm"
                            data-testid="input-geral-dist-email-outros"
                          />
                        )}
                      </div>
                    )}

                    {isChecked && dist.id !== "outros" && (
                      <div className="ml-6">
                        <Input
                          value={entry?.email ?? ""}
                          onChange={(e) => updateDistGeneralEmail(dist.id, e.target.value)}
                          type="email"
                          placeholder={`Email de share — ${dist.label}`}
                          className="h-8 text-sm"
                          data-testid={`input-geral-dist-email-${dist.id}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {generalDistributors.some((d) => d.id === "outros" && !(d.nomeCustom ?? "").trim()) && (
              <p className="text-xs text-muted-foreground ml-6">
                Preencha o nome da distribuidora para ativar o e-mail de share.
              </p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 6 — Profile type + team
            Mirrors ArtistaFormModal section 6
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Tipo de Perfil</h2>
              <p className="text-sm text-muted-foreground">Vínculo profissional e equipe</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Perfil Comercial <span className="text-destructive">*</span></Label>
              <Select value={profileType} onValueChange={setProfileType}>
                <SelectTrigger data-testid="select-type-perfil">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {PROFILE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Dynamic team — same logic as ArtistaFormModal */}
            {["independente", "com_empresario"].includes(profileType) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Equipe / Contatos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={addContact}
                    data-testid="button-add-contato"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </div>

                {teamContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                    Nenhum contato adicionado. Clique em "Adicionar" para incluir membros da equipe.
                  </p>
                )}

                {teamContacts.map((contact, idx) => {
                  const isPublisher =
                    contact.categoria === "editora_musical" ||
                    contact.categoria === "empresario" ||
                    contact.categoria === "gestor" ||
                    profileType === "com_empresario";
                  const outrosEntry = contact.distribuidoras.find((d) => d.id === "outros");

                  return (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg space-y-3 bg-muted/20"
                      data-testid={`card-contato-${idx}`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          Contato {idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeContact(idx)}
                          data-testid={`button-remove-contato-${idx}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Name + category */}
                      <div className={profileType === "com_empresario" ? "space-y-1.5" : "grid grid-cols-2 gap-3"}>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome</Label>
                          <Input
                            value={contact.nome}
                            onChange={(e) => updateContact(idx, "nome", e.target.value)}
                            placeholder="Nome completo"
                            className="h-8 text-sm"
                            data-testid={`input-contato-nome-${idx}`}
                          />
                        </div>
                        {profileType !== "com_empresario" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Categoria</Label>
                            <Select
                              value={contact.categoria}
                              onValueChange={(v) => updateContact(idx, "categoria", v)}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid={`select-contato-categoria-${idx}`}>
                                <SelectValue placeholder="Selecione…" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border border-border z-50">
                                {TEAM_CATEGORIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Telefone + Email */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            value={contact.telefone}
                            onChange={(e) => updateContact(idx, "telefone", e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="h-8 text-sm"
                            data-testid={`input-contato-telefone-${idx}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">E-mail</Label>
                          <Input
                            value={contact.email}
                            onChange={(e) => updateContact(idx, "email", e.target.value)}
                            type="email"
                            placeholder="email@exemplo.com"
                            className="h-8 text-sm"
                            data-testid={`input-contato-email-${idx}`}
                          />
                        </div>
                      </div>

                      {/* Distributors — only when Editora Musical (same logic as the modal) */}
                      {isPublisher && (
                        <div className="space-y-3 pt-2 border-t border-border/40">
                          <Label className="text-xs text-muted-foreground">Distribuidoras</Label>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {DISTRIBUTORS_OPTIONS.map((dist) => {
                              const dEntry = contact.distribuidoras.find((d) => d.id === dist.id);
                              const dChecked = !!dEntry;
                              return (
                                <div key={dist.id} className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`dist-${idx}-${dist.id}`}
                                      checked={dChecked}
                                      onCheckedChange={(checked) => toggleDistTeam(idx, dist.id, !!checked)}
                                      data-testid={`checkbox-dist-${idx}-${dist.id}`}
                                    />
                                    <Label htmlFor={`dist-${idx}-${dist.id}`} className="text-xs cursor-pointer font-medium">
                                      {dist.label}
                                    </Label>
                                  </div>

                                  {dChecked && dist.id === "outros" && (
                                    <div className="ml-6 space-y-1.5">
                                      <Input
                                        value={dEntry?.nomeCustom ?? ""}
                                        onChange={(e) => updateDistTeamCustomName(idx, e.target.value)}
                                        placeholder="Nome da distribuidora…"
                                        className="h-7 text-xs"
                                        data-testid={`input-dist-nome-custom-${idx}`}
                                      />
                                      {(dEntry?.nomeCustom ?? "").trim().length > 0 && (
                                        <Input
                                          value={dEntry?.email ?? ""}
                                          onChange={(e) => updateDistTeamEmail(idx, dist.id, e.target.value)}
                                          type="email"
                                          placeholder="E-mail de share…"
                                          className="h-7 text-xs"
                                          data-testid={`input-dist-email-share-${idx}-${dist.id}`}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {dChecked && dist.id !== "outros" && (
                                    <div className="ml-6">
                                      <Input
                                        value={dEntry?.email ?? ""}
                                        onChange={(e) => updateDistTeamEmail(idx, dist.id, e.target.value)}
                                        type="email"
                                        placeholder={`Email de share — ${dist.label}`}
                                        className="h-7 text-xs"
                                        data-testid={`input-dist-email-share-${idx}-${dist.id}`}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {outrosEntry && !outrosEntry.nomeCustom && (
                            <p className="text-xs text-muted-foreground ml-6">
                              Preencha o nome da distribuidora para ativar o e-mail de share.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 7 — Notes
            Mirrors ArtistaFormModal section 7 + summary
        ═══════════════════════════════════════════════════════════════════════ */}
        {step === 7 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base">Observações</h2>
              <p className="text-sm text-muted-foreground">Notas para a equipe e revisão final</p>
            </div>

            {/* Registration summary */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-semibold  tracking-widest text-primary">Resumo do Cadastro</p>
              <div className="text-sm space-y-1.5">
                {[
                  { label: "Nome Artístico",  value: stageName },
                  { label: "Nome Completo",   value: name },
                  { label: "E-mail",          value: email },
                  { label: "Telefone",        value: phone },
                  { label: "Gênero Musical",  value: musicGenre },
                  { label: "Tipo de Perfil",  value: PROFILE_TYPE_OPTIONS.find((o) => o.value === profileType)?.label },
                  generalDistributors.length > 0
                    ? {
                        label: "Distribuidoras",
                        value: generalDistributors
                          .map((d) => {
                            const opt = DISTRIBUTORS_OPTIONS.find((o) => o.id === d.id);
                            return d.id === "outros" ? (d.nomeCustom || "Outros") : (opt?.label ?? d.id);
                          })
                          .join(", "),
                      }
                    : null,
                ]
                  .filter(Boolean)
                  .map((item) => item && (
                    <div key={item.label} className="flex gap-2">
                      <span className="text-muted-foreground w-36 shrink-0 text-xs">{item.label}</span>
                      <span className={cn("font-medium truncate text-xs", item.value ? "" : "text-muted-foreground italic")}>
                        {item.value || "—"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Notas Internas / Mensagem para a equipe</Label>
              <Textarea
                placeholder="Notas internas, rider técnico, preferências, informações adicionais, disponibilidade, projetos em andamento…"
                className="min-h-[120px]"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                data-testid="textarea-observacoes"
              />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              />
              <span>
                Aceito os termos de uso e o tratamento dos dados enviados para análise desta candidatura.
              </span>
            </label>
            <input
              type="text"
              value={companyWebsite}
              onChange={(event) => setCompanyWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute h-px w-px overflow-hidden opacity-0"
            />
          </div>
        )}

        {/* ── Navigation ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
              data-testid="button-back"
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <div className="flex-1" />
          {step < 7 ? (
            <Button
              type="button"
              onClick={goNext}
              data-testid="button-next"
              className="gap-1.5"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-submit"
              className="gap-1.5 min-w-36"
            >
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                : <><CheckCircle2 className="h-4 w-4" /> Enviar Cadastro</>}
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Ao enviar, suas informações entram diretamente no sistema da equipe responsável.{" "}
          Seus dados são tratados com privacidade.
        </p>
      </div>
    </div>
  );
}
